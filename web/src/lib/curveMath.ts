import type { CurvePoint } from '../engine/types';

const IDENTITY_Y = [0, 0.25, 0.5, 0.75, 1];

export function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export function curvePointsToYs(points: CurvePoint[]): number[] {
  if (!points || points.length < 5) return [...IDENTITY_Y];
  return [0, 1, 2, 3, 4].map((i) => clamp01(points[i]?.y ?? IDENTITY_Y[i]!));
}

/** Piecewise-linear tone curve through fixed anchors at x = 0, .25, .5, .75, 1. */
export function evalToneCurve(x: number, ys: number[]): number {
  const t = clamp01(x) * 4;
  const i = Math.min(3, Math.floor(t));
  const f = t - i;
  const a = ys[i] ?? 0;
  const b = ys[i + 1] ?? 1;
  return clamp01(a + (b - a) * f);
}

/** Bake W/R/G/B curves into a 256×4 RGBA8 atlas (row 0=white, 1=R, 2=G, 3=B). */
export function bakeCurveAtlas(
  curves: { rgb: CurvePoint[]; r: CurvePoint[]; g: CurvePoint[]; b: CurvePoint[] },
  size = 256,
): Uint8Array {
  const rows = [
    curvePointsToYs(curves.rgb),
    curvePointsToYs(curves.r),
    curvePointsToYs(curves.g),
    curvePointsToYs(curves.b),
  ];
  const data = new Uint8Array(size * 4 * 4);
  for (let row = 0; row < 4; row++) {
    const ys = rows[row]!;
    for (let i = 0; i < size; i++) {
      const x = size <= 1 ? 0 : i / (size - 1);
      const v = Math.round(evalToneCurve(x, ys) * 255);
      const o = (row * size + i) * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return data;
}
