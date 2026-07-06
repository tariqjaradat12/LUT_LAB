/**
 * CurvesEngine — Bezier spline tone curve math.
 * Manages per-channel (RGB / R / G / B) lookup tables generated from control points.
 * Used by EditStudio preview renderer and LUT compiler.
 */

import { CurvePoint, CurveChannels } from './EditingEngine';

export class CurvesEngine {
  /**
   * Build a 256-entry lookup table from a sorted array of control points.
   * Uses monotone cubic (Fritsch-Carlson) interpolation for smooth, non-overshooting curves.
   */
  public static buildLUT(points: CurvePoint[]): Float32Array {
    const lut = new Float32Array(256);
    const sorted = [...points].sort((a, b) => a.x - b.x);

    // Ensure we always have endpoints
    if (sorted.length < 2) {
      for (let i = 0; i < 256; i++) lut[i] = i / 255;
      return lut;
    }

    const n = sorted.length;
    const h: number[] = [];
    const delta: number[] = [];

    for (let i = 0; i < n - 1; i++) {
      h[i] = sorted[i + 1].x - sorted[i].x;
      delta[i] = (sorted[i + 1].y - sorted[i].y) / (h[i] === 0 ? 1e-10 : h[i]);
    }

    // Compute tangents using Fritsch-Carlson method
    const m: number[] = new Array(n).fill(0);
    m[0] = delta[0];
    m[n - 1] = delta[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (delta[i - 1] * delta[i] <= 0) {
        m[i] = 0;
      } else {
        m[i] = (delta[i - 1] + delta[i]) / 2;
      }
    }

    // Monotonicity constraint
    for (let i = 0; i < n - 1; i++) {
      if (Math.abs(delta[i]) < 1e-10) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const alpha = m[i] / delta[i];
        const beta = m[i + 1] / delta[i];
        const tau = alpha * alpha + beta * beta;
        if (tau > 9) {
          m[i] = (3 * alpha / Math.sqrt(tau)) * delta[i];
          m[i + 1] = (3 * beta / Math.sqrt(tau)) * delta[i];
        }
      }
    }

    // Fill LUT by evaluating Hermite spline at each 1/255 step
    for (let px = 0; px < 256; px++) {
      const t = px / 255;

      // Find segment
      let seg = 0;
      for (let i = 0; i < n - 1; i++) {
        if (t <= sorted[i + 1].x) { seg = i; break; }
        seg = i;
      }
      if (t >= sorted[n - 1].x) {
        lut[px] = Math.min(1, Math.max(0, sorted[n - 1].y));
        continue;
      }
      if (t <= sorted[0].x) {
        lut[px] = Math.min(1, Math.max(0, sorted[0].y));
        continue;
      }

      const hSeg = h[seg] === 0 ? 1e-10 : h[seg];
      const tNorm = (t - sorted[seg].x) / hSeg;

      // Cubic Hermite basis
      const h00 = (1 + 2 * tNorm) * (1 - tNorm) * (1 - tNorm);
      const h10 = tNorm * (1 - tNorm) * (1 - tNorm);
      const h01 = tNorm * tNorm * (3 - 2 * tNorm);
      const h11 = tNorm * tNorm * (tNorm - 1);

      const y = h00 * sorted[seg].y +
                h10 * hSeg * m[seg] +
                h01 * sorted[seg + 1].y +
                h11 * hSeg * m[seg + 1];

      lut[px] = Math.min(1, Math.max(0, y));
    }

    return lut;
  }

  /**
   * Pre-build all four channel LUTs from curve channels.
   * Cache this result for efficient per-pixel application.
   */
  public static buildAllLUTs(channels: CurveChannels): {
    rgb: Float32Array;
    r: Float32Array;
    g: Float32Array;
    b: Float32Array;
  } {
    return {
      rgb: this.buildLUT(channels.rgb),
      r: this.buildLUT(channels.r),
      g: this.buildLUT(channels.g),
      b: this.buildLUT(channels.b),
    };
  }

  /**
   * Apply pre-built LUTs to a single pixel.
   */
  public static applyLUTs(
    r: number, g: number, b: number,
    luts: { rgb: Float32Array; r: Float32Array; g: Float32Array; b: Float32Array }
  ): [number, number, number] {
    const ri = Math.round(r * 255);
    const gi = Math.round(g * 255);
    const bi = Math.round(b * 255);

    // Apply master RGB curve first, then per-channel
    const masterR = luts.rgb[Math.min(255, Math.max(0, ri))];
    const masterG = luts.rgb[Math.min(255, Math.max(0, gi))];
    const masterB = luts.rgb[Math.min(255, Math.max(0, bi))];

    const mr2 = Math.round(masterR * 255);
    const mg2 = Math.round(masterG * 255);
    const mb2 = Math.round(masterB * 255);

    return [
      luts.r[Math.min(255, Math.max(0, mr2))],
      luts.g[Math.min(255, Math.max(0, mg2))],
      luts.b[Math.min(255, Math.max(0, mb2))],
    ];
  }

  /**
   * Check whether curve channels are at identity (no adjustment).
   */
  public static isIdentity(points: CurvePoint[]): boolean {
    return points.every(p => Math.abs(p.x - p.y) < 0.005);
  }
}
