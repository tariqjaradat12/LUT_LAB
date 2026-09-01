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
  requestFrame: (() => void) | null;
};

type MediabunnyModule = typeof import('mediabunny');

let mediabunnyPromise: Promise<MediabunnyModule> | null = null;

function loadMediabunny(): Promise<MediabunnyModule> {
  if (!mediabunnyPromise) {
    mediabunnyPromise = import('mediabunny');
  }
  return mediabunnyPromise;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
    if (!video.seeking && Math.abs(video.currentTime - time) < 0.05) {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }
  });
}

/** Wait until the element has a decoded frame we can sample. */
function waitForDecodedFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('Video failed while preparing export frames.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('error', onErr);
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('error', onErr);
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
    // Fall through.
  }

  return { stream: captureStream.call(canvas, EXPORT_FPS), requestFrame: null };
}

function paintGradedFrame(
  video: HTMLVideoElement,
  renderer: GradeRenderer,
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
) {
  paintGradedFromSource(renderer, canvas, video, w, h);
}

function paintGradedFromSource(
  renderer: GradeRenderer,
  gradeCanvas: HTMLCanvasElement,
  source: TexImageSource,
  w: number,
  h: number,
) {
  if (gradeCanvas.width !== w || gradeCanvas.height !== h) {
    gradeCanvas.width = w;
    gradeCanvas.height = h;
  }
  renderer.setSourceFrame(source, w, h);
  renderer.draw(false);
}

async function canUseWebCodecsExport(width: number, height: number): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    const { getFirstEncodableVideoCodec } = await loadMediabunny();
    const codec = await getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], {
      width,
      height,
    });
    return codec != null;
  } catch {
    return false;
  }
}

/**
 * Frame-accurate MP4 export via WebCodecs.
 * Video frames are graded from the same <video> element as preview so HDR / Dolby Vision
 * tone-mapping matches what you see while editing (decoder canvas can look very different).
 */
async function exportWithMediabunny(options: {
  video: HTMLVideoElement;
  renderer: GradeRenderer;
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  sourceDuration: number;
  videoBitsPerSecond: number;
  onProgress?: (t: number) => void;
}): Promise<Blob> {
  const { video, renderer, canvas, w, h, sourceDuration, videoBitsPerSecond, onProgress } = options;

  const {
    ALL_FORMATS,
    AudioSampleSink,
    AudioSampleSource,
    BlobSource,
    BufferTarget,
    CanvasSource,
    getFirstEncodableAudioCodec,
    getFirstEncodableVideoCodec,
    Input,
    Mp4OutputFormat,
    Output,
    Quality,
    VideoSampleSink,
  } = await loadMediabunny();

  if (!video.src) {
    throw new Error('Video source is missing for export.');
  }
  const sourceBlob = await fetch(video.src).then((r) => r.blob());

  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], {
    width: w,
    height: h,
  });
  if (!videoCodec) {
    throw new Error('No WebCodecs video encoder available.');
  }

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(sourceBlob),
  });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error('Could not read a video track for export.');
  }
  if (!(await videoTrack.canDecode())) {
    throw new Error('This browser cannot decode the video track for export.');
  }

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });

  // Encode from a 2D canvas — WebGL canvases often capture as black on the first frame
  // (Android gallery thumbnails use that first IDR frame).
  const encodeCanvas = document.createElement('canvas');
  encodeCanvas.width = w;
  encodeCanvas.height = h;
  const encodeCtx = encodeCanvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
  if (!encodeCtx) {
    throw new Error('Could not allocate an encode canvas for export.');
  }

  const videoSource = new CanvasSource(encodeCanvas, {
    codec: videoCodec,
    quality: new Quality({ bitrate: videoBitsPerSecond, bitrateMode: 'variable' }),
    keyFrameInterval: 1,
  });
  output.addVideoTrack(videoSource);

  let audioSource: InstanceType<typeof AudioSampleSource> | null = null;
  try {
    const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus', 'mp3']);
    if (audioCodec) {
      audioSource = new AudioSampleSource({
        codec: audioCodec,
        quality: new Quality({ bitrate: 256_000 }),
      });
      output.addAudioTrack(audioSource);
    }
  } catch {
    audioSource = null;
  }

  await output.start();

  const frameDt = 1 / EXPORT_FPS;
  const totalFrames = Math.max(1, Math.round(sourceDuration * EXPORT_FPS));
  const sink = new VideoSampleSink(videoTrack);
  const firstTs = (await videoTrack.getFirstTimestamp()) || 0;

  video.pause();
  let encoded = 0;
  let havePicture = false;

  for (let i = 0; i < totalFrames; i++) {
    const mediaTime = Math.min(Math.max(0, sourceDuration - 1e-4), i * frameDt);
    const t = firstTs + mediaTime;
    const sample = await sink.getSample(t);
    if (sample) {
      sample.close();
      await seekVideo(video, mediaTime);
      await waitForDecodedFrame(video);
      paintGradedFrame(video, renderer, canvas, w, h);
      renderer.flush();
      encodeCtx.drawImage(canvas, 0, 0, w, h);
      havePicture = true;
    } else if (!havePicture) {
      // Do not encode leading black frames — they become the gallery thumbnail.
      continue;
    }
    // else: hold last graded picture on encodeCanvas

    const outTime = encoded * frameDt;
    await videoSource.add(outTime, frameDt, encoded === 0 ? { keyFrame: true } : undefined);
    encoded += 1;
    onProgress?.(mediaTime);
  }

  if (encoded === 0) {
    throw new Error('Export could not decode any video frames.');
  }
  videoSource.close();

  if (audioSource) {
    try {
      const audioTrack = await input.getPrimaryAudioTrack();
      if (audioTrack && (await audioTrack.canDecode())) {
        const audioSink = new AudioSampleSink(audioTrack);
        for await (const sample of audioSink.samples(0, sourceDuration)) {
          await audioSource.add(sample);
          sample.close();
        }
      }
    } catch {
      // Keep video-only MP4 if audio copy fails.
    }
    audioSource.close();
  }

  await output.finalize();
  const buffer = target.buffer;
  if (!buffer || buffer.byteLength < 1024) {
    throw new Error('Export produced an empty file.');
  }
  return new Blob([buffer], { type: 'video/mp4' });
}

/**
 * Legacy MediaRecorder path — primes a real first frame so gallery thumbs are not black.
 */
async function exportWithMediaRecorder(options: {
  video: HTMLVideoElement;
  renderer: GradeRenderer;
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  params: EditParams;
  sourceDuration: number;
  videoBitsPerSecond: number;
  onProgress?: (t: number) => void;
}): Promise<Blob> {
  const {
    video,
    renderer,
    canvas,
    w,
    h,
    sourceDuration,
    videoBitsPerSecond,
    onProgress,
  } = options;

  const mime = pickRecorderMimeType();
  if (!mime) {
    throw new Error('This browser cannot record video (MediaRecorder unsupported).');
  }

  // Prime a graded frame BEFORE capture starts — avoids black gallery thumbnails.
  await seekVideo(video, 0);
  await waitForDecodedFrame(video);
  paintGradedFrame(video, renderer, canvas, w, h);

  const { stream, requestFrame } = startCanvasCapture(canvas);
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
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (manualFrames) {
      const frameIndex = Math.floor(video.currentTime * EXPORT_FPS + 1e-6);
      if (!force && frameIndex <= lastEmittedFrame) return;
      lastEmittedFrame = force ? Math.max(lastEmittedFrame, frameIndex) : frameIndex;
    }
    paintGradedFrame(video, renderer, canvas, w, h);
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

  try {
    video.loop = false;
    video.playbackRate = 1;
    video.muted = true;

    recorder.start();
    // Push the already-drawn graded frame as the first encoded frame (thumbnail).
    requestFrame?.();
    await sleep(Math.ceil(1000 / EXPORT_FPS));

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
  } finally {
    stopPump();
    for (const t of stream.getTracks()) {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Record the graded WebGL canvas at native video resolution and source bitrate.
 * Prefers WebCodecs/MP4 (true 30fps + non-black gallery thumb). Falls back to MediaRecorder.
 */
export async function exportGradedVideo(options: ExportGradedVideoArgs): Promise<Blob> {
  const { video, renderer, params, sourceByteSize, onProgress } = options;

  if (!canExportDuration(video.duration)) {
    throw new Error('Export is limited to 15 minutes.');
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

  renderer.setParams(params, { render: false });
  renderer.setSourceFrame(video, w, h);
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

  const restore = async () => {
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
        /* ignore */
      }
    }
  };

  try {
    if (await canUseWebCodecsExport(w, h)) {
      try {
        return await exportWithMediabunny({
          video,
          renderer,
          canvas,
          w,
          h,
          sourceDuration,
          videoBitsPerSecond,
          onProgress,
        });
      } catch {
        // Fall through to MediaRecorder.
      }
    }

    return await exportWithMediaRecorder({
      video,
      renderer,
      canvas,
      w,
      h,
      params,
      sourceDuration,
      videoBitsPerSecond,
      onProgress,
    });
  } finally {
    await restore();
  }
}
