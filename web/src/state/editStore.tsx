import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type EditParams, type FilmSubTab, type ToolSection } from '../engine/types';
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
};

const EditCtx = createContext<Store | null>(null);

export function EditProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<EditParams>(() => cloneDefaultParams());
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [blendBitmap, setBlendBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<ToolSection>('light');
  const [filmSub, setFilmSub] = useState<FilmSubTab>('halation');

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

  const resetParams = useCallback(() => {
    setParams(cloneDefaultParams());
    clearBlend();
  }, [clearBlend]);

  const openImage = useCallback(async (file: File) => {
    try {
      const bmp = await loadImageFromFile(file);
      setImageBitmap((prev) => {
        prev?.close();
        return bmp;
      });
      setParams(cloneDefaultParams());
      clearBlend();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that file.');
    }
  }, [clearBlend]);

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
    }),
    [
      params, setParam, patchParams, resetParams, imageBitmap, blendBitmap,
      error, openImage, openBlendImage, clearBlend, section, filmSub,
    ],
  );

  return <EditCtx.Provider value={value}>{children}</EditCtx.Provider>;
}

export function useEditStore() {
  const ctx = useContext(EditCtx);
  if (!ctx) throw new Error('useEditStore outside provider');
  return ctx;
}
