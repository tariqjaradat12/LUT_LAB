import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type EditParams, type FilmSubTab, type ToolSection } from '../engine/types';
import { type ImportedLut, importCubeContent } from '../engine/lutEngine';
import { buildAllFilmPresets } from '../engine/filmSimulations';
import { loadImageFromFile } from '../lib/imageIO';
import { cloneDefaultParams } from '../lib/params';

type Store = {
  params: EditParams;
  setParam: <K extends keyof EditParams>(key: K, value: EditParams[K]) => void;
  patchParams: (partial: Partial<EditParams>) => void;
  resetParams: () => void;
  imageBitmap: ImageBitmap | null;
  blendBitmap: ImageBitmap | null;
  hasImage: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
  openImage: (file: File) => Promise<void>;
  openBlendImage: (file: File) => Promise<void>;
  clearBlend: () => void;
  section: ToolSection;
  setSection: (s: ToolSection) => void;
  filmSub: FilmSubTab;
  setFilmSub: (s: FilmSubTab) => void;
  presetLuts: ImportedLut[];
  presetsLoading: boolean;
  importedLuts: ImportedLut[];
  activeLutId: string | null;
  activeLutData: Float32Array | null;
  importLutFile: (file: File) => Promise<void>;
  selectLut: (id: string | null) => void;
  removeLut: (id: string) => void;
};

const EditCtx = createContext<Store | null>(null);

function findLutData(
  id: string | null,
  presetLuts: ImportedLut[],
  importedLuts: ImportedLut[],
): Float32Array | null {
  if (!id) return null;
  return (
    presetLuts.find((l) => l.id === id)?.data ??
    importedLuts.find((l) => l.id === id)?.data ??
    null
  );
}

export function EditProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<EditParams>(() => cloneDefaultParams());
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [blendBitmap, setBlendBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<ToolSection>('light');
  const [filmSub, setFilmSub] = useState<FilmSubTab>('halation');
  const [presetLuts, setPresetLuts] = useState<ImportedLut[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [importedLuts, setImportedLuts] = useState<ImportedLut[]>([]);
  const [activeLutId, setActiveLutId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Yield so first paint isn't blocked by 17×33³ LUT builds
    const timer = window.setTimeout(() => {
      try {
        const loaded = buildAllFilmPresets();
        if (!cancelled) setPresetLuts(loaded);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not build film presets.');
        }
      } finally {
        if (!cancelled) setPresetsLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const activeLutData = useMemo(
    () => findLutData(activeLutId, presetLuts, importedLuts),
    [activeLutId, presetLuts, importedLuts],
  );

  const setParam = useCallback(<K extends keyof EditParams>(key: K, value: EditParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const patchParams = useCallback((partial: Partial<EditParams>) => {
    setParams((p) => ({ ...p, ...partial }));
  }, []);

  const clearBlend = useCallback(() => {
    setBlendBitmap((prev) => {
      prev?.close();
      return null;
    });
    setParams((p) => ({ ...p, doubleExposureEnabled: false }));
  }, []);

  const clearLut = useCallback(() => {
    setActiveLutId(null);
    setParams((p) => ({
      ...p,
      lutIntensity: 100,
      lutColorOffset: 0,
      lutToneOffset: 0,
    }));
  }, []);

  const resetParams = useCallback(() => {
    setParams(cloneDefaultParams());
    clearBlend();
    clearLut();
  }, [clearBlend, clearLut]);

  const openImage = useCallback(async (file: File) => {
    try {
      const bmp = await loadImageFromFile(file);
      setImageBitmap((prev) => {
        prev?.close();
        return bmp;
      });
      setParams(cloneDefaultParams());
      clearBlend();
      clearLut();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that file.');
    }
  }, [clearBlend, clearLut]);

  const openBlendImage = useCallback(async (file: File) => {
    try {
      const bmp = await loadImageFromFile(file);
      setBlendBitmap((prev) => {
        prev?.close();
        return bmp;
      });
      setParams((p) => ({ ...p, doubleExposureEnabled: true }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open blend photo.');
    }
  }, []);

  const importLutFile = useCallback(async (file: File) => {
    try {
      const content = await file.text();
      const { lut, importedLuts: next } = importCubeContent(
        content,
        file.name,
        importedLuts,
      );
      setImportedLuts(next);
      setActiveLutId(lut.id);
      setParams((p) => ({
        ...p,
        lutIntensity: 100,
        lutColorOffset: 0,
        lutToneOffset: 0,
      }));
      setSection('luts');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse that LUT file.');
    }
  }, [importedLuts]);

  const selectLut = useCallback((id: string | null) => {
    if (id === activeLutId) {
      clearLut();
      return;
    }
    setActiveLutId(id);
    if (id) {
      setParams((p) => ({
        ...p,
        lutIntensity: 100,
        lutColorOffset: 0,
        lutToneOffset: 0,
      }));
    }
  }, [activeLutId, clearLut]);

  const removeLut = useCallback((id: string) => {
    if (id.startsWith('preset_')) return;
    setImportedLuts((prev) => prev.filter((l) => l.id !== id));
    if (activeLutId === id) clearLut();
  }, [activeLutId, clearLut]);

  const value = useMemo(
    () => ({
      params,
      setParam,
      patchParams,
      resetParams,
      imageBitmap,
      blendBitmap,
      hasImage: !!imageBitmap,
      error,
      setError,
      openImage,
      openBlendImage,
      clearBlend,
      section,
      setSection,
      filmSub,
      setFilmSub,
      presetLuts,
      presetsLoading,
      importedLuts,
      activeLutId,
      activeLutData,
      importLutFile,
      selectLut,
      removeLut,
    }),
    [
      params, setParam, patchParams, resetParams, imageBitmap, blendBitmap,
      error, openImage, openBlendImage, clearBlend, section, filmSub,
      presetLuts, presetsLoading, importedLuts, activeLutId, activeLutData,
      importLutFile, selectLut, removeLut,
    ],
  );

  return <EditCtx.Provider value={value}>{children}</EditCtx.Provider>;
}

export function useEditStore() {
  const ctx = useContext(EditCtx);
  if (!ctx) throw new Error('useEditStore outside provider');
  return ctx;
}
