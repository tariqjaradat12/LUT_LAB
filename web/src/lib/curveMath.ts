import type { CurvePoint } from '../engine/types';

export function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** Ensure usable control points: sorted by x, ends pinned to 0 and 1. */
export function normalizeCurvePoints(points: CurvePoint[]): CurvePoint[] {
  if (!points || points.length < 2) {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
  }
  const sorted = points
    .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }))
    .sort((a, b) => a.x - b.x);
  sorted[0] = { x: 0, y: clamp01(sorted[0]!.y) };
  sorted[sorted.length - 1] = { x: 1, y: clamp01(sorted[sorted.length - 1]!.y) };
  // Nudge duplicate x so segments stay valid
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.x <= sorted[i - 1]!.x) {
      sorted[i] = { x: Math.min(1, sorted[i - 1]!.x + 0.0001), y: sorted[i]!.y };
    }
  }
  sorted[sorted.length - 1] = { x: 1, y: sorted[sorted.length - 1]!.y };
  return sorted;
}

/** Piecewise-linear tone curve through the given control points. */
export function evalToneCurve(x: number, points: CurvePoint[]): number {
  const pts = normalizeCurvePoints(points);
  const t = clamp01(x);
  if (t <= pts[0]!.x) return pts[0]!.y;
  const last = pts[pts.length - 1]!;
  if (t >= last.x) return last.y;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (t >= a.x && t <= b.x) {
      const span = Math.max(1e-6, b.x - a.x);
      const f = (t - a.x) / span;
      return clamp01(a.y + (b.y - a.y) * f);
    }
  }
  return t;
}

/** Move a control point freely (ends keep x=0/1; middles stay between neighbors). */
export function moveCurvePoint(
  points: CurvePoint[],
  index: number,
  x: number,
  y: number,
): CurvePoint[] {
  if (!points.length || index < 0 || index >= points.length) return points;
  const last = points.length - 1;
  const ny = clamp01(y);
  if (index === 0) {
    return points.map((p, i) => (i === 0 ? { x: 0, y: ny } : p));
  }
  if (index === last) {
    return points.map((p, i) => (i === last ? { x: 1, y: ny } : p));
  }
  const minX = points[index - 1]!.x + 0.01;
  const maxX = points[index + 1]!.x - 0.01;
  const nx = Math.min(maxX, Math.max(minX, clamp01(x)));
  return points.map((p, i) => (i === index ? { x: nx, y: ny } : p));
}

/** Bake W/R/G/B curves into a 256×4 RGBA8 atlas (row 0=white, 1=R, 2=G, 3=B). */
export function bakeCurveAtlas(
  curves: { rgb: CurvePoint[]; r: CurvePoint[]; g: CurvePoint[]; b: CurvePoint[] },
  size = 256,
): Uint8Array {
  const rows = [curves.rgb, curves.r, curves.g, curves.b];
  const data = new Uint8Array(size * 4 * 4);
  for (let row = 0; row < 4; row++) {
    const pts = rows[row]!;
    for (let i = 0; i < size; i++) {
      const x = size <= 1 ? 0 : i / (size - 1);
      const v = Math.round(evalToneCurve(x, pts) * 255);
      const o = (row * size + i) * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return data;
}
