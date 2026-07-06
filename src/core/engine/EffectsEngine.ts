/**
 * EffectsEngine — Math models for all positional and generative visual effects:
 * Grain, Halation, Bokeh, Lens Blur, HDR, Double Exposure, Softness.
 * 
 * All effects use normalized [0,1] coordinates so they are resolution-independent.
 * These are the CPU-side models; the native GPU shaders receive these params as uniforms.
 */

import { EditParams, PositionalCircle, Point2D } from './EditingEngine';

// ── Grain ────────────────────────────────────────────────────────────────────

export interface GrainSample {
  /** Noise value in -1 → 1 to add to each channel */
  n: number;
}

export class GrainModel {
  private seed: number;

  constructor(seed = Date.now()) {
    this.seed = seed;
  }

  /** Seeded pseudo-random noise [0, 1). */
  private rand(x: number, y: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + this.seed) * 43758.5453;
    return n - Math.floor(n);
  }

  /** Value noise with bilinear interpolation for size > 1. */
  private valueNoise(x: number, y: number, cellSize: number): number {
    const cx = x / cellSize;
    const cy = y / cellSize;
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);
    const fx = cx - ix;
    const fy = cy - iy;

    const v00 = this.rand(ix, iy);
    const v10 = this.rand(ix + 1, iy);
    const v01 = this.rand(ix, iy + 1);
    const v11 = this.rand(ix + 1, iy + 1);

    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    return v00 + (v10 - v00) * sx + (v01 - v00) * sy + (v00 - v10 - v01 + v11) * sx * sy;
  }

  /**
   * Compute grain amount at a normalized pixel coordinate.
   * Returns a noise value in [-1, 1].
   */
  public sample(
    px: number, py: number,
    params: EditParams,
    pixelX: number, pixelY: number
  ): number {
    if (params.grainAmount === 0) return 0;

    const mask = params.grainMask;
    const dx = px - mask.x;
    const dy = py - mask.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maskWeight = dist > mask.radius ? 0 : 1 - dist / mask.radius;
    if (maskWeight <= 0) return 0;

    const roughness = params.grainRoughness;
    const n1 = this.valueNoise(pixelX, pixelY, params.grainSize);
    const n2 = roughness > 0 ? this.valueNoise(pixelX * 2, pixelY * 2, params.grainSize * 0.5) : 0;
    const noise = n1 * (1 - roughness * 0.5) + n2 * roughness * 0.5;

    const strength = (params.grainAmount / 100.0) * 0.12 * maskWeight;
    return (noise * 2 - 1) * strength;
  }
}

// ── Halation ─────────────────────────────────────────────────────────────────

export class HalationModel {
  /**
   * Returns [r,g,b] halation tint contribution for a pixel at normalized (px, py).
   * Simulates light bloom/bleed from bright highlights — typically warm reddish.
   */
  public static sample(
    px: number, py: number,
    r: number, _g: number, _b: number,
    params: EditParams
  ): [number, number, number] {
    if (params.halationStrength === 0) return [0, 0, 0];

    const center = params.halationCenter;
    const dx = px - center.x;
    const dy = py - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = params.halationRadius;

    if (dist > radius) return [0, 0, 0];

    // Soft falloff from center outward
    const t = 1 - dist / radius;
    const falloff = t * t * (3 - 2 * t); // smoothstep

    // Color from halationColor hex
    const hex = params.halationColor.replace('#', '');
    const hR = parseInt(hex.substring(0, 2), 16) / 255;
    const hG = parseInt(hex.substring(2, 4), 16) / 255;
    const hB = parseInt(hex.substring(4, 6), 16) / 255;

    // Only bloom bright pixels (luminance-weighted)
    const luma = Math.min(1, r * 1.5); // boost highlights
    const strength = (params.halationStrength / 100.0) * falloff * luma * 0.4;

    return [hR * strength, hG * strength, hB * strength];
  }
}

// ── Bokeh ────────────────────────────────────────────────────────────────────

export class BokehModel {
  /**
   * Computes bokeh blur weight for a pixel based on distance from bokeh center.
   * Returns 0 (in focus) → 1 (fully blurred).
   */
  public static blurWeight(
    px: number, py: number,
    params: EditParams
  ): number {
    if (params.bokehStrength === 0) return 0;

    const center = params.bokehCenter;
    const dx = px - center.x;
    const dy = py - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const focusRadius = center.radius;

    if (dist <= focusRadius) return 0; // inside focus zone

    const blurStart = focusRadius;
    const blurEnd = focusRadius + params.bokehRadius;
    if (dist >= blurEnd) return params.bokehStrength / 100.0;

    const t = (dist - blurStart) / (blurEnd - blurStart);
    const smooth = t * t * (3 - 2 * t);
    return smooth * (params.bokehStrength / 100.0);
  }

  /**
   * Simulated bokeh aperture shape kernel radius at a given blur level.
   * Hexagonal and anamorphic shapes are approximated via aspect ratio.
   */
  public static kernelRadius(blurWeight: number, shape: EditParams['bokehShape']): number {
    const base = blurWeight * 18; // max ~18px simulated
    switch (shape) {
      case 'hexagon': return base * 0.9;
      case 'anamorphic': return base * 1.4;
      default: return base;
    }
  }
}


// ── Double Exposure ───────────────────────────────────────────────────────────

export class DoubleExposureModel {
  /**
   * Blends two pixels using the specified blend mode.
   * base = source pixel, overlay = secondary exposure pixel.
   * Returns blended [r, g, b].
   */
  public static blend(
    bR: number, bG: number, bB: number,
    oR: number, oG: number, oB: number,
    mode: EditParams['doubleExposureBlend'],
    opacity: number
  ): [number, number, number] {
    let rR: number, rG: number, rB: number;

    switch (mode) {
      case 'screen':
        rR = 1 - (1 - bR) * (1 - oR);
        rG = 1 - (1 - bG) * (1 - oG);
        rB = 1 - (1 - bB) * (1 - oB);
        break;
      case 'multiply':
        rR = bR * oR;
        rG = bG * oG;
        rB = bB * oB;
        break;
      case 'overlay':
        rR = bR < 0.5 ? 2 * bR * oR : 1 - 2 * (1 - bR) * (1 - oR);
        rG = bG < 0.5 ? 2 * bG * oG : 1 - 2 * (1 - bG) * (1 - oG);
        rB = bB < 0.5 ? 2 * bB * oB : 1 - 2 * (1 - bB) * (1 - oB);
        break;
      case 'lighten':
      default:
        rR = Math.max(bR, oR);
        rG = Math.max(bG, oG);
        rB = Math.max(bB, oB);
        break;
    }

    return [
      bR + (rR - bR) * opacity,
      bG + (rG - bG) * opacity,
      bB + (rB - bB) * opacity,
    ];
  }
}

// ── Vignette ──────────────────────────────────────────────────────────────────

export class VignetteModel {
  /**
   * Returns a darkening factor [0–1] to multiply the pixel by.
   * 1.0 = no darkening, 0.0 = full black.
   */
  public static factor(px: number, py: number, params: EditParams): number {
    if (params.vignetteStrength === 0) return 1;

    const dx = px - params.vignetteCenter.x;
    const dy = py - params.vignetteCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const innerR = params.vignetteRadius * (1 - params.vignetteSoftness);
    const outerR = params.vignetteRadius;

    if (dist <= innerR) return 1;
    if (dist >= outerR) {
      return 1 - params.vignetteStrength / 100.0;
    }

    const t = (dist - innerR) / Math.max(0.001, outerR - innerR);
    const smooth = t * t * (3 - 2 * t);
    return 1 - smooth * (params.vignetteStrength / 100.0);
  }
}

// ── Softness ──────────────────────────────────────────────────────────────────

export class SoftnessModel {
  /**
   * Simulates a glow/softness effect by blending the pixel toward a lifted grey.
   * Returns the softened [r, g, b].
   */
  public static apply(r: number, g: number, b: number, amount: number): [number, number, number] {
    if (amount === 0) return [r, g, b];
    const t = amount / 100.0 * 0.4;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const glow = luma * 0.5 + 0.5; // lifted midtone glow
    return [
      r + (glow - r) * t,
      g + (glow - g) * t,
      b + (glow - b) * t,
    ];
  }
}

// ── Sharpen + Definition ──────────────────────────────────────────────────────

export class SharpnessModel {
  /**
   * Unsharp-mask style sharpening applied to a pixel given its neighbours' average.
   */
  public static applyUSM(
    r: number, g: number, b: number,
    blurR: number, blurG: number, blurB: number,
    sharpen: number,
    definition: number
  ): [number, number, number] {
    // High-frequency detail layer
    const sharpenFactor = sharpen / 100.0 * 0.6;
    const defFactor = definition / 100.0 * 0.3;
    const total = sharpenFactor + defFactor;
    if (total === 0) return [r, g, b];
    return [
      Math.min(1, Math.max(0, r + (r - blurR) * total)),
      Math.min(1, Math.max(0, g + (g - blurG) * total)),
      Math.min(1, Math.max(0, b + (b - blurB) * total)),
    ];
  }
}

// ── Long Exposure stretch FX ──────────────────────────────────────────────────

export class LongExposureModel {
  /**
   * Simulates a dynamic long exposure smear/trail.
   * Walks in the opposite of the stretch direction to pull detail color trails forward.
   */
  public static sampleTrail(
    col: number,
    row: number,
    columnsCount: number,
    amount: number,
    direction: number, // negative = left, positive = right
    threshold: number, // 0.0 - 1.0
    getPixel: (c: number, r: number) => [number, number, number]
  ): [number, number, number] {
    const base = getPixel(col, row);
    if (amount === 0 || direction === 0) return base;

    const right = direction > 0;
    const steps = Math.min(12, Math.round((amount / 100) * 10)); // sample up to 12 steps
    if (steps <= 0) return base;

    let accR = base[0];
    let accG = base[1];
    let accB = base[2];
    let weightSum = 1.0;

    // To stretch right, pull colors from left (col - i)
    // To stretch left, pull colors from right (col + i)
    const stepSign = right ? -1 : 1;

    for (let i = 1; i <= steps; i++) {
      const sourceCol = col + i * stepSign;
      if (sourceCol < 0 || sourceCol >= columnsCount) break;

      const srcColor = getPixel(sourceCol, row);
      const luma = 0.2126 * srcColor[0] + 0.7152 * srcColor[1] + 0.0722 * srcColor[2];

      if (luma > threshold) {
        // Decay exponentially over distance
        const decay = Math.pow(0.72, i) * (Math.abs(direction) / 100.0) * 0.85;
        accR += srcColor[0] * decay;
        accG += srcColor[1] * decay;
        accB += srcColor[2] * decay;
        weightSum += decay;
      }
    }

    return [accR / weightSum, accG / weightSum, accB / weightSum];
  }
}

