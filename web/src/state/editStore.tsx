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
import { loadVideoFromFile, revokeVideoUrl } from '../lib/videoIO';

type MediaKind = 'image' | 'video' | null;

type Store = {
  params: EditParams;
  setParam: <K extends keyof EditParams>(key: K, value: EditParams[K]) => void;
  patchParams: (partial: Partial<EditParams>) => void;
  resetParams: () => void;
  imageBitmap: ImageBitmap | null;
  blendBitmap: ImageBitmap | null;
  mediaKind: MediaKind;
  hasMedia: boolean;
  hasImage: boolean;
  videoEl: HTMLVideoElement | null;
  videoObjectUrl: string | null;
  videoDuration: number;
  videoWidth: number;
  videoHeight: number;
  colorSpace: 'rec709';
  error: string | null;
  setError: (msg: string | null) => void;
  openMedia: (file: File) => Promise<void>;
  openImage: (file: File) => Promise<void>;
  openBlendImage: (file: File) => Promise<void>;
  clearVideo: () => void;
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
  const [mediaKind, setMediaKind] = useState<MediaKind>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);

  const clearVideo = useCallback(() => {
    setVideoEl((prev) => {
      prev?.pause();
      return null;
    });
    setVideoObjectUrl((prev) => {
      revokeVideoUrl(prev);
      return null;
    });
    setVideoDuration(0);
    setVideoWidth(0);
    setVideoHeight(0);
    setMediaKind((prev) => (prev === 'video' ? null : prev));
  }, []);

  useEffect(() => {
    return () => {
      revokeVideoUrl(videoObjectUrl);
    };
  }, [videoObjectUrl]);

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

  const openMedia = useCallback(async (file: File) => {
    let pendingVideoUrl: string | null = null;
    try {
      clearVideo();
      setImageBitmap((prev) => {
        prev?.close();
        return null;
      });
      setMediaKind(null);
      setParams(cloneDefaultParams());
      clearBlend();
      clearLut();

      const isVideo =
        file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);

      if (isVideo) {
        const loaded = await loadVideoFromFile(file);
        pendingVideoUrl = loaded.objectUrl;
        setVideoEl(loaded.video);
        setVideoObjectUrl(loaded.objectUrl);
        setVideoDuration(loaded.duration);
        setVideoWidth(loaded.width);
        setVideoHeight(loaded.height);
        setMediaKind('video');
        pendingVideoUrl = null;
      } else {
        const bmp = await loadImageFromFile(file);
        setImageBitmap(bmp);
        setMediaKind('image');
      }
      setError(null);
    } catch (e) {
      revokeVideoUrl(pendingVideoUrl);
      setError(e instanceof Error ? e.message : 'Could not open that file.');
    }
  }, [clearBlend, clearLut, clearVideo]);

  const openImage = useCallback(async (file: File) => {
    await openMedia(file);
  }, [openMedia]);

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

  const hasImage = !!imageBitmap;
  const hasMedia = hasImage || mediaKind === 'video';

  const value = useMemo(
    () => ({
      params,
      setParam,
      patchParams,
      resetParams,
      imageBitmap,
      blendBitmap,
      mediaKind,
      hasMedia,
      hasImage,
      videoEl,
      videoObjectUrl,
      videoDuration,
      videoWidth,
      videoHeight,
      colorSpace: 'rec709' as const,
      error,
      setError,
      openMedia,
      openImage,
      openBlendImage,
      clearVideo,
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
      mediaKind, hasMedia, hasImage, videoEl, videoObjectUrl, videoDuration,
      videoWidth, videoHeight, error, openMedia, openImage, openBlendImage,
      clearVideo, clearBlend, section, filmSub, presetLuts, presetsLoading,
      importedLuts, activeLutId, activeLutData, importLutFile, selectLut, removeLut,
    ],
  );

  return <EditCtx.Provider value={value}>{children}</EditCtx.Provider>;
}

export function useEditStore() {
  const ctx = useContext(EditCtx);
  if (!ctx) throw new Error('useEditStore outside provider');
  return ctx;
}
