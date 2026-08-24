export type Point2D = { x: number; y: number };

export type DoubleExposureBlend =
  | 'additive'
  | 'average'
  | 'bright'
  | 'dark'
  | 'multiply'
  | 'overlay'
  | 'screen'
  | 'lighten';

export const BLEND_MODES: { id: DoubleExposureBlend; label: string }[] = [
  { id: 'additive', label: 'Additive' },
  { id: 'average', label: 'Average' },
  { id: 'bright', label: 'Bright' },
  { id: 'dark', label: 'Dark' },
  { id: 'multiply', label: 'Multi' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'screen', label: 'Screen' },
  { id: 'lighten', label: 'Lighten' },
];

export const BLEND_MODE_INDEX: Record<DoubleExposureBlend, number> = {
  additive: 0,
  average: 1,
  bright: 2,
  dark: 3,
  multiply: 4,
  overlay: 5,
  screen: 6,
  lighten: 7,
};

export type HueBand =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'magenta';

export const HUE_BANDS: HueBand[] = [
  'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta',
];

export type HSLBand = { hue: number; saturation: number; luminance: number };
export type HSLAdjustments = Record<HueBand, HSLBand>;
export type CurvePoint = { x: number; y: number };
export type CurveChannelId = 'rgb' | 'r' | 'g' | 'b';
export type CurveChannels = Record<CurveChannelId, CurvePoint[]>;

export interface EditParams {
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;
  hue: number;
  bwEnabled: boolean;
  curves: CurveChannels;
  hsl: HSLAdjustments;
  sharpen: number;
  definition: number;
  softness: number;
  denoiseLuminance: number;
  denoiseColor: number;
  vignetteStrength: number;
  vignetteRadius: number;
  vignetteSoftness: number;
  grainAmount: number;
  grainSize: number;
  grainRoughness: number;
  halationStrength: number;
  halationRadius: number;
  halationColor: string;
  halationCenter: Point2D;
  bokehStrength: number;
  bokehAperture: number;
  bokehCenter: Point2D;
  longExposureAmount: number;
  longExposureDirection: number;
  longExposureCenter: Point2D;
  linearMaskEnabled: boolean;
  linearMaskStart: Point2D;
  linearMaskEnd: Point2D;
  linearMaskFeather: number;
  circularMaskEnabled: boolean;
  circularMaskCenter: Point2D;
  circularMaskRadius: number;
  maskExposure: number;
  maskSaturation: number;
  doubleExposureEnabled: boolean;
  doubleExposureOpacity: number;
  doubleExposureOffset: Point2D;
  doubleExposureBlend: DoubleExposureBlend;
}

export const defaultCurve = (): CurvePoint[] => [
  { x: 0, y: 0 },
  { x: 0.25, y: 0.25 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.75 },
  { x: 1, y: 1 },
];

const defaultHslBand = (): HSLBand => ({ hue: 0, saturation: 0, luminance: 0 });

export const DEFAULT_EDIT_PARAMS: EditParams = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  hue: 0,
  bwEnabled: false,
  curves: {
    rgb: defaultCurve(),
    r: defaultCurve(),
    g: defaultCurve(),
    b: defaultCurve(),
  },
  hsl: {
    red: defaultHslBand(),
    orange: defaultHslBand(),
    yellow: defaultHslBand(),
    green: defaultHslBand(),
    cyan: defaultHslBand(),
    blue: defaultHslBand(),
    purple: defaultHslBand(),
    magenta: defaultHslBand(),
  },
  sharpen: 0,
  definition: 0,
  softness: 0,
  denoiseLuminance: 0,
  denoiseColor: 0,
  vignetteStrength: 0,
  vignetteRadius: 0.7,
  vignetteSoftness: 0.5,
  grainAmount: 0,
  grainSize: 2.5,
  grainRoughness: 0.45,
  halationStrength: 0,
  halationRadius: 0.3,
  halationColor: '#FF4422',
  halationCenter: { x: 0.5, y: 0.35 },
  bokehStrength: 0,
  bokehAperture: 5.6,
  bokehCenter: { x: 0.5, y: 0.5 },
  longExposureAmount: 0,
  longExposureDirection: 0,
  longExposureCenter: { x: 0.5, y: 0.5 },
  linearMaskEnabled: false,
  linearMaskStart: { x: 0.35, y: 0.5 },
  linearMaskEnd: { x: 0.65, y: 0.5 },
  linearMaskFeather: 0.12,
  circularMaskEnabled: false,
  circularMaskCenter: { x: 0.5, y: 0.5 },
  circularMaskRadius: 0.4,
  maskExposure: 0,
  maskSaturation: 0,
  doubleExposureEnabled: false,
  doubleExposureOpacity: 0.5,
  doubleExposureOffset: { x: 0, y: 0 },
  doubleExposureBlend: 'additive',
};

export type ToolSection =
  | 'light'
  | 'color'
  | 'curves'
  | 'hsl'
  | 'detail'
  | 'film'
  | 'masks'
  | 'double';

export type FilmSubTab = 'vignette' | 'grain' | 'halation' | 'bokeh' | 'anamorphic';
