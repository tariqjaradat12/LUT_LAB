export const MAX_EXPORT_DURATION_SEC = 15 * 60;

/** Graded exports are always encoded at this frame rate. */
export const EXPORT_FPS = 30;

export function canExportDuration(durationSec: number): boolean {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return false;
  return durationSec <= MAX_EXPORT_DURATION_SEC + 0.05;
}

export function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function pickRecorderMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  // Prefer MP4/H.264 when available — phone galleries often show WebM as 0:00
  // and may refuse to play it. Fall back to WebM on browsers that only support it.
  const candidates = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

/** Average bits/sec of the source file (video + audio + container). */
export function estimateSourceBitrate(byteSize: number, durationSec: number): number | null {
  if (!Number.isFinite(byteSize) || byteSize <= 0) return null;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  return Math.round((byteSize * 8) / durationSec);
}

/**
 * Encode bitrate for export: prefer the source file's average rate so graded
 * output is not softer than the original. Falls back to a resolution heuristic.
 * Only clamps at an extreme ceiling for browser stability — not a quality cap.
 */
export function chooseExportVideoBitrate(options: {
  width: number;
  height: number;
  sourceBitrate?: number | null;
  fps?: number;
}): number {
  const w = Math.max(1, options.width | 0);
  const h = Math.max(1, options.height | 0);
  const fps = Math.max(1, options.fps ?? 30);
  // Heuristic floor when source size is unknown (~0.15 bits/pixel/frame).
  const fromResolution = Math.round(w * h * fps * 0.15);
  const src = options.sourceBitrate;
  // Leave a little headroom for the audio track MediaRecorder muxes separately.
  const fromSource =
    src != null && Number.isFinite(src) && src > 0 ? Math.max(0, Math.round(src - 256_000)) : 0;
  const target = Math.max(fromResolution, fromSource, 8_000_000);
  return Math.min(target, 200_000_000);
}

/** @deprecated use chooseExportVideoBitrate */
export function suggestVideoBitrate(width: number, height: number, fps = 30): number {
  return chooseExportVideoBitrate({ width, height, fps });
}

export function revokeVideoUrl(url: string | null | undefined) {
  if (url) URL.revokeObjectURL(url);
}

export async function loadVideoFromFile(file: File): Promise<{
  video: HTMLVideoElement;
  objectUrl: string;
  width: number;
  height: number;
  duration: number;
}> {
  if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
    throw new Error('Please choose a video file (MP4, WebM, or MOV).');
  }
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = objectUrl;
  video.playsInline = true;
  video.preload = 'auto';
  video.muted = true;
  video.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    const onErr = () => reject(new Error('Could not open that video in this browser.'));
    video.addEventListener('error', onErr, { once: true });
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
  });

  const width = video.videoWidth;
  const height = video.videoHeight;
  const duration = video.duration;
  if (!width || !height) {
    revokeVideoUrl(objectUrl);
    throw new Error('That video has no usable picture track.');
  }
  return { video, objectUrl, width, height, duration };
}
