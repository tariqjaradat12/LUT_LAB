/**
 * EditingEngine — Master parameter definitions and math for all 28 editing tools.
 * Shared across iOS, Android, and LUT compilation pipeline.
 */
import { ControlPointEngine } from './ControlPointEngine';
import { LutEngine } from './LutEngine';
import { getBuiltInLuts } from '../presets/BuiltInLuts';
import { CurvesEngine } from './CurvesEngine';


// ─── Positional Types ──────────────────────────────────────────────────────────

export interface Point2D {
  x: number; // 0.0 – 1.0 normalized to canvas width
  y: number; // 0.0 – 1.0 normalized to canvas height
}

export interface PositionalCircle extends Point2D {
  radius: number; // 0.0 – 1.0 normalized
}

export interface PositionalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Curve Control Points ─────────────────────────────────────────────────────

export interface CurvePoint {
  x: number; // input value 0.0–1.0
  y: number; // output value 0.0–1.0
}

export interface CurveChannels {
  rgb: CurvePoint[];
  r: CurvePoint[];
  g: CurvePoint[];
  b: CurvePoint[];
}

// ─── HSL Band ─────────────────────────────────────────────────────────────────

export type HueBand = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'magenta';

export interface HSLBandAdjustment {
  hue: number;        // -180 → +180
  saturation: number; // -100 → +100
  luminance: number;  // -100 → +100
}

export type HSLAdjustments = Record<HueBand, HSLBandAdjustment>;

// ─── Color Wheel ─────────────────────────────────────────────────────────────

export interface ColorWheelValue {
  hue: number;        // 0° – 360°
  saturation: number; // 0.0 – 1.0
  luminance: number;  // -1.0 – 1.0 (lift)
}

export interface ColorWheels {
  shadows: ColorWheelValue;
  midtones: ColorWheelValue;
  highlights: ColorWheelValue;
}

export interface ControlPoint {
  id: string;
  x: number;
  y: number;
  radius: number;      // 0.05 – 1.0 spatial radius
  brightness: number;  // -100 → +100
  contrast: number;    // -100 → +100
  structure: number;   // -100 → +100
  saturation: number;  // -100 → +100
  temperature: number; // -100 → +100
  targetColor: [number, number, number]; // [r, g, b] in [0, 1]
  enabled: boolean;
}

export interface LutMask {
  id: string;
  name: string;
  type: 'linear' | 'radial' | 'brush';
  enabled: boolean;
  inverted: boolean;
  x1: number; // startX / centerX
  y1: number; // startY / centerY
  x2: number; // endX / innerRadius
  y2: number; // endY / outerRadius
  feather: number;
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  intensity: number;
}


// ─── Gradient Masks ──────────────────────────────────────────────────────────

export interface LinearGradientMask {
  enabled: boolean;
  startX: number; // 0–1
  startY: number;
  endX: number;
  endY: number;
  feather: number; // 0–1
  inverted: boolean;
}

export interface CircularGradientMask {
  enabled: boolean;
  centerX: number;
  centerY: number;
  innerRadius: number; // 0–1
  outerRadius: number; // 0–1
  feather: number;
  inverted: boolean;
}

// ─── Master EditParams ────────────────────────────────────────────────────────

export interface EditParams {
  // ── Light ──
  exposure: number;     // -4.0 → +4.0 EV
  brightness: number;   // -100 → +100
  contrast: number;     // -100 → +100
  highlights: number;   // -100 → +100
  shadows: number;      // -100 → +100
  toneContrast: number; // -100 → +100 (S-curve midpoint boost)
  dehaze: number;       // -100 → +100
  hdrStrength: number;  // 0 → 100

  // ── Color ──
  saturation: number;   // -100 → +100
  vibrance: number;     // -100 → +100
  temperature: number;  // -100 (cool) → +100 (warm)
  hue: number;          // -180 → +180
  tint: number;         // -100 (green) → +100 (magenta)
  bwEnabled: boolean;
  bwMix: Record<HueBand, number>; // 0.0 – 1.0 luminosity weight per band

  // ── Curves ──
  curves: CurveChannels;

  // ── HSL ──
  hsl: HSLAdjustments;

  // ── Color Wheels ──
  colorWheels: ColorWheels;

  // ── Detail ──
  sharpen: number;    // 0 → 100
  definition: number; // 0 → 100 (local contrast)
  softness: number;   // 0 → 100
  denoiseLuminance: number; // 0 → 100
  denoiseColor: number;     // 0 → 100

  // ── Vignette ──
  vignetteStrength: number;  // 0 → 100
  vignetteRadius: number;    // 0 → 1
  vignetteSoftness: number;  // 0 → 1
  vignetteCenter: Point2D;

  // ── Grain ──
  grainAmount: number;    // 0 → 100
  grainSize: number;      // 1 → 10
  grainRoughness: number; // 0 → 1
  grainMask: PositionalCircle; // positional grain application

  // ── Halation ──
  halationStrength: number; // 0 → 100
  halationRadius: number;   // 0 → 1
  halationColor: string;    // hex '#FF4422'
  halationCenter: Point2D;

  // ── Bokeh ──
  bokehStrength: number;  // 0 → 100
  bokehRadius: number;    // 0 → 1
  bokehShape: 'circle' | 'hexagon' | 'anamorphic';
  bokehCenter: PositionalCircle;


  // ── Double Exposure ──
  doubleExposureEnabled: boolean;
  doubleExposureOpacity: number;        // 0 – 1
  doubleExposureOffset: Point2D;
  doubleExposureBlend: 'screen' | 'multiply' | 'overlay' | 'lighten';
  doubleExposureUri: string | null;

  // ── Gradients ──
  linearGradient: LinearGradientMask;
  circularGradient: CircularGradientMask;
  gradientExposure: number;
  gradientSaturation: number;
  gradientTemperature: number;

  // ── Crop ──
  crop: PositionalRect;
  zoomScale: number;
  zoomX: number;
  zoomY: number;

  // ── Control Points ──
  controlPoints: ControlPoint[];

  // ── Perspective ──
  perspectiveVertical: number;   // -100 to 100
  perspectiveHorizontal: number; // -100 to 100
  perspectiveAspect: number;     // -100 to 100
  perspectiveRotate: number;     // -100 to 100

  // ── Long Exposure ──
  longExposureAmount: number;    // 0 to 100
  longExposureDirection: number; // -100 to 100
  longExposureThreshold: number; // 0.0 to 1.0
  longExposureCenter: Point2D;

  // ── Preset LUT ──
  activeLutPresetId: string | null;
  lutIntensity: number; // 0 to 100
  customLutData: number[] | null;
  customLutSize: number;
  lutColorOffset: number;
  lutToneOffset: number;
  importedLuts?: Array<{ id: string; name: string; data: number[]; size: number }>;

  // ── Masking ──
  masks: LutMask[];
  activeMaskId: string | null;
  showMaskOverlay: boolean;
  brushStroke?: number[];
}

// ─── Defaults ────────────────────────────────────────────────────────────────


export const DEFAULT_HSL_BAND: HSLBandAdjustment = { hue: 0, saturation: 0, luminance: 0 };

export const DEFAULT_HSL: HSLAdjustments = {
  red: { ...DEFAULT_HSL_BAND },
  orange: { ...DEFAULT_HSL_BAND },
  yellow: { ...DEFAULT_HSL_BAND },
  green: { ...DEFAULT_HSL_BAND },
  cyan: { ...DEFAULT_HSL_BAND },
  blue: { ...DEFAULT_HSL_BAND },
  purple: { ...DEFAULT_HSL_BAND },
  magenta: { ...DEFAULT_HSL_BAND },
};

export const DEFAULT_CURVE_POINTS: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 0.25, y: 0.25 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.75 },
  { x: 1, y: 1 },
];

export const DEFAULT_CURVES: CurveChannels = {
  rgb: [...DEFAULT_CURVE_POINTS.map(p => ({ ...p }))],
  r:   [...DEFAULT_CURVE_POINTS.map(p => ({ ...p }))],
  g:   [...DEFAULT_CURVE_POINTS.map(p => ({ ...p }))],
  b:   [...DEFAULT_CURVE_POINTS.map(p => ({ ...p }))],
};

export const DEFAULT_WHEEL: ColorWheelValue = { hue: 0, saturation: 0, luminance: 0 };

export const DEFAULT_EDIT_PARAMS: EditParams = {
  // Light
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  toneContrast: 0,
  dehaze: 0,
  hdrStrength: 0,

  // Color
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  hue: 0,
  tint: 0,
  bwEnabled: false,
  bwMix: {
    red: 0.3, orange: 0.4, yellow: 0.7, green: 0.5,
    cyan: 0.5, blue: 0.2, purple: 0.3, magenta: 0.4,
  },

  // Curves
  curves: DEFAULT_CURVES,

  // HSL
  hsl: DEFAULT_HSL,

  // Color Wheels
  colorWheels: {
    shadows: { ...DEFAULT_WHEEL },
    midtones: { ...DEFAULT_WHEEL },
    highlights: { ...DEFAULT_WHEEL },
  },

  // Detail
  sharpen: 0,
  definition: 0,
  softness: 0,
  denoiseLuminance: 0,
  denoiseColor: 0,

  // Vignette
  vignetteStrength: 0,
  vignetteRadius: 0.7,
  vignetteSoftness: 0.5,
  vignetteCenter: { x: 0.5, y: 0.5 },

  // Grain
  grainAmount: 0,
  grainSize: 2,
  grainRoughness: 0.5,
  grainMask: { x: 0.5, y: 0.5, radius: 1.0 },

  // Halation
  halationStrength: 0,
  halationRadius: 0.3,
  halationColor: '#FF4422',
  halationCenter: { x: 0.5, y: 0.3 },

  // Bokeh
  bokehStrength: 0,
  bokehRadius: 0.5,
  bokehShape: 'circle',
  bokehCenter: { x: 0.5, y: 0.5, radius: 0.3 },


  // Double Exposure
  doubleExposureEnabled: false,
  doubleExposureOpacity: 0.5,
  doubleExposureOffset: { x: 0, y: 0 },
  doubleExposureBlend: 'screen',
  doubleExposureUri: null,

  // Gradients
  linearGradient: {
    enabled: false,
    startX: 0.2, startY: 0, endX: 0.2, endY: 1,
    feather: 0.3, inverted: false,
  },
  circularGradient: {
    enabled: false,
    centerX: 0.5, centerY: 0.5,
    innerRadius: 0.1, outerRadius: 0.5,
    feather: 0.2, inverted: false,
  },
  gradientExposure: 0,
  gradientSaturation: 0,
  gradientTemperature: 0,

  // Crop
  crop: { x: 0, y: 0, width: 1, height: 1 },
  zoomScale: 1.0,
  zoomX: 0.5,
  zoomY: 0.5,

  // Control Points
  controlPoints: [],

  // Perspective
  perspectiveVertical: 0,
  perspectiveHorizontal: 0,
  perspectiveAspect: 0,
  perspectiveRotate: 0,

  // Long Exposure
  longExposureAmount: 0,
  longExposureDirection: 0,
  longExposureThreshold: 0.4,
  longExposureCenter: { x: 0.5, y: 0.5 },

  // Preset LUT
  activeLutPresetId: null,
  lutIntensity: 100,
  customLutData: null,
  customLutSize: 33,
  lutColorOffset: 0,
  lutToneOffset: 0,
  importedLuts: [],

  // Masking
  masks: [],
  activeMaskId: null,
  showMaskOverlay: false,
};

// ─── Math Utilities ──────────────────────────────────────────────────────────

export class EditingEngine {
  /** Clamp value to [min, max]. */
  public static clamp(val: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, val));
  }

  /** Linear interpolation. */
  public static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Warps a normalized [0,1] coordinate based on perspective tilt, aspect, and rotation parameters.
   */
  public static applyPerspectiveWarp(px: number, py: number, p: EditParams): [number, number, number] {
    // Center coordinate around (0.5, 0.5)
    let cx = px - 0.5;
    let cy = py - 0.5;

    // 1. Vertical perspective (tilt)
    if (p.perspectiveVertical !== 0) {
      const vFactor = (p.perspectiveVertical / 100.0) * 0.45;
      cx = cx * (1.0 + cy * vFactor);
    }

    // 2. Horizontal perspective (tilt)
    if (p.perspectiveHorizontal !== 0) {
      const hFactor = (p.perspectiveHorizontal / 100.0) * 0.45;
      cy = cy * (1.0 + cx * hFactor);
    }

    // 3. Aspect Ratio (stretching height relative to width)
    if (p.perspectiveAspect !== 0) {
      const aFactor = 1.0 + (p.perspectiveAspect / 100.0) * 0.35;
      cy = cy * aFactor;
    }

    // 4. Rotation skew (fine alignment)
    if (p.perspectiveRotate !== 0) {
      const angle = (p.perspectiveRotate / 100.0) * (Math.PI / 12); // max +/- 15 degrees
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rx = cx * cosA - cy * sinA;
      const ry = cx * sinA + cy * cosA;
      cx = rx;
      cy = ry;
    }

    // Uncenter and clamp to valid bounds
    return [
      this.clamp(cx + 0.5, 0, 1),
      this.clamp(cy + 0.5, 0, 1),
      1.0
    ];
  }

  /**
   * Applies the full editing pipeline to a single [0–1] RGB pixel.
   * Returns graded [R, G, B] in [0–1].
   * Used by LutEngine.compileLut() and software preview rendering.
   */
  public static applyAllTools(
    r: number,
    g: number,
    b: number,
    p: EditParams,
    px = 0.5,
    py = 0.5
  ): [number, number, number] {
    let R = r, G = g, B = b;

    // 0. Built-in / Procedural Preset LUT (applied first as base grade)
    if (p.activeLutPresetId) {
      let targetR = R, targetG = G, targetB = B;
      let applied = false;

      if (p.activeLutPresetId.startsWith('procedural_')) {
        applied = true;
        if (p.activeLutPresetId === 'procedural_7') {
          // Sepia Warmth
          targetR = R * 0.393 + G * 0.769 + B * 0.189;
          targetG = R * 0.349 + G * 0.686 + B * 0.168;
          targetB = R * 0.272 + G * 0.534 + B * 0.131;
        } else if (p.activeLutPresetId === 'procedural_8') {
          // Noir Contrast
          const grey = 0.2126 * R + 0.7152 * G + 0.0722 * B;
          const contrastNoir = Math.pow(grey, 1.45);
          targetR = contrastNoir; targetG = contrastNoir; targetB = contrastNoir;
        } else if (p.activeLutPresetId === 'procedural_9') {
          // Jungle Green
          targetR = R * 0.78;
          targetG = G * 1.16;
          targetB = B * 0.82;
        } else if (p.activeLutPresetId === 'procedural_10') {
          // Neon Cyberpunk
          targetR = R * 1.25;
          targetG = G * 0.75;
          targetB = B * 1.35;
        }
      } else if (
        p.activeLutPresetId === 'custom' ||
        p.activeLutPresetId.startsWith('imported_')
      ) {
        let lutData = p.customLutData;
        let lutSize = p.customLutSize || 33;
        if (p.activeLutPresetId.startsWith('imported_')) {
          const match = p.importedLuts?.find(l => l.id === p.activeLutPresetId);
          if (match) {
            lutData = match.data;
            lutSize = match.size;
          }
        }
        if (lutData) {
          const table = LutEngine.rebuildTable(lutSize, lutData);
          [targetR, targetG, targetB] = LutEngine.applyLutTrilinear(R, G, B, { size: lutSize, table });
          applied = true;
        }
      } else {
        const presets = getBuiltInLuts();
        const preset = presets.find(l => l.id === p.activeLutPresetId);
        if (preset) {
          [targetR, targetG, targetB] = LutEngine.applyLutTrilinear(R, G, B, preset);
          applied = true;
        }
      }

      if (applied) {
        if (p.lutToneOffset && p.lutToneOffset !== 0) {
          const factor = Math.pow(2.0, (p.lutToneOffset / 100.0) * 1.5);
          targetR = this.clamp(targetR * factor, 0, 1);
          targetG = this.clamp(targetG * factor, 0, 1);
          targetB = this.clamp(targetB * factor, 0, 1);
        }
        if (p.lutColorOffset && p.lutColorOffset !== 0) {
          const shift = (p.lutColorOffset / 100.0) * 0.25;
          targetR = this.clamp(targetR + shift, 0, 1);
          targetG = this.clamp(targetG - shift * 0.5, 0, 1);
          targetB = this.clamp(targetB - shift, 0, 1);
        }
        const t = p.lutIntensity / 100.0;
        R = this.lerp(R, targetR, t);
        G = this.lerp(G, targetG, t);
        B = this.lerp(B, targetB, t);
      }
    }

    // 1. Exposure (EV stops)
    const expFactor = Math.pow(2.0, p.exposure);
    R *= expFactor; G *= expFactor; B *= expFactor;

    // 2. Brightness (additive lift)
    const bright = p.brightness / 100.0;
    R += bright; G += bright; B += bright;

    // 3. Contrast (pivot around 0.5)
    const cont = 1.0 + p.contrast / 100.0;
    R = (R - 0.5) * cont + 0.5;
    G = (G - 0.5) * cont + 0.5;
    B = (B - 0.5) * cont + 0.5;

    // 4. Highlights & Shadows (tone-range selective)
    const luma = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const hlWeight = Math.pow(this.clamp(luma, 0, 1), 2); // highlight mask
    const shWeight = Math.pow(1.0 - this.clamp(luma, 0, 1), 2); // shadow mask
    const hlShift = (p.highlights / 100.0) * 0.5;
    const shShift = (p.shadows / 100.0) * 0.5;
    R += hlShift * hlWeight + shShift * shWeight;
    G += hlShift * hlWeight + shShift * shWeight;
    B += hlShift * hlWeight + shShift * shWeight;

    // 5. Tone Contrast (S-curve midpoint)
    if (p.toneContrast !== 0) {
      const tc = p.toneContrast / 100.0;
      const sCurve = (v: number) => {
        const midShift = tc * 0.5;
        return v < 0.5
          ? v - midShift * Math.pow(1.0 - 2 * v, 2) * Math.sign(tc)
          : v + midShift * Math.pow(2 * v - 1.0, 2) * Math.sign(tc);
      };
      R = sCurve(R); G = sCurve(G); B = sCurve(B);
    }

    // 6. Color Temperature (warm/cool shift)
    const tempShift = p.temperature / 100.0 * 0.15;
    R += tempShift;
    B -= tempShift;

    // 7. Tint (green/magenta)
    const tintShift = p.tint / 100.0 * 0.1;
    G -= tintShift;

    // 8. Hue rotation
    if (p.hue !== 0) {
      [R, G, B] = this.rotateHue(R, G, B, p.hue);
    }

    // 9. Saturation
    const satLuma = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const satFactor = 1.0 + p.saturation / 100.0;
    R = satLuma + (R - satLuma) * satFactor;
    G = satLuma + (G - satLuma) * satFactor;
    B = satLuma + (B - satLuma) * satFactor;

    // 10. Vibrance (smart saturation — protects already-saturated colors)
    if (p.vibrance !== 0) {
      const maxC = Math.max(R, G, B);
      const minC = Math.min(R, G, B);
      const currentSat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      const vibranceFactor = 1.0 + (p.vibrance / 100.0) * (1.0 - currentSat);
      const vl = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      R = vl + (R - vl) * vibranceFactor;
      G = vl + (G - vl) * vibranceFactor;
      B = vl + (B - vl) * vibranceFactor;
    }

    // 10.5. Curves
    const luts = CurvesEngine.buildAllLUTs(p.curves);
    [R, G, B] = CurvesEngine.applyLUTs(R, G, B, luts);

    // 11. HSL per-band adjustments
    [R, G, B] = this.applyHSL(R, G, B, p.hsl);

    // 12. Color Wheels (3-way)
    [R, G, B] = this.applyColorWheels(R, G, B, p.colorWheels);

    // 12.5. U-Point Control Points (selective regional edits)
    if (p.controlPoints && p.controlPoints.length > 0) {
      for (const cp of p.controlPoints) {
        const weight = ControlPointEngine.calculateWeight(px, py, R, G, B, cp);
        if (weight > 0) {
          [R, G, B] = ControlPointEngine.applyAdjustment(R, G, B, weight, cp);
        }
      }
    }

    // 13. Black & White conversion
    if (p.bwEnabled) {
      [R, G, B] = this.applyBW(R, G, B, p.bwMix);
    }

    // 14. Dehaze (lifts blacks + adds clarity haze removal)
    if (p.dehaze !== 0) {
      const dh = p.dehaze / 100.0;
      const grey = 0.5;
      R = R + dh * (grey - R) * 0.4;
      G = G + dh * (grey - G) * 0.4;
      B = B + dh * (grey - B) * 0.4;
    }

    // 15. HDR Effect (local tone mapping simulation)
    if (p.hdrStrength > 0) {
      const hdrL = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      const hdrFactor = 1.0 + (p.hdrStrength / 100.0) * 0.6;
      const hdrC = this.clamp(hdrL * hdrFactor, 0, 1);
      const hdrScale = hdrL > 0 ? hdrC / hdrL : 1;
      R *= hdrScale; G *= hdrScale; B *= hdrScale;
    }

    return [
      this.clamp(R, 0, 1),
      this.clamp(G, 0, 1),
      this.clamp(B, 0, 1),
    ];
  }

  // ── Hue Rotation ─────────────────────────────────────────────────────────

  public static rotateHue(r: number, g: number, b: number, hueDeg: number): [number, number, number] {
    // Convert RGB → HSL, shift hue, convert back
    const [h, s, l] = this.rgbToHsl(r, g, b);
    const newH = ((h + hueDeg / 360.0) % 1.0 + 1.0) % 1.0;
    return this.hslToRgb(newH, s, l);
  }

  // ── HSL Per-Band ──────────────────────────────────────────────────────────

  public static applyHSL(r: number, g: number, b: number, hsl: HSLAdjustments): [number, number, number] {
    const [h, s, l] = this.rgbToHsl(r, g, b);
    const band = this.getHueBand(h);
    const adj = hsl[band];
    const newH = ((h + adj.hue / 360.0) % 1.0 + 1.0) % 1.0;
    const newS = this.clamp(s + adj.saturation / 100.0, 0, 1);
    const newL = this.clamp(l + adj.luminance / 100.0, 0, 1);
    return this.hslToRgb(newH, newS, newL);
  }

  private static getHueBand(h: number): HueBand {
    const deg = h * 360;
    if (deg < 15 || deg >= 345) return 'red';
    if (deg < 45) return 'orange';
    if (deg < 75) return 'yellow';
    if (deg < 150) return 'green';
    if (deg < 195) return 'cyan';
    if (deg < 255) return 'blue';
    if (deg < 285) return 'purple';
    return 'magenta';
  }

  // ── Color Wheels ──────────────────────────────────────────────────────────

  public static applyColorWheels(r: number, g: number, b: number, wheels: ColorWheels): [number, number, number] {
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Shadow weight (strong in darks, zero in lights)
    const shadowW = Math.pow(this.clamp(1.0 - luma, 0, 1), 2);
    // Highlight weight
    const highlightW = Math.pow(this.clamp(luma, 0, 1), 2);
    // Midtone weight (peaks at 0.5)
    const midW = this.clamp(1.0 - Math.abs(luma - 0.5) * 2, 0, 1);

    let R = r, G = g, B = b;
    [R, G, B] = this.applyWheelTint(R, G, B, wheels.shadows, shadowW);
    [R, G, B] = this.applyWheelTint(R, G, B, wheels.midtones, midW);
    [R, G, B] = this.applyWheelTint(R, G, B, wheels.highlights, highlightW);
    return [this.clamp(R, 0, 1), this.clamp(G, 0, 1), this.clamp(B, 0, 1)];
  }

  private static applyWheelTint(
    r: number, g: number, b: number,
    wheel: ColorWheelValue, weight: number
  ): [number, number, number] {
    if (wheel.saturation === 0 && wheel.luminance === 0) return [r, g, b];
    const hueRad = (wheel.hue * Math.PI) / 180.0;
    const strength = wheel.saturation * weight * 0.15;
    const liftStrength = wheel.luminance * weight * 0.2;
    return [
      this.clamp(r + Math.cos(hueRad) * strength + liftStrength, 0, 1),
      this.clamp(g + Math.cos(hueRad + (2 * Math.PI) / 3) * strength + liftStrength, 0, 1),
      this.clamp(b + Math.cos(hueRad + (4 * Math.PI) / 3) * strength + liftStrength, 0, 1),
    ];
  }

  // ── Black & White ─────────────────────────────────────────────────────────

  public static applyBW(r: number, g: number, b: number, mix: Record<HueBand, number>): [number, number, number] {
    const [h] = this.rgbToHsl(r, g, b);
    const band = this.getHueBand(h);
    const weight = mix[band];
    const grey = 0.2126 * r * weight + 0.7152 * g * weight + 0.0722 * b * weight;
    const L = this.clamp(grey, 0, 1);
    return [L, L, L];
  }

  // ── Color Space Helpers ────────────────────────────────────────────────────

  public static rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2.0;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2.0 - max - min) : d / (max + min);
    let h: number;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6; break;
    }
    return [h, s, l];
  }

  public static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s === 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)];
  }
}
