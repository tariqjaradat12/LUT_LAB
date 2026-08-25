import type { ImportedLut } from './lutEngine';

export type FilmPresetMeta = {
  id: string;
  name: string;
  group: 'Fujifilm' | 'Kodak';
};

/** Built-in film sims — tuned to camera/film looks; color/tone pad fine-tunes further. */
export const FILM_PRESET_META: FilmPresetMeta[] = [
  { id: 'preset_provia', name: 'Provia', group: 'Fujifilm' },
  { id: 'preset_velvia', name: 'Velvia', group: 'Fujifilm' },
  { id: 'preset_astia', name: 'Astia', group: 'Fujifilm' },
  { id: 'preset_classic_chrome', name: 'Classic Chrome', group: 'Fujifilm' },
  { id: 'preset_nostalgic_neg', name: 'Nostalgic Neg', group: 'Fujifilm' },
  { id: 'preset_reala_ace', name: 'Reala Ace', group: 'Fujifilm' },
  { id: 'preset_acros', name: 'Acros', group: 'Fujifilm' },
  { id: 'preset_portra_160', name: 'Portra 160', group: 'Kodak' },
  { id: 'preset_portra_400', name: 'Portra 400', group: 'Kodak' },
  { id: 'preset_portra_800', name: 'Portra 800', group: 'Kodak' },
  { id: 'preset_gold_200', name: 'Gold 200', group: 'Kodak' },
  { id: 'preset_ultramax_400', name: 'Ultramax 400', group: 'Kodak' },
  { id: 'preset_kodachrome_25', name: 'Kodachrome 25', group: 'Kodak' },
  { id: 'preset_kodachrome_64', name: 'Kodachrome 64', group: 'Kodak' },
  { id: 'preset_kodachrome_200', name: 'Kodachrome 200', group: 'Kodak' },
  { id: 'preset_ektar_100', name: 'Ektar 100', group: 'Kodak' },
  { id: 'preset_colorplus_200', name: 'ColorPlus 200', group: 'Kodak' },
];

type HueBias = { center: number; width: number; sat?: number; shift?: number; lum?: number };

type FilmRecipe = {
  contrast: number;
  pivot: number;
  sat: number;
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  black: number;
  white: number;
  biases: HueBias[];
  mono?: boolean;
  monoWeights?: [number, number, number];
  /** Soft S-curve amount on luma (slide films / Acros) */
  sCurve?: number;
};

const RECIPES: Record<string, FilmRecipe> = {
  // Neutral balanced reversal — camera “standard”
  preset_provia: {
    contrast: 1.06,
    pivot: 0.48,
    sat: 1.04,
    lift: [0.004, 0.002, 0.006],
    gamma: [0.98, 1.0, 1.02],
    gain: [1.0, 1.0, 1.01],
    black: 0.01,
    white: 0.985,
    sCurve: 0.08,
    biases: [
      { center: 0.33, width: 0.08, sat: 0.06 }, // greens slightly lively
      { center: 0.58, width: 0.08, sat: 0.04 }, // blues clean
    ],
  },
  // Ultra-vivid landscape slide — punchy greens/reds/blues, hard contrast
  preset_velvia: {
    contrast: 1.28,
    pivot: 0.46,
    sat: 1.38,
    lift: [-0.01, -0.008, 0.0],
    gamma: [1.02, 0.96, 1.04],
    gain: [1.06, 1.0, 1.08],
    black: 0.025,
    white: 0.97,
    sCurve: 0.22,
    biases: [
      { center: 0.33, width: 0.1, sat: 0.28, shift: -0.01 }, // lush greens
      { center: 0.0, width: 0.08, sat: 0.22 }, // reds
      { center: 0.08, width: 0.06, sat: 0.18 }, // oranges
      { center: 0.58, width: 0.1, sat: 0.2, shift: 0.025 }, // blues → slightly magenta skies
      { center: 0.75, width: 0.08, sat: 0.15 }, // purples
    ],
  },
  // Soft portrait slide — gentle skin, vivid blue/green
  preset_astia: {
    contrast: 0.92,
    pivot: 0.5,
    sat: 1.02,
    lift: [0.012, 0.008, 0.004],
    gamma: [0.96, 1.0, 1.05],
    gain: [0.98, 1.0, 1.04],
    black: 0.005,
    white: 0.99,
    sCurve: 0.04,
    biases: [
      { center: 0.04, width: 0.07, sat: -0.12, shift: 0.015, lum: 0.04 }, // skin away from red
      { center: 0.58, width: 0.1, sat: 0.22, shift: 0.02 }, // neon-ish blues
      { center: 0.33, width: 0.09, sat: 0.14 }, // greenery
      { center: 0.12, width: 0.05, sat: -0.06 }, // temper orange
    ],
  },
  // Documentary magazine — muted, cyan-shifted blues, hard shadows
  preset_classic_chrome: {
    contrast: 1.12,
    pivot: 0.42,
    sat: 0.72,
    lift: [0.0, 0.008, 0.014],
    gamma: [1.02, 1.0, 0.96],
    gain: [0.96, 0.98, 1.02],
    black: 0.03,
    white: 0.98,
    sCurve: 0.14,
    biases: [
      { center: 0.55, width: 0.12, sat: 0.08, shift: -0.04 }, // blues → cyan/teal
      { center: 0.0, width: 0.1, sat: -0.15 }, // desat reds
      { center: 0.12, width: 0.08, sat: -0.12 },
      { center: 0.33, width: 0.1, sat: -0.1 },
    ],
  },
  // Photo-book 70s — amber highlights, colored shadows, soft
  preset_nostalgic_neg: {
    contrast: 0.95,
    pivot: 0.52,
    sat: 0.88,
    lift: [0.02, 0.01, -0.005],
    gamma: [0.92, 0.98, 1.06],
    gain: [1.08, 1.02, 0.9],
    black: 0.0,
    white: 0.995,
    sCurve: 0.06,
    biases: [
      { center: 0.08, width: 0.1, sat: 0.06, shift: 0.02 }, // amber/warm mid
      { center: 0.33, width: 0.1, sat: -0.18, shift: 0.03 }, // muted olive greens
      { center: 0.58, width: 0.1, sat: -0.08, lum: -0.03 },
    ],
  },
  // Modern neutral with dimensional contrast — slightly less sat than Provia
  preset_reala_ace: {
    contrast: 1.14,
    pivot: 0.48,
    sat: 0.98,
    lift: [0.002, 0.002, 0.004],
    gamma: [1.0, 1.0, 1.0],
    gain: [1.0, 1.0, 1.0],
    black: 0.015,
    white: 0.98,
    sCurve: 0.16,
    biases: [
      { center: 0.58, width: 0.1, lum: -0.04, sat: 0.05 }, // deeper blues
      { center: 0.0, width: 0.08, lum: -0.03, sat: 0.04 },
      { center: 0.33, width: 0.08, lum: -0.02 },
    ],
  },
  // Fine-grain B&W — rich shadows, cool-neutral gray, Acros-like
  preset_acros: {
    contrast: 1.18,
    pivot: 0.45,
    sat: 0,
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1, 1, 1],
    black: 0.02,
    white: 0.985,
    sCurve: 0.2,
    mono: true,
    monoWeights: [0.25, 0.65, 0.1], // slight green bias like AgX/Acros
    biases: [],
  },
  // Soft pastel portrait negative
  preset_portra_160: {
    contrast: 0.88,
    pivot: 0.52,
    sat: 0.86,
    lift: [0.018, 0.012, 0.006],
    gamma: [0.97, 1.0, 1.03],
    gain: [1.02, 1.0, 0.97],
    black: 0.0,
    white: 0.995,
    sCurve: 0.03,
    biases: [
      { center: 0.04, width: 0.08, sat: -0.08, shift: 0.02, lum: 0.05 }, // creamy skin
      { center: 0.33, width: 0.1, sat: -0.14, shift: 0.02 }, // pastel greens
      { center: 0.58, width: 0.08, sat: -0.06 },
    ],
  },
  // Workhorse Portra — slightly more contrast/sat than 160, still skin-first
  preset_portra_400: {
    contrast: 0.94,
    pivot: 0.5,
    sat: 0.9,
    lift: [0.012, 0.008, 0.004],
    gamma: [0.98, 1.0, 1.02],
    gain: [1.01, 1.0, 0.98],
    black: 0.005,
    white: 0.992,
    sCurve: 0.05,
    biases: [
      { center: 0.04, width: 0.08, sat: -0.06, shift: 0.015, lum: 0.03 },
      { center: 0.33, width: 0.1, sat: -0.1, shift: 0.015 },
      { center: 0.58, width: 0.08, sat: -0.04 },
    ],
  },
  // Faster Portra — cooler, more contrast, open shadows less pastel
  preset_portra_800: {
    contrast: 1.02,
    pivot: 0.48,
    sat: 0.92,
    lift: [0.006, 0.008, 0.014],
    gamma: [1.0, 1.0, 0.98],
    gain: [0.98, 0.99, 1.02],
    black: 0.01,
    white: 0.988,
    sCurve: 0.08,
    biases: [
      { center: 0.04, width: 0.08, sat: -0.04, shift: 0.01 },
      { center: 0.33, width: 0.1, sat: -0.08 },
      { center: 0.58, width: 0.1, sat: 0.04 },
    ],
  },
  // Warm consumer — yellow-orange bias, nostalgic pop
  preset_gold_200: {
    contrast: 1.08,
    pivot: 0.48,
    sat: 1.14,
    lift: [0.01, 0.014, -0.008],
    gamma: [0.94, 0.98, 1.08],
    gain: [1.08, 1.04, 0.9],
    black: 0.012,
    white: 0.985,
    sCurve: 0.1,
    biases: [
      { center: 0.08, width: 0.1, sat: 0.12, shift: 0.02 }, // yellow warmth
      { center: 0.0, width: 0.08, sat: 0.1 },
      { center: 0.33, width: 0.1, sat: -0.06, shift: 0.04 }, // yellow-green shadows
      { center: 0.55, width: 0.1, sat: -0.08 },
    ],
  },
  // Consumer 400 — warmer than Portra, punchier, slightly more cyan shadows
  preset_ultramax_400: {
    contrast: 1.1,
    pivot: 0.47,
    sat: 1.18,
    lift: [0.004, 0.01, 0.002],
    gamma: [0.96, 0.99, 1.04],
    gain: [1.06, 1.02, 0.94],
    black: 0.015,
    white: 0.982,
    sCurve: 0.11,
    biases: [
      { center: 0.0, width: 0.1, sat: 0.12 },
      { center: 0.1, width: 0.08, sat: 0.1 },
      { center: 0.55, width: 0.1, sat: 0.04, shift: -0.02 },
      { center: 0.33, width: 0.08, sat: -0.04 },
    ],
  },
  // Iconic slide — deep blacks, legendary reds, warm mids / cool shadows
  preset_kodachrome_25: {
    contrast: 1.32,
    pivot: 0.44,
    sat: 1.2,
    lift: [-0.012, -0.004, 0.01],
    gamma: [0.94, 1.0, 1.06],
    gain: [1.1, 0.98, 0.92],
    black: 0.04,
    white: 0.965,
    sCurve: 0.26,
    biases: [
      { center: 0.0, width: 0.09, sat: 0.32, shift: -0.01 }, // signature reds
      { center: 0.08, width: 0.06, sat: 0.12 },
      { center: 0.58, width: 0.1, sat: 0.1, shift: 0.02 },
      { center: 0.33, width: 0.08, sat: -0.05 },
    ],
  },
  // Softer sibling of K25
  preset_kodachrome_64: {
    contrast: 1.22,
    pivot: 0.45,
    sat: 1.14,
    lift: [-0.008, -0.002, 0.008],
    gamma: [0.95, 1.0, 1.04],
    gain: [1.07, 0.99, 0.94],
    black: 0.03,
    white: 0.972,
    sCurve: 0.2,
    biases: [
      { center: 0.0, width: 0.09, sat: 0.26 },
      { center: 0.08, width: 0.06, sat: 0.1 },
      { center: 0.58, width: 0.1, sat: 0.08, shift: 0.015 },
    ],
  },
  // Faster Kodachrome — softer, less extreme
  preset_kodachrome_200: {
    contrast: 1.12,
    pivot: 0.47,
    sat: 1.06,
    lift: [-0.002, 0.002, 0.008],
    gamma: [0.97, 1.0, 1.03],
    gain: [1.04, 1.0, 0.96],
    black: 0.02,
    white: 0.98,
    sCurve: 0.14,
    biases: [
      { center: 0.0, width: 0.09, sat: 0.16 },
      { center: 0.58, width: 0.1, sat: 0.06 },
    ],
  },
  // Ultra-vivid negative — deep blues/reds, fine micro-contrast
  preset_ektar_100: {
    contrast: 1.2,
    pivot: 0.46,
    sat: 1.32,
    lift: [-0.006, -0.004, 0.004],
    gamma: [1.02, 0.98, 1.0],
    gain: [1.05, 0.98, 1.08],
    black: 0.02,
    white: 0.975,
    sCurve: 0.18,
    biases: [
      { center: 0.58, width: 0.12, sat: 0.22, shift: 0.01 }, // deep blues
      { center: 0.0, width: 0.09, sat: 0.2 }, // rich reds
      { center: 0.33, width: 0.1, sat: 0.12 },
      { center: 0.04, width: 0.06, sat: 0.06, shift: -0.015 }, // skin can go magenta — keep mild
    ],
  },
  // Budget consumer — soft, warm yellow, lower contrast than Gold
  preset_colorplus_200: {
    contrast: 0.98,
    pivot: 0.5,
    sat: 1.05,
    lift: [0.014, 0.016, 0.0],
    gamma: [0.95, 0.99, 1.06],
    gain: [1.05, 1.03, 0.92],
    black: 0.008,
    white: 0.99,
    sCurve: 0.06,
    biases: [
      { center: 0.1, width: 0.1, sat: 0.08, shift: 0.025 },
      { center: 0.33, width: 0.1, sat: -0.08, shift: 0.03 },
      { center: 0.0, width: 0.08, sat: 0.05 },
    ],
  },
};

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function luma(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  const s = max <= 1e-6 ? 0 : d / max;
  return [h, s, max];
}

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const hh = ((h % 1) + 1) % 1;
  const i = Math.floor(hh * 6);
  const f = hh * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

function hueDist(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function softContrast(x: number, amount: number, pivot: number) {
  const t = (x - pivot) * amount + pivot;
  return clamp01(t);
}

function sCurve(x: number, amount: number) {
  if (amount <= 1e-4) return x;
  // smoothstep-ish contrast around mid
  const n = clamp01(x);
  const curved = n * n * (3 - 2 * n);
  return clamp01(n * (1 - amount) + curved * amount);
}

function applyLiftGammaGain(
  r: number,
  g: number,
  b: number,
  lift: [number, number, number],
  gamma: [number, number, number],
  gain: [number, number, number],
): [number, number, number] {
  const apply = (c: number, i: number) => {
    let v = c + lift[i] * (1 - c);
    v = Math.pow(Math.max(v, 0), 1 / Math.max(gamma[i], 0.01));
    v *= gain[i];
    return v;
  };
  return [apply(r, 0), apply(g, 1), apply(b, 2)];
}

function applyRecipe(r0: number, g0: number, b0: number, recipe: FilmRecipe): [number, number, number] {
  let r = clamp01(r0);
  let g = clamp01(g0);
  let b = clamp01(b0);

  // Per-channel LGG (film dye response)
  [r, g, b] = applyLiftGammaGain(r, g, b, recipe.lift, recipe.gamma, recipe.gain);

  // Global contrast + S-curve on luma, preserve chroma direction
  const y0 = luma(r, g, b);
  let y1 = softContrast(y0, recipe.contrast, recipe.pivot);
  y1 = sCurve(y1, recipe.sCurve ?? 0);
  if (y0 > 1e-5) {
    const scale = y1 / y0;
    r *= scale;
    g *= scale;
    b *= scale;
  } else {
    r = g = b = y1;
  }

  if (recipe.mono) {
    const w = recipe.monoWeights ?? [0.299, 0.587, 0.114];
    let gray = clamp01(r * w[0] + g * w[1] + b * w[2]);
    gray = softContrast(gray, recipe.contrast, recipe.pivot);
    gray = sCurve(gray, recipe.sCurve ?? 0);
    // slight cool tint in deep shadows like Acros scans
    const cool = 1 - gray;
    return [
      clamp01(gray - cool * 0.015),
      clamp01(gray),
      clamp01(gray + cool * 0.02),
    ];
  }

  // HSV sat + selective hue biases
  let [h, s, v] = rgb2hsv(clamp01(r), clamp01(g), clamp01(b));
  s = clamp01(s * recipe.sat);

  for (const bias of recipe.biases) {
    const d = hueDist(h, bias.center);
    const w = Math.exp(-(d * d) / (2 * bias.width * bias.width));
    if (bias.sat) s = clamp01(s * (1 + bias.sat * w));
    if (bias.shift) h = (h + bias.shift * w + 1) % 1;
    if (bias.lum) v = clamp01(v * (1 + bias.lum * w));
  }

  [r, g, b] = hsv2rgb(h, s, v);

  // Soft black/white points (film toe & shoulder)
  const mapTone = (c: number) => {
    const t = (c - recipe.black) / Math.max(1e-4, recipe.white - recipe.black);
    return clamp01(t);
  };
  r = mapTone(r);
  g = mapTone(g);
  b = mapTone(b);

  return [r, g, b];
}

function buildLutData(recipe: FilmRecipe): Float32Array {
  const size = 33;
  const data = new Float32Array(size * size * size * 3);
  let idx = 0;
  for (let bi = 0; bi < size; bi++) {
    const b = bi / (size - 1);
    for (let gi = 0; gi < size; gi++) {
      const g = gi / (size - 1);
      for (let ri = 0; ri < size; ri++) {
        const r = ri / (size - 1);
        const out = applyRecipe(r, g, b, recipe);
        data[idx++] = out[0];
        data[idx++] = out[1];
        data[idx++] = out[2];
      }
    }
  }
  return data;
}

export function buildAllFilmPresets(): ImportedLut[] {
  return FILM_PRESET_META.map((meta) => {
    const recipe = RECIPES[meta.id];
    if (!recipe) throw new Error(`Missing recipe for ${meta.id}`);
    return {
      id: meta.id,
      name: meta.name,
      size: 33,
      data: buildLutData(recipe),
    };
  });
}

export function getLutDisplayName(
  id: string | null,
  presetLuts: { id: string; name: string }[],
  importedLuts: { id: string; name: string }[],
): string {
  if (!id) return '';
  return (
    presetLuts.find((l) => l.id === id)?.name ??
    importedLuts.find((l) => l.id === id)?.name ??
    'LUT'
  );
}
