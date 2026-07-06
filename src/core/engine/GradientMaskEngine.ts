/**
 * GradientMaskEngine — Computes per-pixel mask weights for linear and circular gradient masks.
 * Both gradient types are used to apply any tool adjustment only within the masked region.
 */

import { LinearGradientMask, CircularGradientMask } from './EditingEngine';

export class GradientMaskEngine {
  /**
   * Compute linear gradient mask weight for a normalized pixel coordinate.
   * Returns 0.0 (no effect) → 1.0 (full effect).
   * The gradient fades from the start point to the end point.
   */
  public static linearWeight(
    px: number, py: number,
    mask: LinearGradientMask
  ): number {
    if (!mask.enabled) return 0;

    const dx = mask.endX - mask.startX;
    const dy = mask.endY - mask.startY;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-10) return 0;

    // Project pixel onto gradient line
    const t = ((px - mask.startX) * dx + (py - mask.startY) * dy) / len2;
    const clampedT = Math.min(1, Math.max(0, t));

    // Smooth step with feather
    const feather = Math.max(0.001, mask.feather);
    const lowEdge = 0.5 - feather / 2;
    const highEdge = 0.5 + feather / 2;
    let weight: number;
    if (clampedT <= lowEdge) {
      weight = 0;
    } else if (clampedT >= highEdge) {
      weight = 1;
    } else {
      const tt = (clampedT - lowEdge) / feather;
      weight = tt * tt * (3 - 2 * tt); // smoothstep
    }

    return mask.inverted ? 1 - weight : weight;
  }

  /**
   * Compute circular (radial) gradient mask weight for a normalized pixel coordinate.
   * Returns 0.0 (no effect) → 1.0 (full effect).
   */
  public static circularWeight(
    px: number, py: number,
    mask: CircularGradientMask
  ): number {
    if (!mask.enabled) return 0;

    const dx = px - mask.centerX;
    const dy = py - mask.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const inner = mask.innerRadius;
    const outer = Math.max(inner + 0.001, mask.outerRadius);

    let weight: number;
    if (dist <= inner) {
      weight = 1;
    } else if (dist >= outer) {
      weight = 0;
    } else {
      const t = 1 - (dist - inner) / (outer - inner);
      weight = t * t * (3 - 2 * t); // smoothstep
    }

    return mask.inverted ? 1 - weight : weight;
  }

  /**
   * Combine both gradient masks (use the maximum influence of either).
   */
  public static combinedWeight(
    px: number, py: number,
    linear: LinearGradientMask,
    circular: CircularGradientMask
  ): number {
    const lw = this.linearWeight(px, py, linear);
    const cw = this.circularWeight(px, py, circular);
    return Math.min(1, lw + cw);
  }
}
