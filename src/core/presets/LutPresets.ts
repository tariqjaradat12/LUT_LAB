import { LutEngine, LutData } from '../engine/LutEngine';

export interface ImportedLut {
  id: string;
  name: string;
  data: number[];
  size: number;
}

export interface LutState {
  activeLutPresetId: string | null;
  lutIntensity: number;
  lutColorOffset: number;
  lutToneOffset: number;
  customLutData: number[] | null;
  customLutSize: number;
  importedLuts: ImportedLut[];
}

export const DEFAULT_LUT_STATE: LutState = {
  activeLutPresetId: null,
  lutIntensity: 100,
  lutColorOffset: 0,
  lutToneOffset: 0,
  customLutData: null,
  customLutSize: 33,
  importedLuts: [],
};

/** Built-in .cube LUT presets (backed by files in /luts) */
export const BUILT_IN_CUBE_PRESETS = [
  { id: 'lut_1', name: 'Golden Hour' },
  { id: 'lut_2', name: 'Teal & Orange' },
  { id: 'lut_3', name: 'Bleach Bypass' },
  { id: 'lut_4', name: 'Faded Film' },
  { id: 'lut_5', name: 'Cold Steel' },
  { id: 'lut_6', name: 'Velvet Night' },
] as const;

/** Procedural LUT presets (generated in code) */
export const PROCEDURAL_PRESETS = [
  { id: 'procedural_7', name: 'Warm Sepia' },
  { id: 'procedural_8', name: 'Noir Contrast' },
  { id: 'procedural_9', name: 'Jungle Green' },
  { id: 'procedural_10', name: 'Cyberpunk Neon' },
] as const;

export const ALL_LUT_PRESETS = [...BUILT_IN_CUBE_PRESETS, ...PROCEDURAL_PRESETS];

export const BUILT_IN_LUT_CARDS = ALL_LUT_PRESETS.map(p => ({
  name: p.name,
  params: { activeLutPresetId: p.id },
}));

export function flattenLutData(lutData: LutData): { data: number[]; size: number } {
  const resampled = LutEngine.resampleLut33(lutData);
  const size = resampled.size;
  const flattened = new Float32Array(size * size * size * 3);
  let idx = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const val = resampled.table[b][g][r];
        flattened[idx++] = val[0];
        flattened[idx++] = val[1];
        flattened[idx++] = val[2];
      }
    }
  }
  return { data: Array.from(flattened), size };
}

export function parseCubeFileResult(result: string | { content: string; name?: string }): {
  content: string;
  name: string;
} {
  if (typeof result === 'string') {
    return { content: result, name: 'Imported LUT' };
  }
  return {
    content: result.content,
    name: result.name || 'Imported LUT',
  };
}

export function importCubeContent(
  cubeContent: string,
  fileName: string,
  existingImported: ImportedLut[]
): { lutState: Partial<LutState>; importedLut: ImportedLut } {
  const lutData = LutEngine.parseLut(cubeContent);
  const { data, size } = flattenLutData(lutData);
  const baseName = fileName.replace(/\.cube$/i, '');
  const importedLut: ImportedLut = {
    id: `imported_${Date.now()}`,
    name: baseName,
    data,
    size,
  };
  return {
    importedLut,
    lutState: {
      importedLuts: [...existingImported, importedLut],
      activeLutPresetId: importedLut.id,
      customLutData: data,
      customLutSize: size,
    },
  };
}

export function getLutDisplayName(
  activeLutPresetId: string | null,
  importedLuts: ImportedLut[]
): string {
  if (!activeLutPresetId) return '';
  if (activeLutPresetId === 'custom') return 'Custom Imported LUT';
  const imported = importedLuts.find(l => l.id === activeLutPresetId);
  if (imported) return imported.name;
  const preset = ALL_LUT_PRESETS.find(p => p.id === activeLutPresetId);
  return preset ? preset.name : 'Active LUT';
}
