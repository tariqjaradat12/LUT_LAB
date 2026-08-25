import fixWebmDuration from 'fix-webm-duration';
import type { GradeRenderer } from '../engine/renderer';
import type { EditParams } from '../engine/types';
import { canExportDuration, pickRecorderMimeType, suggestVideoBitrate } from './videoIO';

export type ExportGradedVideoArgs = {
  video: HTMLVideoElement;
  renderer: GradeRenderer;
  params: EditParams;
  onProgress?: (t: number) => void;
};

type CaptureHandle = {
  stream: MediaStream;
  requestFrame: (() => void) | null;
};

function startCanvasCapture(canvas: HTMLCanvasElement): CaptureHandle {
  const captureStream = (
    canvas as HTMLCanvasElement & { captureStream?: (frameRate?: number) => MediaStream }
  ).captureStream;
  if (typeof captureStream !== 'function') {
    throw new Error('This browser cannot capture canvas video for export.');
  }

  try {
    const stream = captureStream.call(canvas, 0);
    const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
    if (typeof track?.requestFrame === 'function') {
      return { stream, requestFrame: () => track.requestFrame!() };
    }
    for (const t of stream.getTracks()) t.stop();
  } catch {
    // Fall through to fixed-FPS capture.
  }

  return { stream: captureStream.call(canvas, 30), requestFrame: null };
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

/**
 * Record the graded WebGL canvas at native video resolution.
 * Never downscales (no scale factor &lt; 1). Prefer MP4 when MediaRecorder supports it.
 */
export async function exportGradedVideo(options: ExportGradedVideoArgs): Promise<Blob> {
  const { video, renderer, params, onProgress } = options;

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
  const sourceDuration = video.duration;

  renderer.setParams(params);
  canvas.width = w;
  canvas.height = h;
  if (canvas.width !== w || canvas.height !== h) {
    throw new Error(`Could not allocate a ${w}×${h} export canvas on this device.`);
  }

  const videoBitsPerSecond = suggestVideoBitrate(w, h, 30);

  const { stream, requestFrame } = startCanvasCapture(canvas);
  tryAddAudioTracks(video, stream);

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond,
    audioBitsPerSecond: 192_000,
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
  const useRvfc = typeof video.requestVideoFrameCallback === 'function';

  const paint = () => {
    if (cancelled) return;
    // Keep buffer locked at native size if anything else tries to resize mid-export.
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      renderer.setVideoFrame(video);
      renderer.draw(false);
      requestFrame?.();
    }
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
        paint();
        rvfcId = video.requestVideoFrameCallback(tick);
      };
      rvfcId = video.requestVideoFrameCallback(tick);
    } else {
      const tick = () => {
        if (cancelled) return;
        paint();
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }
  };

  const restore = async () => {
    stopPump();
    video.loop = wasLoop;
    video.muted = wasMuted;
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
    // Keep muted for reliable play(); audio may still come from captureStream when available.
    video.muted = true;
    await seekVideo(video, 0);

    // No timeslice: one complete blob on stop is more reliable for duration/metadata
    // (especially MP4) than many tiny fragments.
    recorder.start();
    startPump();
    await video.play();
    await waitForEnded(video);
    paint();

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
