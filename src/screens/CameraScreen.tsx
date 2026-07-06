import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  NativeModules,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { CameraPreview } from '../components/CameraPreview';
import { ThemeName, getThemeStyles } from '../core/theme';
import { EditParams, DEFAULT_EDIT_PARAMS } from '../core/engine/EditingEngine';
import { CurvesEngine } from '../core/engine/CurvesEngine';
import { LutEngine } from '../core/engine/LutEngine';

const { LutShare } = NativeModules;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CameraScreenProps {
  isActive: boolean;
  theme: ThemeName;
  customAccentColor: string;
  communityDeck: Array<{ name: string; params: Partial<EditParams>; color?: string }>;
  wallpaperActive: boolean;
  onPhotoCaptured?: (filePath: string) => void;
}

interface CameraLens {
  id: string;
  focalLength: number;
  name: string;
}

interface CameraLut {
  id: string;
  name: string;
  data: number[] | null;
  size: number;
}

export const CameraScreen: React.FC<CameraScreenProps> = ({
  isActive,
  theme,
  customAccentColor,
  communityDeck,
  wallpaperActive,
  onPhotoCaptured,
}) => {
  // Styles & Theme
  const stylesObj = getThemeStyles(theme, wallpaperActive);
  const isDark = theme !== 'light';
  const accent = customAccentColor;

  // Lenses state
  const [availableLenses, setAvailableLenses] = useState<CameraLens[]>([]);
  const [activeLensId, setActiveLensId] = useState<string>('0');
  const [currentFocalLengthText, setCurrentFocalLengthText] = useState<string>('24mm');

  // Shooting Mode: 'photo' | 'video'
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Manual Control states
  const [manualPanelOpen, setManualPanelOpen] = useState(false);
  const [iso, setIso] = useState<number>(-1); // -1 = auto
  const [shutterSpeed, setShutterSpeed] = useState<number>(-1); // -1 = auto (in microseconds, e.g. 8000 = 1/125s)
  const [wbMode, setWbMode] = useState<string>('auto'); // auto, daylight, cloudy, incandescent, fluorescent
  const [meterMode, setMeterMode] = useState<string>('matrix'); // matrix, center, spot
  const [focusMode, setFocusMode] = useState<string>('auto'); // auto, manual
  const [focusDistance, setFocusDistance] = useState<number>(0); // 0.0 (infinity) to 10.0 (macro)
  const [flash, setFlash] = useState<string>('off'); // off, on, torch
  const [highMpMode, setHighMpMode] = useState<boolean>(false);
  const [unprocessed, setUnprocessed] = useState<boolean>(false);

  // LUT Selection state
  const [availableLuts, setAvailableLuts] = useState<CameraLut[]>([]);
  const [selectedLutId, setSelectedLutId] = useState<string>('none');
  const [lutIntensity, setLutIntensity] = useState<number>(100);

  // Manual Adjustments (same parameters as editing studio)
  const [params] = useState<EditParams>({ ...DEFAULT_EDIT_PARAMS });

  // Permissions Request hook
  useEffect(() => {
    if (isActive) {
      const requestCameraPermissions = async () => {
        if (Platform.OS === 'android') {
          try {
            if (LutShare && LutShare.requestCameraPermissions) {
              await LutShare.requestCameraPermissions();
            }
          } catch (err) {
            console.warn('Native permissions request failed:', err);
          }
        }
      };
      requestCameraPermissions();
    }
  }, [isActive]);

  // Query hardware cameras on mount
  useEffect(() => {
    const loadCameras = async () => {
      if (!LutShare) return;
      try {
        const list = await LutShare.getAvailableCameras();
        if (list && list.length > 0) {
          const mapped = list.map((c: any) => ({
            id: c.id,
            focalLength: Math.round(c.focalLength),
            name: c.name,
          }));
          setAvailableLenses(mapped);
          
          const mainLens = mapped.find((c: CameraLens) => c.name.startsWith('Main')) || mapped[0];
          setActiveLensId(mainLens.id);
        } else {
          setAvailableLenses([
            { id: '0', focalLength: 24, name: 'Main (24mm)' },
            { id: '0:2', focalLength: 13, name: 'Ultra Wide (13mm)' },
            { id: '0:3', focalLength: 75, name: 'Telephoto (75mm)' },
          ]);
        }
      } catch (e) {
        console.log('Failed to fetch hardware lenses, loading fallbacks.', e);
        setAvailableLenses([
          { id: '0', focalLength: 24, name: 'Main (24mm)' },
          { id: '0:2', focalLength: 13, name: 'Ultra Wide (13mm)' },
          { id: '0:3', focalLength: 75, name: 'Telephoto (75mm)' },
        ]);
      }
    };

    loadCameras();
  }, [isActive]);

  // Generates flat 3D LUT arrays for procedural styles to bind directly in GLSL
  const generateProceduralLutData = (presetId: string): number[] => {
    try {
      const dummyParams: EditParams = {
        ...DEFAULT_EDIT_PARAMS,
        activeLutPresetId: presetId,
      };
      const cubeStr = LutEngine.compileLut('rec709', dummyParams);
      const parsed = LutEngine.parseLut(cubeStr);
      const size = parsed.size;
      const flattened = new Float32Array(size * size * size * 3);
      let idx = 0;
      for (let b = 0; b < size; b++) {
        for (let g = 0; g < size; g++) {
          for (let r = 0; r < size; r++) {
            const val = parsed.table[b][g][r];
            flattened[idx++] = val[0];
            flattened[idx++] = val[1];
            flattened[idx++] = val[2];
          }
        }
      }
      return Array.from(flattened);
    } catch (e) {
      console.log('Failed to generate procedural LUT table', e);
      return [];
    }
  };

  // Build list of LUTs (None, Built-In, and Community Deck)
  useEffect(() => {
    const lutsList: CameraLut[] = [{ id: 'none', name: 'Original', data: null, size: 0 }];

    lutsList.push(
      { id: 'procedural_7', name: 'Warm Sepia', data: generateProceduralLutData('procedural_7'), size: 33 },
      { id: 'procedural_8', name: 'Classic Noir', data: generateProceduralLutData('procedural_8'), size: 33 },
      { id: 'procedural_9', name: 'Jungle Green', data: generateProceduralLutData('procedural_9'), size: 33 },
      { id: 'procedural_10', name: 'Cyberpunk', data: generateProceduralLutData('procedural_10'), size: 33 }
    );

    if (communityDeck && communityDeck.length > 0) {
      communityDeck.forEach((lut, idx) => {
        if (lut.params && lut.params.customLutData) {
          lutsList.push({
            id: `custom_${idx}`,
            name: lut.name,
            data: lut.params.customLutData,
            size: lut.params.customLutSize || 33,
          });
        }
      });
    }

    setAvailableLuts(lutsList);
  }, [communityDeck]);

  // Find active LUT details
  const activeLut = availableLuts.find(l => l.id === selectedLutId) || null;

  // Serialized curves lookup (size 1024)
  const curvesLut = useMemo(() => {
    const luts = CurvesEngine.buildAllLUTs(params.curves);
    const merged = new Float32Array(1024);
    for (let i = 0; i < 256; i++) {
      merged[4 * i] = luts.rgb[i];
      merged[4 * i + 1] = luts.r[i];
      merged[4 * i + 2] = luts.g[i];
      merged[4 * i + 3] = luts.b[i];
    }
    return Array.from(merged);
  }, [params.curves]);

  // Serialized color wheels (size 9)
  const colorWheels = useMemo(() => {
    return [
      params.colorWheels.shadows.hue,
      params.colorWheels.shadows.saturation,
      params.colorWheels.shadows.luminance,
      params.colorWheels.midtones.hue,
      params.colorWheels.midtones.saturation,
      params.colorWheels.midtones.luminance,
      params.colorWheels.highlights.hue,
      params.colorWheels.highlights.saturation,
      params.colorWheels.highlights.luminance,
    ];
  }, [params.colorWheels]);

  // Serialized vignette params (size 5)
  const vignetteParams = useMemo(() => {
    return [
      params.vignetteStrength,
      params.vignetteRadius,
      params.vignetteSoftness,
      params.vignetteCenter.x,
      params.vignetteCenter.y,
    ];
  }, [params.vignetteStrength, params.vignetteRadius, params.vignetteSoftness, params.vignetteCenter]);

  // Camera Info Event callback handler
  const handleCameraInfoEvent = (cameraId: string, focalLengthText: string) => {
    setCurrentFocalLengthText(focalLengthText);
  };

  // Capture Button Action
  const handleShutterPress = async () => {
    if (!LutShare) {
      Alert.alert('Simulation', 'Camera capture completed in simulation mode.');
      return;
    }

    if (mode === 'photo') {
      setIsProcessing(true);
      try {
        const result = await LutShare.captureCameraPhoto();
        setIsProcessing(false);
        Alert.alert(
          'Photo Saved',
          `Artistic LUT photo saved successfully to Downloads:\n\n${result}`,
          [{ text: 'Great' }]
        );
        if (onPhotoCaptured) onPhotoCaptured(result);
      } catch (err: any) {
        setIsProcessing(false);
        Alert.alert('Capture Failed', err.message || 'An error occurred during photo capture.');
      }
    } else {
      if (isRecording) {
        setIsProcessing(true);
        try {
          const result = await LutShare.setCameraRecordingActive(false);
          setIsRecording(false);
          setIsProcessing(false);
          Alert.alert(
            'Video Saved',
            `Artistic LUT video saved successfully to Downloads:\n\n${result}`,
            [{ text: 'Great' }]
          );
        } catch (err: any) {
          setIsRecording(false);
          setIsProcessing(false);
          Alert.alert('Recording Stop Failed', err.message);
        }
      } else {
        try {
          await LutShare.setCameraRecordingActive(true);
          setIsRecording(true);
        } catch (err: any) {
          Alert.alert('Recording Start Failed', err.message);
        }
      }
    }
  };

  const cycleLens = () => {
    if (availableLenses.length <= 1) return;
    const currentIdx = availableLenses.findIndex(l => l.id === activeLensId);
    const nextIdx = (currentIdx + 1) % availableLenses.length;
    setActiveLensId(availableLenses[nextIdx].id);
  };

  const toggleFlashMode = () => {
    const modes = ['off', 'on', 'torch'];
    const currentIdx = modes.indexOf(flash);
    const nextIdx = (currentIdx + 1) % modes.length;
    setFlash(modes[nextIdx]);
  };

  if (!isActive) return null;

  return (
    <View style={styles.container}>
      <CameraPreview
        activeCameraId={activeLensId}
        iso={iso}
        shutterSpeed={shutterSpeed}
        whiteBalanceMode={wbMode}
        meteringMode={meterMode}
        focusMode={focusMode}
        focusDistance={focusDistance}
        flashMode={flash}
        
        logFormat="rec709"
        exposure={params.exposure}
        contrast={params.contrast}
        saturation={params.saturation}
        gamma={1.0}
        brightness={params.brightness}
        temperature={params.temperature}
        tint={params.tint}
        highlights={params.highlights}
        shadows={params.shadows}
        toneContrast={params.toneContrast}
        vibrance={params.vibrance}
        hue={params.hue}
        
        lutData={activeLut?.data || undefined}
        lutSize={activeLut?.size || 0}
        lutIntensity={lutIntensity}
        
        curvesLut={curvesLut}
        colorWheels={colorWheels}
        hsl={params.hsl}
        
        vignetteParams={vignetteParams}
        dehaze={params.dehaze}
        hdrStrength={params.hdrStrength}
        sharpen={params.sharpen}
        definition={params.definition}
        softness={params.softness}
        denoiseLuminance={params.denoiseLuminance}
        denoiseColor={params.denoiseColor}
        grainAmount={params.grainAmount}
        grainSize={params.grainSize}
        grainRoughness={params.grainRoughness}

        highMpMode={highMpMode}
        unprocessed={unprocessed}

        onCameraInfo={handleCameraInfoEvent}
        style={styles.cameraPreview}
      />

      <View style={styles.topOverlay}>
        <TouchableOpacity style={styles.rangefinderInfo} onPress={cycleLens} activeOpacity={0.7}>
          <Text style={[styles.rangefinderText, { color: accent }]}>FOCAL LENGTH</Text>
          <Text style={styles.focalLengthArt}>{currentFocalLengthText}</Text>
          <View style={[styles.artDivider, { backgroundColor: accent }]} />
          <Text style={styles.rangefinderText}>CINE MANUAL COMPILATION (TAP TO CYCLE)</Text>
        </TouchableOpacity>

        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC</Text>
          </View>
        )}
      </View>

      <View style={[styles.bottomContainer, { backgroundColor: isDark ? 'rgba(9,9,11,0.82)' : 'rgba(255,255,255,0.85)' }]}>
        {manualPanelOpen && (
          <View style={styles.manualControlsDrawer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.manualScroll}>
              <View style={styles.controlPillCard}>
                <Text style={styles.controlLabel}>ISO</Text>
                <View style={styles.controlRow}>
                  {[-1, 100, 400, 800, 1600].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.smallModeBtn, iso === val && { backgroundColor: accent }]}
                      onPress={() => setIso(val)}
                    >
                      <Text style={[styles.smallModeBtnText, iso === val && { color: '#000' }]}>
                        {val === -1 ? 'AUTO' : val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.controlPillCard}>
                <Text style={styles.controlLabel}>SHUTTER SPEED</Text>
                <View style={styles.controlRow}>
                  {[-1, 2000, 8000, 33000, 125000].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.smallModeBtn, shutterSpeed === val && { backgroundColor: accent }]}
                      onPress={() => setShutterSpeed(val)}
                    >
                      <Text style={[styles.smallModeBtnText, shutterSpeed === val && { color: '#000' }]}>
                        {val === -1 ? 'AUTO' : `1/${Math.round(1_000_000 / val)}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.controlPillCard}>
                <Text style={styles.controlLabel}>WHITE BALANCE</Text>
                <View style={styles.controlRow}>
                  {['auto', 'daylight', 'cloudy', 'incandescent'].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.smallModeBtn, wbMode === val && { backgroundColor: accent }]}
                      onPress={() => setWbMode(val)}
                    >
                      <Text style={[styles.smallModeBtnText, wbMode === val && { color: '#000' }]}>
                        {val.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.controlPillCard}>
                <Text style={styles.controlLabel}>METERING</Text>
                <View style={styles.controlRow}>
                  {['matrix', 'center', 'spot'].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.smallModeBtn, meterMode === val && { backgroundColor: accent }]}
                      onPress={() => setMeterMode(val)}
                    >
                      <Text style={[styles.smallModeBtnText, meterMode === val && { color: '#000' }]}>
                        {val.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.controlPillCard}>
                <Text style={styles.controlLabel}>FOCUS MODE</Text>
                <View style={styles.controlRow}>
                  {['auto', 'manual'].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.smallModeBtn, focusMode === val && { backgroundColor: accent }]}
                      onPress={() => setFocusMode(val)}
                    >
                      <Text style={[styles.smallModeBtnText, focusMode === val && { color: '#000' }]}>
                        {val.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {focusMode === 'manual' && (
                  <View style={styles.focusDistanceSliderRow}>
                    <Text style={styles.sliderLabel}>DIST: {focusDistance.toFixed(1)} diopt</Text>
                    <View style={styles.adjBtnRow}>
                      <TouchableOpacity
                        style={styles.adjPill}
                        onPress={() => setFocusDistance(prev => Math.max(0, parseFloat((prev - 0.5).toFixed(1))))}
                      >
                        <Text style={styles.adjText}>-</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.adjPill}
                        onPress={() => setFocusDistance(prev => Math.min(10, parseFloat((prev + 0.5).toFixed(1))))}
                      >
                        <Text style={styles.adjText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.controlPillCard}>
                <Text style={styles.controlLabel}>RESOLUTION</Text>
                <View style={styles.controlRow}>
                  {[
                    { label: 'NORMAL', val: false },
                    { label: 'HIGH MP', val: true },
                  ].map(item => (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.smallModeBtn, highMpMode === item.val && { backgroundColor: accent }]}
                      onPress={() => setHighMpMode(item.val)}
                    >
                      <Text style={[styles.smallModeBtnText, highMpMode === item.val && { color: '#000' }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.controlPillCard}>
                <Text style={styles.controlLabel}>PROCESSING LOOK</Text>
                <View style={styles.controlRow}>
                  {[
                    { label: 'NORMAL', val: false },
                    { label: 'UNPROCESSED', val: true },
                  ].map(item => (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.smallModeBtn, unprocessed === item.val && { backgroundColor: accent }]}
                      onPress={() => setUnprocessed(item.val)}
                    >
                      <Text style={[styles.smallModeBtnText, unprocessed === item.val && { color: '#000' }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.controlPillCard}>
                <Text style={styles.controlLabel}>CAMERA LENS</Text>
                <View style={styles.controlRow}>
                  {availableLenses.map(lens => (
                    <TouchableOpacity
                      key={lens.id}
                      style={[styles.smallModeBtn, activeLensId === lens.id && { backgroundColor: accent }]}
                      onPress={() => setActiveLensId(lens.id)}
                    >
                      <Text style={[styles.smallModeBtnText, activeLensId === lens.id && { color: '#000' }]}>
                        {lens.focalLength}mm
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.lutSelectorWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lutScroll}>
            {availableLuts.map((lut) => {
              const isSelected = selectedLutId === lut.id;
              return (
                <TouchableOpacity
                  key={lut.id}
                  style={[
                    styles.lutCard,
                    { borderColor: isDark ? '#27272A' : '#E4E4E7' },
                    isSelected && { borderColor: accent, borderWidth: 2, backgroundColor: 'rgba(9,9,11,0.35)' },
                  ]}
                  onPress={() => setSelectedLutId(lut.id)}
                >
                  <Text style={[styles.lutCardText, isSelected && { color: accent, fontWeight: 'bold' }]}>
                    {lut.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          
          {selectedLutId !== 'none' && (
            <View style={styles.intensitySliderRow}>
              <Text style={styles.intensityText}>LUT OPACITY: {lutIntensity}%</Text>
              <View style={styles.adjBtnRow}>
                <TouchableOpacity
                  style={styles.adjPill}
                  onPress={() => setLutIntensity(prev => Math.max(0, prev - 10))}
                >
                  <Text style={styles.adjText}>-10%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adjPill}
                  onPress={() => setLutIntensity(prev => Math.min(100, prev + 10))}
                >
                  <Text style={styles.adjText}>+10%</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.shutterPanel}>
          <TouchableOpacity style={styles.sideBtn} onPress={toggleFlashMode}>
            <Text style={styles.sideBtnLabel}>FLASH</Text>
            <Text style={[styles.sideBtnVal, { color: flash !== 'off' ? accent : '#71717A' }]}>
              {flash.toUpperCase()}
            </Text>
          </TouchableOpacity>

          <View style={styles.shutterWrapper}>
            {isProcessing ? (
              <View style={styles.shutterInnerCircle}>
                <ActivityIndicator size="large" color={accent} />
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.shutterOuterCircle,
                  { borderColor: isDark ? '#FFFFFF' : '#000000' },
                ]}
                onPress={handleShutterPress}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.shutterInnerCircle,
                    { backgroundColor: mode === 'photo' ? '#FFFFFF' : '#EF4444' },
                    isRecording && { borderRadius: 8, scaleX: 0.8, scaleY: 0.8 },
                  ]}
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.rightSideControls}>
            <TouchableOpacity
              style={[styles.sideBtn, manualPanelOpen && { borderColor: accent, borderWidth: 1 }]}
              onPress={() => setManualPanelOpen(!manualPanelOpen)}
            >
              <Text style={styles.sideBtnLabel}>MANUAL</Text>
              <Text style={[styles.sideBtnVal, { color: manualPanelOpen ? accent : '#71717A' }]}>
                {manualPanelOpen ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sideBtn}
              onPress={() => {
                if (isRecording) {
                  Alert.alert('Cannot Switch Mode', 'Please stop recording first.');
                  return;
                }
                setMode(mode === 'photo' ? 'video' : 'photo');
              }}
            >
              <Text style={styles.sideBtnLabel}>MODE</Text>
              <Text style={[styles.sideBtnVal, { color: accent }]}>
                {mode.toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraPreview: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rangefinderInfo: {
    backgroundColor: 'rgba(9, 9, 11, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rangefinderText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#A1A1AA',
    letterSpacing: 1,
  },
  focalLengthArt: {
    fontSize: 34,
    fontFamily: 'serif',
    color: '#FFFFFF',
    fontWeight: '900',
    marginVertical: 2,
  },
  artDivider: {
    height: 1.5,
    width: 40,
    marginVertical: 4,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  recordingText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  lensContainer: {
    position: 'absolute',
    right: 16,
    top: SCREEN_HEIGHT * 0.22,
    gap: 12,
  },
  lensPill: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  lensPillText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 24,
    paddingTop: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  manualControlsDrawer: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  manualScroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  controlPillCard: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    minWidth: 200,
  },
  controlLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  controlRow: {
    flexDirection: 'row',
    gap: 6,
  },
  smallModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    minWidth: 44,
    alignItems: 'center',
  },
  smallModeBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  focusDistanceSliderRow: {
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 9,
    color: '#A1A1AA',
    marginBottom: 2,
  },
  lutSelectorWrapper: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  lutScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  lutCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  lutCardText: {
    color: '#E4E4E7',
    fontSize: 11,
    fontWeight: '500',
  },
  intensitySliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    justifyContent: 'space-between',
  },
  intensityText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    width: 120,
  },
  shutterPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    marginTop: 16,
  },
  shutterWrapper: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuterCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInnerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  sideBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    minWidth: 64,
  },
  sideBtnLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#71717A',
    letterSpacing: 0.5,
  },
  sideBtnVal: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },
  rightSideControls: {
    flexDirection: 'row',
    gap: 8,
  },
  adjBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  adjPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  adjText: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
