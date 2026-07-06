import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  TouchableOpacity, Switch, TextInput, Alert, ActivityIndicator,
  NativeModules, Platform, useWindowDimensions,
} from 'react-native';

import {
  EditParams, DEFAULT_EDIT_PARAMS,
  HueBand, Point2D, ControlPoint, LutMask,
} from '../core/engine/EditingEngine';
import { LutEngine } from '../core/engine/LutEngine';
import { VideoRenderingEngine } from '../core/engine/VideoRenderingEngine';
import { LogFormat } from '../core/engine/ColorGradingEngine';
import { ThemeName, getThemeStyles } from '../core/theme';

import { PreviewCanvas, PositionalTool } from '../components/editor/PreviewCanvas';
import { CategoryTabBar, ToolCategory, CATEGORY_ACCENT } from '../components/editor/CategoryTabBar';
import { ToolSlider } from '../components/editor/ToolSlider';
import { CurvesEditor } from '../components/editor/CurvesEditor';
import { HSLPanel } from '../components/editor/HSLPanel';
import { GradientEditor } from '../components/editor/GradientEditor';
import { LutState, BUILT_IN_LUT_CARDS, getLutDisplayName } from '../core/presets/LutPresets';

const { MediaPicker } = NativeModules;

// ─── Stable Static Formatters for ToolSliders ─────────────────────────────────
const formatEV = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} EV`;
const formatPercent = (v: number) => `${Math.round(v * 100)}%`;
const formatDegree = (v: number) => `${v >= 0 ? '+' : ''}${v}°`;
const formatTemp = (v: number) => v < 0 ? `${v}K` : v > 0 ? `+${v}K` : '0';

interface EditStudioProps {
  mediaUri: string | null;
  logFormat: LogFormat;
  externalPreset: { params: Partial<EditParams>; name: string } | null;
  onClearExternalPreset: () => void;
  onShareToCommunity: (title: string, authorName: string, params: EditParams) => void;
  isActive: boolean;
  theme: ThemeName;
  customAccentColor: string;
  communityDeck: Array<{ name: string; params: Partial<EditParams>; color?: string }>;
  onAddLutToDeck: (name: string, params: Partial<EditParams>) => void;
  wallpaperActive: boolean;
  lutState: LutState;
  onLutStateChange: (patch: Partial<LutState>) => void;
  params: EditParams;
  setParams: React.Dispatch<React.SetStateAction<EditParams>>;
}

export const EditStudio: React.FC<EditStudioProps> = ({
  mediaUri,
  logFormat,
  externalPreset,
  onClearExternalPreset,
  onShareToCommunity,
  isActive,
  theme,
  customAccentColor,
  communityDeck,
  onAddLutToDeck,
  wallpaperActive,
  lutState,
  onLutStateChange,
  params,
  setParams,
}) => {
  const [historyStack, setHistoryStack] = useState<EditParams[]>([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('light');
  const [activeControlPointId, setActiveControlPointId] = useState<string | null>(null);
  const [positionalTool, setPositionalTool] = useState<PositionalTool>(null);
  const [activeFxSubTab, setActiveFxSubTab] = useState<'vignette' | 'grain' | 'halation' | 'bokeh' | 'longexposure' | 'watermark'>('vignette');
  const [brushEraseMode, setBrushEraseMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [btnStepSize, setBtnStepSize] = useState<1 | 2 | 5 | 10>(1);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  // Creative Panel states
  const [lutTitle, setLutTitle] = useState('MyPreset');
  const [publishTitle, setPublishTitle] = useState('SunsetVibe');
  const [isRendering, setIsRendering] = useState(false);
  const [authorName, setAuthorName] = useState('Anonymous');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const loadAuthor = async () => {
      try {
        const name = await NativeModules.LutShare.loadState('author_name');
        if (name) setAuthorName(name);
      } catch (e) {}
    };
    loadAuthor();
  }, []);

  // Watermark local states
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkDevice, setWatermarkDevice] = useState('Google Pixel 9 Pro');
  const [watermarkBorderColor, setWatermarkBorderColor] = useState<'none' | 'white' | 'black'>('none');

  // Hue spectrum local state
  const [hueVal, setHueVal] = useState(250);

  // Shuffling states
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffledCardName, setShuffledCardName] = useState<string | null>(null);

  const accent = customAccentColor || CATEGORY_ACCENT[activeCategory] || '#6366F1';
  const fullDeck = [...BUILT_IN_LUT_CARDS, ...communityDeck];

  const mergedParams = React.useMemo<EditParams>(() => ({
    ...params,
    activeLutPresetId: lutState.activeLutPresetId,
    lutIntensity: lutState.lutIntensity,
    lutColorOffset: lutState.lutColorOffset,
    lutToneOffset: lutState.lutToneOffset,
    customLutData: lutState.customLutData,
    customLutSize: lutState.customLutSize,
    importedLuts: lutState.importedLuts,
  }), [params, lutState]);

  // Apply community-shared LUTs
  useEffect(() => {
    if (externalPreset) {
      setParams(prev => ({ ...prev, ...externalPreset.params }));
      onLutStateChange({
        activeLutPresetId: externalPreset.params.activeLutPresetId ?? null,
        lutIntensity: externalPreset.params.lutIntensity ?? lutState.lutIntensity,
        lutColorOffset: externalPreset.params.lutColorOffset ?? 0,
        lutToneOffset: externalPreset.params.lutToneOffset ?? 0,
        customLutData: externalPreset.params.customLutData ?? null,
        customLutSize: externalPreset.params.customLutSize ?? 33,
      });
      onClearExternalPreset();
    }
  }, [externalPreset, onClearExternalPreset]);



  const startShuffleAnimation = () => {
    if (fullDeck.length === 0) return;
    setIsShuffling(true);
    setShuffledCardName("Shuffling...");
    
    let count = 0;
    const interval = setInterval(() => {
      const tempIdx = Math.floor(Math.random() * fullDeck.length);
      setShuffledCardName(fullDeck[tempIdx].name);
      count++;
      
      if (count > 15) {
        clearInterval(interval);
        const finalIdx = Math.floor(Math.random() * fullDeck.length);
        const chosen = fullDeck[finalIdx];
        setShuffledCardName(chosen.name);
        setParams(prev => ({ ...prev, ...chosen.params }));
        if (chosen.params.activeLutPresetId) {
          onLutStateChange({
            activeLutPresetId: chosen.params.activeLutPresetId,
            customLutData: (chosen.params as any).customLutData ?? null,
            customLutSize: (chosen.params as any).customLutSize ?? 33,
          });
        }
        setIsShuffling(false);
        Alert.alert('Shuffle Draw!', `Selected and applied: "${chosen.name}"`);
      }
    }, 100);
  };

  // Set active positional tool based on active category
  useEffect(() => {
    if (activeCategory === 'effects') {
      if (activeFxSubTab === 'watermark') {
        setPositionalTool(null);
      } else {
        setPositionalTool(activeFxSubTab);
      }
    } else if (activeCategory === 'overlays') {
      const activeMask = params.masks.find(m => m.id === params.activeMaskId);
      if (activeMask) {
        if (activeMask.type === 'linear') {
          setPositionalTool('lineargradient');
        } else if (activeMask.type === 'radial') {
          setPositionalTool('circulargradient');
        } else if (activeMask.type === 'brush') {
          setPositionalTool('brush' as any);
        } else {
          setPositionalTool(null);
        }
      } else {
        setPositionalTool(null);
      }
    } else {
      setPositionalTool(null);
    }
  }, [activeCategory, params.activeMaskId, params.masks, activeFxSubTab]);

  const captureHistory = useCallback(() => {
    setParams(current => {
      setHistoryStack(h => [...h.slice(-19), current]);
      return current;
    });
  }, []);

  // Stable callbacks for parameter updates
  const update = useCallback((key: keyof EditParams, val?: any) => {
    if (val === undefined) return;
    setParams(prev => ({ ...prev, [key]: val }));
  }, []);

  const updateCrop = useCallback((key: any, val?: number) => {
    if (val === undefined) return;
    setParams(prev => ({ ...prev, crop: { ...prev.crop, [key]: val } }));
  }, []);

  const updateDoubleExposureOffset = useCallback((key: any, val?: number) => {
    if (val === undefined) return;
    setParams(prev => ({ ...prev, doubleExposureOffset: { ...prev.doubleExposureOffset, [key]: val } }));
  }, []);

  const updateBwMix = useCallback((band: any, val?: number) => {
    if (val === undefined) return;
    setParams(prev => ({ ...prev, bwMix: { ...prev.bwMix, [band]: val } }));
  }, []);

  const updateActiveCp = useCallback((field: any, val?: number) => {
    if (!activeControlPointId || val === undefined) return;
    setParams(prev => {
      const updated = prev.controlPoints.map(c =>
        c.id === activeControlPointId ? { ...c, [field]: val } : c
      );
      return { ...prev, controlPoints: updated };
    });
  }, [activeControlPointId]);

  const undo = useCallback(() => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setParams(prev);
    setHistoryStack(h => h.slice(0, -1));
  }, [historyStack]);

  const resetCategory = useCallback(() => {
    setParams(prev => {
      const defaults = DEFAULT_EDIT_PARAMS;
      setHistoryStack(h => [...h.slice(-19), prev]);
      
      switch (activeCategory) {
        case 'light':
          return {
            ...prev,
            exposure: defaults.exposure,
            brightness: defaults.brightness,
            contrast: defaults.contrast,
            highlights: defaults.highlights,
            shadows: defaults.shadows,
            toneContrast: defaults.toneContrast,
            dehaze: defaults.dehaze,
            hdrStrength: defaults.hdrStrength,
          };
        case 'color':
          return {
            ...prev,
            temperature: defaults.temperature,
            tint: defaults.tint,
            saturation: defaults.saturation,
            vibrance: defaults.vibrance,
            hue: defaults.hue,
            bwEnabled: defaults.bwEnabled,
            bwMix: { ...defaults.bwMix },
          };
        case 'curves':
          return { ...prev, curves: { ...defaults.curves } };
        case 'hsl':
          return { ...prev, hsl: { ...defaults.hsl } };
        case 'wheels':
          return {
            ...prev,
            colorWheels: {
              shadows: { ...defaults.colorWheels.shadows },
              midtones: { ...defaults.colorWheels.midtones },
              highlights: { ...defaults.colorWheels.highlights },
            },
          };
        case 'geometry':
          return {
            ...prev,
            crop: { ...defaults.crop },
            zoomScale: defaults.zoomScale,
            zoomX: defaults.zoomX,
            zoomY: defaults.zoomY,
            perspectiveVertical: defaults.perspectiveVertical,
            perspectiveHorizontal: defaults.perspectiveHorizontal,
            perspectiveAspect: defaults.perspectiveAspect,
            perspectiveRotate: defaults.perspectiveRotate,
          };
        case 'detail':
          return {
            ...prev,
            sharpen: defaults.sharpen,
            definition: defaults.definition,
            softness: defaults.softness,
            denoiseLuminance: defaults.denoiseLuminance,
            denoiseColor: defaults.denoiseColor,
          };
        case 'effects':
          return {
            ...prev,
            vignetteStrength: defaults.vignetteStrength,
            vignetteRadius: defaults.vignetteRadius,
            vignetteSoftness: defaults.vignetteSoftness,
            vignetteCenter: { ...defaults.vignetteCenter },
            grainAmount: defaults.grainAmount,
            grainSize: defaults.grainSize,
            grainRoughness: defaults.grainRoughness,
            grainMask: { ...defaults.grainMask },
            halationStrength: defaults.halationStrength,
            halationRadius: defaults.halationRadius,
            halationColor: defaults.halationColor,
            halationCenter: { ...defaults.halationCenter },
            bokehStrength: defaults.bokehStrength,
            bokehRadius: defaults.bokehRadius,
            bokehShape: defaults.bokehShape,
            bokehCenter: { ...defaults.bokehCenter },

          };
        case 'overlays':
          return {
            ...prev,
            doubleExposureEnabled: defaults.doubleExposureEnabled,
            doubleExposureOpacity: defaults.doubleExposureOpacity,
            doubleExposureOffset: { ...defaults.doubleExposureOffset },
            doubleExposureBlend: defaults.doubleExposureBlend,
            doubleExposureUri: defaults.doubleExposureUri,
            linearGradient: { ...defaults.linearGradient },
            circularGradient: { ...defaults.circularGradient },
            gradientExposure: defaults.gradientExposure,
            gradientSaturation: defaults.gradientSaturation,
            gradientTemperature: defaults.gradientTemperature,
          };
        default:
          return prev;
      }
    });
  }, [activeCategory]);

  const lockScroll = useCallback(() => {
    setScrollEnabled(false);
    captureHistory();
  }, [captureHistory]);

  const unlockScroll = useCallback(() => setScrollEnabled(true), []);

  const handleExportMedia = async () => {
    const { VideoExporter } = NativeModules;
    if (!VideoExporter) {
      Alert.alert('Not Supported', 'VideoExporter native module is not available.');
      return;
    }
    
    const isVideo = !!mediaUri && !(
      mediaUri.toLowerCase().endsWith('.jpg') ||
      mediaUri.toLowerCase().endsWith('.jpeg') ||
      mediaUri.toLowerCase().endsWith('.png') ||
      mediaUri.toLowerCase().endsWith('.webp') ||
      mediaUri.toLowerCase().endsWith('.heic') ||
      mediaUri.toLowerCase().includes('image')
    );

    setIsRendering(true);
    const wasPaused = paused;
    if (isVideo) {
      setPaused(true);
    }

    try {
      if (isVideo) {
        const path = await VideoExporter.exportGradedVideo(watermarkEnabled, watermarkDevice, watermarkBorderColor, false);
        Alert.alert('Export Success', `Full resolution graded video saved to Downloads folder:\n${path}`);
      } else {
        const path = await VideoExporter.exportGradedImage(watermarkEnabled, watermarkDevice, watermarkBorderColor, false);
        Alert.alert('Export Success', `Full resolution graded image saved to Downloads folder:\n${path}`);
      }
    } catch (err: any) {
      Alert.alert('Export Failure', err.message || 'An error occurred during offscreen GPU export.');
    } finally {
      setIsRendering(false);
      if (isVideo && !wasPaused) {
        setPaused(false);
      }
    }
  };

  // Native File Picker for Double Exposure
  const handlePickDoubleExposureImage = async () => {
    if (!MediaPicker) {
      Alert.alert('Not Supported', 'MediaPicker native module is not available.');
      return;
    }
    try {
      const selectedUri = await MediaPicker.pickMedia();
      update('doubleExposureUri', selectedUri);
      Alert.alert('Success', 'Secondary blend photo imported successfully!');
    } catch (e: any) {
      if (e.message !== 'Selection canceled' && e.code !== 'PICKER_CANCELED') {
        Alert.alert('Error', e.message || 'Failed to select image.');
      }
    }
  };

  // Compile Current Grade into DaVinci/Premiere LUT (.cube)
  const handleCompileLut = () => {
    try {
      const lutString = LutEngine.compileLut(logFormat, mergedParams, lutTitle);
      Alert.alert(
        'LUT Compiled!',
        `Grade baked successfully into 33x33x33 .cube space. Ready to export.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share LUT',
            onPress: async () => {
              const { LutShare } = NativeModules;
              if (LutShare) {
                try {
                  await LutShare.shareLut(`${lutTitle}.cube`, lutString);
                } catch (err: any) {
                  Alert.alert('Share Error', err.message);
                }
              } else {
                Alert.alert('Simulation', `Export complete: ${lutTitle}.cube`);
              }
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to compile LUT.');
    }
  };

  // Publish preset to Community Gallery
  const handlePublish = async () => {
    if (!publishTitle.trim()) {
      Alert.alert('Validation Failed', 'Please input a title for your preset.');
      return;
    }
    if (!authorName.trim()) {
      Alert.alert('Validation Failed', 'Please input your name to publish.');
      return;
    }
    try {
      await NativeModules.LutShare.saveState('author_name', authorName.trim());
    } catch (e) {}
    onShareToCommunity(publishTitle, authorName.trim(), mergedParams);
  };

  const handleShareCurrentLut = async () => {
    const cleanAuthorName = authorName.trim();
    if (!cleanAuthorName) {
      Alert.alert('Name Required', 'Enter your creator name before sharing this LUT.');
      return;
    }

    try {
      await NativeModules.LutShare.saveState('author_name', cleanAuthorName);
    } catch (e) {}

    const currentLutName = getLutDisplayName(lutState.activeLutPresetId, lutState.importedLuts);
    const baseTitle = currentLutName || lutTitle.trim() || 'Custom LUT';
    const suffix = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(/\s/g, '');
    onShareToCommunity(`${baseTitle} ${suffix}`, cleanAuthorName, mergedParams);
    setSharePanelOpen(false);
  };

  // Render lossless video export session
  const handleExportVideo = async () => {
    setIsRendering(true);
    try {
      const frames = [
        { color: '#10B981', durationMs: 1500 },
        { color: '#6366F1', durationMs: 1500 },
        { color: '#EF4444', durationMs: 1500 },
      ];
      const resultPath = await VideoRenderingEngine.renderAndExport(
        'graded_export.mp4', 1920, 1080, 30, frames
      );
      Alert.alert('Export Success', `Lossless graded render saved to: ${resultPath}`);
    } catch (err: any) {
      Alert.alert('Render Failure', err.message || 'An error occurred during GPU compile export.');
    } finally {
      setIsRendering(false);
    }
  };

  // Control points subpanel logic
  const handleAddControlPoint = () => {
    const newCp: ControlPoint = {
      id: `cp_${Date.now()}`,
      x: 0.5,
      y: 0.5,
      radius: 0.25,
      brightness: 0,
      contrast: 0,
      structure: 0,
      saturation: 0,
      temperature: 0,
      targetColor: [0.5, 0.5, 0.5],
      enabled: true,
    };
    update('controlPoints', [...params.controlPoints, newCp]);
    setActiveControlPointId(newCp.id);
  };

  const handleDeleteControlPoint = (id: string) => {
    const filtered = params.controlPoints.filter(c => c.id !== id);
    update('controlPoints', filtered);
    if (activeControlPointId === id) {
      setActiveControlPointId(null);
    }
  };

  const handleAddMask = (type: 'linear' | 'radial' | 'brush') => {
    const newMask: LutMask = {
      id: `mask_${Date.now()}`,
      name: `${type.toUpperCase()} Mask #${params.masks.filter(m => m.type === type).length + 1}`,
      type,
      enabled: true,
      inverted: false,
      x1: type === 'linear' ? 0.25 : 0.5,
      y1: type === 'linear' ? 0.25 : 0.5,
      x2: type === 'linear' ? 0.75 : 0.35,
      y2: type === 'linear' ? 0.75 : 0.35,
      feather: type === 'brush' ? 0.03 : 0.3,
      exposure: 0.0,
      contrast: 0.0,
      saturation: 0.0,
      temperature: 0.0,
      intensity: 100.0,
    };
    update('masks', [...params.masks, newMask]);
    update('activeMaskId', newMask.id);
  };

  const handleDeleteMask = (id: string) => {
    const filtered = params.masks.filter(m => m.id !== id);
    update('masks', filtered);
    if (params.activeMaskId === id) {
      update('activeMaskId', null);
    }
  };

  const updateActiveMask = useCallback((field: string, val: any) => {
    setParams(prev => {
      if (!prev.activeMaskId) return prev;
      const updated = prev.masks.map(m =>
        m.id === prev.activeMaskId ? { ...m, [field]: val } : m
      );
      return { ...prev, masks: updated };
    });
  }, []);

  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const stylesObj = getThemeStyles(theme, wallpaperActive);
  const isDark = theme !== 'light';

  const primaryText = stylesObj.primaryText;
  const secondaryText = stylesObj.secondaryText;
  const bgTheme = stylesObj.containerBg;
  const cardTheme = stylesObj.surfaceBgSolid;
  const borderTheme = stylesObj.borderColor;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgTheme }]}>
      <View style={[styles.header, { backgroundColor: stylesObj.headerBg, borderBottomColor: borderTheme }]}>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Studio</Text>
      </View>

      <View style={{ flex: 1, flexDirection: isLargeScreen ? 'row' : 'column' }}>
        
        {/* Left Column (Canvas & Action Bar) */}
        <View style={isLargeScreen ? { flex: 1.2, borderRightWidth: 1, borderRightColor: borderTheme } : null}>
          {isActive ? (
            <PreviewCanvas
              params={mergedParams}
              positionalTool={positionalTool}
              activeControlPointId={activeControlPointId}
              setActiveControlPointId={setActiveControlPointId}
              onParamsChange={setParams}
              mediaUri={mediaUri}
              logFormat={logFormat}
              brushEraseMode={brushEraseMode}
              paused={paused}
              setPaused={setPaused}
              onInteractionStart={lockScroll}
              onInteractionEnd={unlockScroll}
              theme={theme === 'light' ? 'light' : 'dark'}
              customAccentColor={accent}
            />
          ) : (
            <View style={{ height: 340, backgroundColor: '#000', borderRadius: 16, marginBottom: 4, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={accent} />
            </View>
          )}

          {/* Universal Action Bar */}
          <View style={[styles.actionBar, { backgroundColor: stylesObj.headerBg, borderColor: borderTheme }]}>
            <TouchableOpacity
              style={[styles.actionBarBtn, historyStack.length === 0 && styles.btnDisabled]}
              onPress={undo}
              disabled={historyStack.length === 0}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionBarBtnText, { color: accent }]}>↩ Undo</Text>
            </TouchableOpacity>
            <View style={[styles.actionBarDivider, { backgroundColor: borderTheme }]} />
            <TouchableOpacity style={styles.actionBarBtn} onPress={resetCategory} activeOpacity={0.7}>
              <Text style={[styles.actionBarBtnText, { color: accent }]}>↺ Reset Tab</Text>
            </TouchableOpacity>
            <View style={[styles.actionBarDivider, { backgroundColor: borderTheme }]} />
            <TouchableOpacity style={[styles.actionBarBtn, styles.actionBarExport, { backgroundColor: '#10B981' }]} onPress={handleExportMedia} activeOpacity={0.7}>
              <Text style={[styles.actionBarBtnText, { color: '#000000', fontWeight: '800' }]}>↑ Export</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Column (Tabs + panel contents) */}
        <View style={{ flex: 1 }}>
          <CategoryTabBar
            active={activeCategory}
            onSelect={cat => {
              setSharePanelOpen(false);
              setActiveCategory(cat);
            }}
            onSharePress={() => setSharePanelOpen(true)}
            shareActive={sharePanelOpen}
            customAccentColor={accent}
            theme={theme === 'light' ? 'light' : 'dark'}
          />

      {/* Main Adjustment Panel */}
      <ScrollView
        ref={scrollViewRef}
        style={[styles.panel, { backgroundColor: bgTheme }]}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepSizeRow}>
          <Text style={styles.stepSizeLabel}>Press Step Size:</Text>
          <View style={styles.stepSizeOptions}>
            {([1, 2, 5, 10] as const).map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.stepSizeBtn, btnStepSize === s && { backgroundColor: accent, borderColor: accent }]}
                onPress={() => setBtnStepSize(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.stepSizeBtnText, btnStepSize === s && { color: '#000000', fontWeight: 'bold' }]}>{s}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {sharePanelOpen && (
          <View style={[styles.panelCard, { borderColor: '#10B981' }]}>
            <Text style={styles.panelCardTitle}>Share Current LUT</Text>
            <Text style={styles.panelCardDesc}>
              Publish the exact grade on this photo or video so the community can download and apply the same settings.
            </Text>
            <TextInput
              style={styles.cardInput}
              value={authorName}
              onChangeText={setAuthorName}
              placeholder="Creator name"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.actionBtnSolid, { backgroundColor: '#10B981' }]}
              onPress={handleShareCurrentLut}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnSolidText, { color: '#000000' }]}>Apply LUT to Community</Text>
            </TouchableOpacity>
          </View>
        )}

        {!sharePanelOpen && activeCategory === 'light' && (
          <View>
            <Text style={styles.sectionTitle}>Light Adjustments</Text>
            <ToolSlider sliderKey="exposure" label="Exposure" value={params.exposure} min={-4.0} max={4.0} defaultValue={0} step={0.05} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatEV} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="contrast" label="Contrast" value={params.contrast} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="highlights" label="Highlights" value={params.highlights} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="shadows" label="Shadows" value={params.shadows} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="brightness" label="Brightness" value={params.brightness} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="toneContrast" label="Tone Contrast" value={params.toneContrast} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="dehaze" label="Dehaze" value={params.dehaze} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="hdrStrength" label="HDR Boost" value={params.hdrStrength} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
          </View>
        )}

        {!sharePanelOpen && activeCategory === 'color' && (
          <View>
            <Text style={styles.sectionTitle}>Color Balance</Text>
            <ToolSlider sliderKey="temperature" label="Temp" value={params.temperature} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatTemp} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="tint" label="Tint" value={params.tint} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={v => v === 0 ? '0' : v < 0 ? `${v} Green` : `+${v} Magenta`} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="saturation" label="Saturation" value={params.saturation} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="vibrance" label="Vibrance" value={params.vibrance} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="hue" label="Hue Rotation" value={params.hue} min={-180} max={180} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatDegree} btnStepSize={btnStepSize} />

          </View>
        )}

        {!sharePanelOpen && activeCategory === 'curves' && (
          <View>
            <Text style={styles.sectionTitle}>Bezier Tone Curves</Text>
            <CurvesEditor curves={params.curves} onChange={c => update('curves', c)} onDragStart={lockScroll} onDragEnd={unlockScroll} />
          </View>
        )}

        {!sharePanelOpen && activeCategory === 'hsl' && (
          <View>
            <Text style={styles.sectionTitle}>8-Band HSL Tuning</Text>
            <HSLPanel hsl={params.hsl} onChange={h => update('hsl', h)} onDragStart={lockScroll} onDragEnd={unlockScroll} btnStepSize={btnStepSize} />
          </View>
        )}

        {!sharePanelOpen && activeCategory === 'geometry' && (
          <View>
            <Text style={styles.sectionTitle}>Perspective Alignment</Text>
            <ToolSlider sliderKey="perspectiveVertical" label="Vertical Perspective" value={params.perspectiveVertical} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="perspectiveHorizontal" label="Horizontal Perspective" value={params.perspectiveHorizontal} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="perspectiveAspect" label="Aspect Ratio Shift" value={params.perspectiveAspect} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="perspectiveRotate" label="Fine Angle Rotate" value={params.perspectiveRotate} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />

            <Text style={styles.sectionTitle}>Zoom & Pan</Text>
            <ToolSlider sliderKey="zoomScale" label="Zoom Scale" value={params.zoomScale ?? 1.0} min={1.0} max={5.0} defaultValue={1.0} step={0.1} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={(v) => `${v.toFixed(1)}x`} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="zoomX" label="Zoom Center X" value={params.zoomX ?? 0.5} min={0.0} max={1.0} defaultValue={0.5} step={0.01} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="zoomY" label="Zoom Center Y" value={params.zoomY ?? 0.5} min={0.0} max={1.0} defaultValue={0.5} step={0.01} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />

            <Text style={styles.sectionTitle}>Crop Boundaries</Text>
            <ToolSlider sliderKey="x" label="Crop Start X" value={params.crop.x} min={0.0} max={0.9} defaultValue={0} step={0.01} accentColor={accent} onValueChange={updateCrop} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="y" label="Crop Start Y" value={params.crop.y} min={0.0} max={0.9} defaultValue={0} step={0.01} accentColor={accent} onValueChange={updateCrop} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="width" label="Crop Width" value={params.crop.width} min={0.1} max={1.0} defaultValue={1.0} step={0.01} accentColor={accent} onValueChange={updateCrop} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="height" label="Crop Height" value={params.crop.height} min={0.1} max={1.0} defaultValue={1.0} step={0.01} accentColor={accent} onValueChange={updateCrop} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
          </View>
        )}

        {!sharePanelOpen && activeCategory === 'detail' && (
          <View>
            <Text style={styles.sectionTitle}>Detail Controls</Text>
            <ToolSlider sliderKey="sharpen" label="Sharpening" value={params.sharpen} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="definition" label="Definition (Clarity)" value={params.definition} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="softness" label="Softness" value={params.softness} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="denoiseLuminance" label="Luminance Noise Reduction" value={params.denoiseLuminance} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
            <ToolSlider sliderKey="denoiseColor" label="Color Noise Reduction" value={params.denoiseColor} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
          </View>
        )}

        {!sharePanelOpen && activeCategory === 'effects' && (
          <View>
            <Text style={styles.sectionTitle}>Physical Lens & Film FX</Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fxSubTabRow} style={styles.fxSubTabScroll}>
              {(['vignette', 'grain', 'halation', 'bokeh', 'longexposure', 'watermark'] as const).map(tab => {
                const isActive = activeFxSubTab === tab;
                const tabLabel = tab === 'longexposure' ? 'Long Exp' : tab.toUpperCase();
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.fxSubTab,
                      isActive && { backgroundColor: accent, borderColor: accent }
                    ]}
                    onPress={() => setActiveFxSubTab(tab)}
                  >
                    <Text style={[styles.fxSubTabText, isActive && { color: '#000' }]}>
                      {tabLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeFxSubTab === 'vignette' && (
              <View>
                <Text style={styles.subSectionTitle}>Vignette Mask</Text>
                <ToolSlider sliderKey="vignetteStrength" label="Vignette Strength" value={params.vignetteStrength} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                <ToolSlider sliderKey="vignetteRadius" label="Vignette Radius" value={params.vignetteRadius} min={0.1} max={1.5} defaultValue={0.7} step={0.01} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                <ToolSlider sliderKey="vignetteSoftness" label="Vignette Softness" value={params.vignetteSoftness} min={0.01} max={1.0} defaultValue={0.5} step={0.01} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
              </View>
            )}

            {activeFxSubTab === 'grain' && (
              <View>
                <Text style={styles.subSectionTitle}>Film Grain</Text>
                <ToolSlider sliderKey="grainAmount" label="Grain Amount" value={params.grainAmount} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                <ToolSlider sliderKey="grainSize" label="Grain Size" value={params.grainSize} min={1.0} max={10.0} defaultValue={2.0} step={0.1} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={v => `${v.toFixed(1)}px`} btnStepSize={btnStepSize} />
                <ToolSlider sliderKey="grainRoughness" label="Grain Roughness" value={params.grainRoughness} min={0.0} max={1.0} defaultValue={0.5} step={0.01} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
              </View>
            )}

            {activeFxSubTab === 'halation' && (
              <View>
                <Text style={styles.subSectionTitle}>Spotlight Halation</Text>
                <ToolSlider sliderKey="halationStrength" label="Halation Strength" value={params.halationStrength} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                <ToolSlider sliderKey="halationRadius" label="Halation Radius" value={params.halationRadius} min={0.05} max={1.0} defaultValue={0.3} step={0.01} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
              </View>
            )}

            {activeFxSubTab === 'bokeh' && (
              <View>
                <Text style={styles.subSectionTitle}>Aperture Bokeh</Text>
                <ToolSlider sliderKey="bokehStrength" label="Bokeh Strength" value={params.bokehStrength} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                <ToolSlider sliderKey="bokehRadius" label="Bokeh Radius" value={params.bokehRadius} min={0.05} max={1.0} defaultValue={0.5} step={0.01} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                <View style={styles.shapeSelector}>
                  <Text style={styles.shapeLabel}>Bokeh Aperture Shape:</Text>
                  <View style={styles.shapeRow}>
                    {(['circle', 'hexagon', 'anamorphic'] as EditParams['bokehShape'][]).map(shape => (
                      <TouchableOpacity
                        key={shape}
                        style={[styles.shapeTab, params.bokehShape === shape && { backgroundColor: accent, borderColor: accent }]}
                        onPress={() => update('bokehShape', shape)}
                      >
                        <Text style={[styles.shapeTabText, params.bokehShape === shape && { color: '#000' }]}>{shape.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {activeFxSubTab === 'longexposure' && (
              <View>
                <Text style={styles.subSectionTitle}>Long Exposure</Text>
                <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 8, paddingHorizontal: 4 }}>
                  Direction = 0 → Radial trails (iPhone night mode). Non-zero → directional light streaks.
                </Text>
                <ToolSlider sliderKey="longExposureAmount" label="Trail Intensity" value={params.longExposureAmount} min={0} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                <ToolSlider sliderKey="longExposureDirection" label="Direction (0=Radial)" value={params.longExposureDirection} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={v => v === 0 ? 'Radial' : v < 0 ? `Left (${Math.abs(v)}%)` : `Right (${v}%)`} btnStepSize={btnStepSize} />
                <ToolSlider sliderKey="longExposureThreshold" label="Light Source Gate" value={params.longExposureThreshold} min={0.05} max={0.9} defaultValue={0.3} step={0.01} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={v => `${Math.round(v * 100)}% Luma`} btnStepSize={btnStepSize} />
              </View>
            )}

            {activeFxSubTab === 'watermark' && (
              <View>
                <Text style={styles.subSectionTitle}>Export Watermark Settings</Text>
                <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 12, paddingHorizontal: 4 }}>
                  Burn camera metadata watermark overlay (device brand name and grading parameters: exposure, contrast, temperature) in the bottom corner of exported media.
                </Text>
                
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Burn Watermark on Export</Text>
                  <Switch
                    value={watermarkEnabled}
                    onValueChange={setWatermarkEnabled}
                    trackColor={{ false: '#26262B', true: accent }}
                  />
                </View>

                {watermarkEnabled && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.shapeLabel}>Camera / Device Model Name:</Text>
                    <TextInput
                      style={styles.cardInput}
                      value={watermarkDevice}
                      onChangeText={setWatermarkDevice}
                      placeholder="e.g. Google Pixel 9 Pro"
                      placeholderTextColor="#475569"
                    />
                  </View>
                )}

                <View style={styles.shapeSelector}>
                  <Text style={styles.shapeLabel}>Watermark Frame / Border Color:</Text>
                  <View style={styles.shapeRow}>
                    {(['none', 'white', 'black'] as const).map(colorVal => {
                      const isActive = watermarkBorderColor === colorVal;
                      return (
                        <TouchableOpacity
                          key={colorVal}
                          style={[styles.shapeTab, isActive && { backgroundColor: accent, borderColor: accent }]}
                          onPress={() => setWatermarkBorderColor(colorVal)}
                        >
                          <Text style={[styles.shapeTabText, isActive && { color: '#000' }]}>
                            {colorVal === 'none' ? 'NO BORDER' : colorVal.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}



        {!sharePanelOpen && activeCategory === 'overlays' && (
          <View>
            <Text style={styles.sectionTitle}>Selective Masking</Text>
            
            {!params.activeMaskId ? (
              <View>
                <View style={styles.shapeRow}>
                  <TouchableOpacity style={[styles.shapeTab, { borderColor: accent }]} onPress={() => handleAddMask('linear')}>
                    <Text style={[styles.shapeTabText, { color: accent }]}>+ LINEAR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.shapeTab, { borderColor: accent }]} onPress={() => handleAddMask('radial')}>
                    <Text style={[styles.shapeTabText, { color: accent }]}>+ RADIAL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.shapeTab, { borderColor: accent }]} onPress={() => handleAddMask('brush')}>
                    <Text style={[styles.shapeTabText, { color: accent }]}>+ BRUSH</Text>
                  </TouchableOpacity>
                </View>

                {params.masks.length === 0 ? (
                  <Text style={styles.emptyText}>No selective masks added yet. Tap a button above to add a Linear, Radial, or Brush mask.</Text>
                ) : (
                  <View style={styles.list}>
                    {params.masks.map((mask, idx) => (
                      <View key={mask.id} style={styles.listItem}>
                        <TouchableOpacity style={styles.listItemSelect} onPress={() => update('activeMaskId', mask.id)}>
                          <Text style={styles.listItemText}>
                            {mask.name} ({mask.enabled ? 'Enabled' : 'Disabled'})
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteMask(mask.id)}>
                          <Text style={styles.listItemDelete}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Keep Double Exposure here for convenience */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Double Exposure Multi-Layering</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Enable Double Exposure Blend</Text>
                  <Switch value={params.doubleExposureEnabled} onValueChange={v => update('doubleExposureEnabled', v)} trackColor={{ false: '#26262B', true: accent }} />
                </View>

                {params.doubleExposureEnabled && (
                  <View style={styles.blendControls}>
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: accent, marginVertical: 8 }]} onPress={handlePickDoubleExposureImage}>
                      <Text style={[styles.actionBtnText, { color: accent }]}>
                        {params.doubleExposureUri ? 'Change Blend Photo' : 'Select Blend Photo from Gallery'}
                      </Text>
                    </TouchableOpacity>

                    {params.doubleExposureUri && (
                      <View>
                        <Text style={styles.uriText} numberOfLines={1}>Selected: {params.doubleExposureUri}</Text>
                        <ToolSlider sliderKey="doubleExposureOpacity" label="Blend Opacity" value={params.doubleExposureOpacity} min={0.0} max={1.0} defaultValue={0.5} step={0.01} accentColor={accent} onValueChange={update} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                        <ToolSlider sliderKey="x" label="Blend Shift X" value={params.doubleExposureOffset.x} min={-1.0} max={1.0} defaultValue={0} step={0.01} accentColor={accent} onValueChange={updateDoubleExposureOffset} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatDegree} btnStepSize={btnStepSize} />
                        <ToolSlider sliderKey="y" label="Blend Shift Y" value={params.doubleExposureOffset.y} min={-1.0} max={1.0} defaultValue={0} step={0.01} accentColor={accent} onValueChange={updateDoubleExposureOffset} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatDegree} btnStepSize={btnStepSize} />

                        <View style={styles.shapeSelector}>
                          <Text style={styles.shapeLabel}>Mathematical Blend Mode:</Text>
                          <View style={styles.shapeRow}>
                            {(['screen', 'multiply', 'overlay', 'lighten'] as EditParams['doubleExposureBlend'][]).map(mode => (
                              <TouchableOpacity
                                key={mode}
                                style={[styles.shapeTab, params.doubleExposureBlend === mode && { backgroundColor: accent, borderColor: accent }]}
                                onPress={() => update('doubleExposureBlend', mode)}
                              >
                                <Text style={[styles.shapeTabText, params.doubleExposureBlend === mode && { color: '#000' }]}>{mode.toUpperCase()}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View>
                <TouchableOpacity style={styles.backBtn} onPress={() => update('activeMaskId', null)}>
                  <Text style={styles.backBtnText}>← Back to Masks List</Text>
                </TouchableOpacity>

                {params.masks.find(m => m.id === params.activeMaskId) && (() => {
                  const mask = params.masks.find(m => m.id === params.activeMaskId)!;
                  return (
                    <View style={styles.cpControls}>
                      <Text style={styles.subSectionTitle}>Tuning Active Mask: {mask.name}</Text>
                      
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Show Mask Overlay (Red)</Text>
                        <Switch value={params.showMaskOverlay} onValueChange={v => update('showMaskOverlay', v)} trackColor={{ false: '#26262B', true: accent }} />
                      </View>

                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Enable Mask Layer</Text>
                        <Switch value={mask.enabled} onValueChange={v => updateActiveMask('enabled', v)} trackColor={{ false: '#26262B', true: accent }} />
                      </View>

                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Invert Mask Weights</Text>
                        <Switch value={mask.inverted} onValueChange={v => updateActiveMask('inverted', v)} trackColor={{ false: '#26262B', true: accent }} />
                      </View>

                      <ToolSlider sliderKey="exposure" label="Mask Exposure" value={mask.exposure} min={-4.0} max={4.0} defaultValue={0} step={0.05} accentColor={accent} onValueChange={updateActiveMask} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatEV} btnStepSize={btnStepSize} />
                      <ToolSlider sliderKey="contrast" label="Mask Contrast" value={mask.contrast} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={updateActiveMask} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                      <ToolSlider sliderKey="saturation" label="Mask Saturation" value={mask.saturation} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={updateActiveMask} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                      <ToolSlider sliderKey="temperature" label="Mask Temp Shift" value={mask.temperature} min={-100} max={100} defaultValue={0} step={5} accentColor={accent} onValueChange={updateActiveMask} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatTemp} btnStepSize={btnStepSize} />
                      <ToolSlider sliderKey="intensity" label="Mask Intensity" value={mask.intensity ?? 100} min={0} max={100} defaultValue={100} step={5} accentColor={accent} onValueChange={updateActiveMask} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                      
                      {mask.type === 'brush' && (
                        <View style={styles.shapeSelector}>
                          <Text style={styles.shapeLabel}>Brush Tool Mode:</Text>
                          <View style={styles.shapeRow}>
                            <TouchableOpacity
                              style={[styles.shapeTab, !brushEraseMode && { backgroundColor: accent, borderColor: accent }]}
                              onPress={() => setBrushEraseMode(false)}
                            >
                              <Text style={[styles.shapeTabText, !brushEraseMode && { color: '#000' }]}>PAINT</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.shapeTab, brushEraseMode && { backgroundColor: accent, borderColor: accent }]}
                              onPress={() => setBrushEraseMode(true)}
                            >
                              <Text style={[styles.shapeTabText, brushEraseMode && { color: '#000' }]}>ERASER</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {mask.type === 'brush' ? (
                        <>
                          <ToolSlider sliderKey="feather" label="Brush Size" value={mask.feather} min={0.005} max={0.25} defaultValue={0.03} step={0.005} accentColor={accent} onValueChange={updateActiveMask} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                          <View style={styles.brushPresetsRow}>
                            <Text style={styles.presetsLabel}>Presets:</Text>
                            <TouchableOpacity
                              style={[styles.presetBtn, mask.feather === 0.01 && { backgroundColor: accent }]}
                              onPress={() => updateActiveMask('feather', 0.01)}
                            >
                              <Text style={[styles.presetBtnText, mask.feather === 0.01 && { color: '#000' }]}>S</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.presetBtn, mask.feather === 0.03 && { backgroundColor: accent }]}
                              onPress={() => updateActiveMask('feather', 0.03)}
                            >
                              <Text style={[styles.presetBtnText, mask.feather === 0.03 && { color: '#000' }]}>M</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.presetBtn, mask.feather === 0.08 && { backgroundColor: accent }]}
                              onPress={() => updateActiveMask('feather', 0.08)}
                            >
                              <Text style={[styles.presetBtnText, mask.feather === 0.08 && { color: '#000' }]}>L</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.presetBtn, mask.feather === 0.15 && { backgroundColor: accent }]}
                              onPress={() => updateActiveMask('feather', 0.15)}
                            >
                              <Text style={[styles.presetBtnText, mask.feather === 0.15 && { color: '#000' }]}>XL</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : (
                        <ToolSlider sliderKey="feather" label="Mask Feathering" value={mask.feather} min={0.0} max={1.0} defaultValue={0.3} step={0.01} accentColor={accent} onValueChange={updateActiveMask} onDragStart={lockScroll} onDragEnd={unlockScroll} formatValue={formatPercent} btnStepSize={btnStepSize} />
                      )}
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        )}
      </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  stepSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  stepSizeLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepSizeOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  stepSizeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#3E3E42',
    minWidth: 40,
    alignItems: 'center',
  },
  stepSizeBtnText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  customizerCard: {
    marginVertical: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  customizerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customizerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeCustomizerBtn: {
    padding: 4,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  badgeText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#26262B',
    backgroundColor: '#18181C',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.3,
  },
  headerBtnText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '700',
  },
  panel: {
    flex: 1,
    backgroundColor: '#121212',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#18181C',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#26262B',
    height: 44,
  },
  actionBarBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBarExport: {
    backgroundColor: '#10B981',
  },
  actionBarDivider: {
    width: 1,
    backgroundColor: '#26262B',
    alignSelf: 'stretch',
  },
  actionBarBtnText: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  panelContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  subSectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#26262B',
    marginTop: 8,
  },
  switchLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  bwPanel: {
    marginTop: 12,
    backgroundColor: '#18181C',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#26262B',
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 16,
  },
  list: {
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#18181C',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#26262B',
  },
  listItemSelect: {
    flex: 1,
  },
  listItemText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  listItemDelete: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    paddingLeft: 12,
  },
  backBtn: {
    paddingVertical: 8,
    marginBottom: 12,
  },
  backBtnText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cpControls: {
    backgroundColor: '#18181C',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#26262B',
  },
  shapeSelector: {
    marginVertical: 12,
  },
  shapeLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  shapeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shapeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#18181C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26262B',
  },
  shapeTabText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: 'bold',
  },
  presetScroll: {
    gap: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  presetCard: {
    width: 110,
    height: 70,
    backgroundColor: '#18181C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26262B',
    padding: 10,
    justifyContent: 'space-between',
  },
  presetCardName: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: 'bold',
  },
  presetCardType: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '700',
  },
  panelCard: {
    backgroundColor: '#18181C',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#26262B',
  },
  panelCardTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  panelCardDesc: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  cardInput: {
    backgroundColor: '#121212',
    color: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#26262B',
    marginBottom: 12,
  },
  actionBtnSolid: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSolidText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  uriText: {
    color: '#475569',
    fontSize: 10,
    marginVertical: 4,
  },
  blendControls: {
    backgroundColor: '#18181C',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#26262B',
    marginBottom: 16,
  },
  gradientPanel: {
    backgroundColor: '#18181C',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#26262B',
    marginBottom: 12,
  },
  gradientGradeControls: {
    backgroundColor: '#18181C',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#26262B',
    marginTop: 12,
  },
  fxSubTabScroll: {
    marginBottom: 16,
  },
  fxSubTabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  fxSubTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26262B',
  },
  fxSubTabText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: 'bold',
  },
  brushPresetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  presetsLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginRight: 4,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#18181C',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#26262B',
  },
  presetBtnText: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
