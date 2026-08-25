const MAX_EXPORT_DURATION_SEC = 15 * 60;

function canExportDuration(durationSec) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return false;
  return durationSec <= MAX_EXPORT_DURATION_SEC + 0.05;
}

function formatTimecode(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function estimateSourceBitrate(byteSize, durationSec) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) return null;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  return Math.round((byteSize * 8) / durationSec);
}

function chooseExportVideoBitrate(options) {
  const w = Math.max(1, options.width | 0);
  const h = Math.max(1, options.height | 0);
  const fps = Math.max(1, options.fps ?? 30);
  const fromResolution = Math.round(w * h * fps * 0.15);
  const src = options.sourceBitrate;
  const fromSource =
    src != null && Number.isFinite(src) && src > 0 ? Math.max(0, Math.round(src - 256_000)) : 0;
  const target = Math.max(fromResolution, fromSource, 8_000_000);
  return Math.min(target, 200_000_000);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(canExportDuration(899) === true, 'canExportDuration(899) should be true');
assert(canExportDuration(900) === true, 'canExportDuration(900) should be true');
assert(canExportDuration(901) === false, 'canExportDuration(901) should be false');
assert(formatTimecode(65) === '1:05', "formatTimecode(65) should be '1:05'");

// 100 MB / 10s ≈ 80 Mbps phone 4K — must not be capped to 40 Mbps.
const phone4k = estimateSourceBitrate(100 * 1024 * 1024, 10);
assert(phone4k != null && phone4k > 80_000_000, 'source bitrate from file size');
assert(
  chooseExportVideoBitrate({ width: 3840, height: 2160, sourceBitrate: phone4k }) >= 80_000_000,
  'export should match native source bitrate',
);
assert(
  chooseExportVideoBitrate({ width: 640, height: 360 }) === 8_000_000,
  'small frames clamp to 8Mbps floor',
);

console.log('ok');
