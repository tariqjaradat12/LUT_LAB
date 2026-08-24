export type LutPresetDef = {
  id: string;
  name: string;
  file: string;
};

export const BUILTIN_LUT_PRESETS: LutPresetDef[] = [
  { id: 'preset_filmmic', name: 'Filmmic', file: 'filmmic.cube' },
  { id: 'preset_t_and_o', name: 'T&O', file: 't-and-o.cube' },
  { id: 'preset_smoky_color', name: 'Smoky Color', file: 'smoky-color.cube' },
  { id: 'preset_sunset_hour', name: 'Sunset Hour', file: 'sunset-hour.cube' },
  { id: 'preset_teal_flat', name: 'Teal Flat', file: 'teal-flat.cube' },
  { id: 'preset_backlight', name: 'Backlight', file: 'backlight.cube' },
];

export function presetCubeUrl(file: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}luts/${file}`;
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
