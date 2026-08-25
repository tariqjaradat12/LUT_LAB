import fixWebmDuration from 'fix-webm-duration';
import type { GradeRenderer } from '../engine/renderer';
import type { EditParams } from '../engine/types';
import {
  canExportDuration,
  chooseExportVideoBitrate,
  estimateSourceBitrate,
  EXPORT_FPS,
  pickRecorderMimeType,
} from './videoIO';

export type ExportGradedVideoArgs = {
  video: HTMLVideoElement;
  renderer: GradeRenderer;
  params: EditParams;
  /** Original file size in bytes — used to match native bitrate. */
  sourceByteSize?: number;
  onProgress?: (t: number) => void;
};

type CaptureHandle = {
  stream: MediaStream;
  /** Present when using manual frame push (preferred — synced to video time). */
  requestFrame: (() => void) | null;
};

function startCanvasCapture(canvas: HTMLCanvasElement): CaptureHandle {
  const captureStream = (
    canvas as HTMLCanvasElement & { captureStream?: (frameRate?: number) => MediaStream }
  ).captureStream;
  if (typeof captureStream !== 'function') {
    throw new Error('This browser cannot capture canvas video for export.');
  }

  // Prefer manual frames: emit exactly once per EXPORT_FPS slot of video.currentTime.
  // captureStream(30) alone samples on wall-clock and duplicates frames when draw lags → sluggish motion.
  try {
    const stream = captureStream.call(canvas, 0);
    const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
    if (typeof track?.requestFrame === 'function') {
      return { stream, requestFrame: () => track.requestFrame!() };
    }
    for (const t of stream.getTracks()) t.stop();
  } catch {
    // Fall through.
  }

  return { stream: captureStream.call(canvas, EXPORT_FPS), requestFrame: null };
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    try {
      video.currentTime = time;
    } catch {
      video.removeEventListener('seeked', onSeeked);
      resolve();
      return;
    }
    // Already at target / no seek fired.
    if (!video.seeking && Math.abs(video.currentTime - time) < 0.05) {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }
  });
}

function waitForEnded(video: HTMLVideoElement): Promise<void> {
  if (video.ended) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('Playback failed during export.'));
    };
    const cleanup = () => {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onErr);
    };
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onErr);
  });
}

function tryAddAudioTracks(video: HTMLVideoElement, stream: MediaStream) {
  try {
    const el = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };
    const capture = el.captureStream ?? el.mozCaptureStream;
    if (!capture) return;
    const src = capture.call(video);
    for (const track of src.getAudioTracks()) {
      stream.addTrack(track);
    }
    // Only audio is needed; stop unused video tracks from the element capture.
    for (const track of src.getVideoTracks()) {
      track.stop();
    }
  } catch {
    // Video-only export is acceptable when audio capture is blocked.
  }
}

function fixWebmBlobDuration(blob: Blob, durationSec: number): Promise<Blob> {
  if (!blob.type.includes('webm') || !Number.isFinite(durationSec) || durationSec <= 0) {
    return Promise.resolve(blob);
  }
  const durationMs = durationSec * 1000;
  return new Promise((resolve) => {
    try {
      fixWebmDuration(blob, durationMs, (fixed) => resolve(fixed), { logger: false });
    } catch {
      resolve(blob);
    }
  });
}

function assertNativeCaptureSize(stream: MediaStream, w: number, h: number) {
  const track = stream.getVideoTracks()[0];
  if (!track || typeof track.getSettings !== 'function') return;
  const settings = track.getSettings();
  const sw = settings.width;
  const sh = settings.height;
  if (!sw || !sh) return;
  // Allow 1px rounding; anything else means the browser silently downscaled.
  if (sw < w - 1 || sh < h - 1) {
    throw new Error(
      `This browser downscaled export to ${sw}×${sh} (source is ${w}×${h}). Try desktop Chrome/Edge, or a shorter/smaller clip.`,
    );
  }
}

/**
 * Record the graded WebGL canvas at native video resolution and source bitrate.
 * Never downscales. Prefer MP4 when MediaRecorder supports it.
 * Motion is locked to EXPORT_FPS using video-time frame slots (not display refresh).
 */
export async function exportGradedVideo(options: ExportGradedVideoArgs): Promise<Blob> {
  const { video, renderer, params, sourceByteSize, onProgress } = options;

  if (!canExportDuration(video.duration)) {
    throw new Error('Export is limited to 15 minutes.');
  }

  const mime = pickRecorderMimeType();
  if (!mime) {
    throw new Error('This browser cannot record video (MediaRecorder unsupported).');
  }

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    throw new Error('Video has no usable dimensions to export.');
  }

  const canvas = renderer.getCanvas();
  const prevW = canvas.width;
  const prevH = canvas.height;
  const prevStyleW = canvas.style.width;
  const prevStyleH = canvas.style.height;
  const wasPaused = video.paused;
  const resumeTime = video.currentTime;
  const wasMuted = video.muted;
  const wasLoop = video.loop;
  const wasRate = video.playbackRate;
  const sourceDuration = video.duration;

  renderer.setParams(params);
  canvas.width = w;
  canvas.height = h;
  if (canvas.width !== w || canvas.height !== h) {
    throw new Error(`Could not allocate a ${w}×${h} export canvas on this device.`);
  }

  const sourceBitrate = estimateSourceBitrate(sourceByteSize ?? 0, sourceDuration);
  const videoBitsPerSecond = chooseExportVideoBitrate({
    width: w,
    height: h,
    sourceBitrate,
    fps: EXPORT_FPS,
  });

  const { stream, requestFrame } = startCanvasCapture(canvas);
  assertNativeCaptureSize(stream, w, h);
  tryAddAudioTracks(video, stream);

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond,
    audioBitsPerSecond: 256_000,
  });

  const blobPromise = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error('Recording failed.'));
    recorder.onstop = () => {
      const type = mime.includes('mp4') ? 'video/mp4' : 'video/webm';
      resolve(new Blob(chunks, { type }));
    };
  });

  let cancelled = false;
  let rafId = 0;
  let rvfcId: number | null = null;
  let lastEmittedFrame = -1;
  const useRvfc = typeof video.requestVideoFrameCallback === 'function';
  const manualFrames = typeof requestFrame === 'function';

  const paint = (force = false) => {
    if (cancelled) return;
    // Keep buffer locked at native size if anything else tries to resize mid-export.
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    if (manualFrames) {
      // One encoded frame per 1/EXPORT_FPS second of media time — keeps motion crisp at 30fps.
      const frameIndex = Math.floor(video.currentTime * EXPORT_FPS + 1e-6);
      if (!force && frameIndex <= lastEmittedFrame) return;
      lastEmittedFrame = force ? Math.max(lastEmittedFrame, frameIndex) : frameIndex;
    }

    renderer.setVideoFrame(video);
    renderer.draw(false);
    requestFrame?.();
    onProgress?.(video.currentTime);
  };

  const stopPump = () => {
    cancelled = true;
    if (rvfcId != null && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(rvfcId);
      rvfcId = null;
    }
    cancelAnimationFrame(rafId);
  };

  const startPump = () => {
    if (useRvfc) {
      const tick = () => {
        if (cancelled) return;
        paint(false);
        rvfcId = video.requestVideoFrameCallback(tick);
      };
      rvfcId = video.requestVideoFrameCallback(tick);
    } else {
      const tick = () => {
        if (cancelled) return;
        paint(false);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }
  };

  const restore = async () => {
    stopPump();
    video.loop = wasLoop;
    video.muted = wasMuted;
    video.playbackRate = wasRate;
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    try {
      if (Number.isFinite(resumeTime)) {
        await seekVideo(video, resumeTime);
      }
    } catch {
      /* ignore */
    }
    canvas.width = prevW;
    canvas.height = prevH;
    canvas.style.width = prevStyleW;
    canvas.style.height = prevStyleH;
    renderer.draw(true);
    if (!wasPaused) {
      try {
        await video.play();
      } catch {
        /* ignore autoplay blocks after export */
      }
    }
  };

  try {
    video.loop = false;
    video.playbackRate = 1;
    // Keep muted for reliable play(); audio may still come from captureStream when available.
    video.muted = true;
    await seekVideo(video, 0);

    // No timeslice: one complete blob on stop is more reliable for duration/metadata
    // (especially MP4) than many tiny fragments.
    recorder.start();
    // Some engines only populate track settings after recording begins.
    assertNativeCaptureSize(stream, w, h);
    startPump();
    await video.play();
    await waitForEnded(video);
    paint(true);

    if (recorder.state === 'recording' || recorder.state === 'paused') {
      recorder.stop();
    }
    let blob = await blobPromise;
    if (blob.size < 1024) {
      throw new Error('Export produced an empty file. Try a shorter clip or another browser.');
    }
    blob = await fixWebmBlobDuration(blob, sourceDuration);
    return blob;
  } catch (err) {
    try {
      if (recorder.state === 'recording' || recorder.state === 'paused') recorder.stop();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    for (const t of stream.getTracks()) {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    }
    await restore();
  }
}
