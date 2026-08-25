export const MAX_EXPORT_DURATION_SEC = 15 * 60;

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
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
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
