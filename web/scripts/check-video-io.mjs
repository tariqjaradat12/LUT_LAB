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

console.log('ok');
