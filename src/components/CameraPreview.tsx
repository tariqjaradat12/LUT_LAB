import React, { useMemo } from 'react';
import { Platform, StyleSheet, View, Text, DeviceEventEmitter } from 'react-native';
import NativeCameraPreview from './CameraPreviewNativeComponent';
import { LogFormat } from '../core/engine/ColorGradingEngine';
import { HSLAdjustments } from '../core/engine/EditingEngine';

export interface CameraPreviewProps {
  activeCameraId: string;
  iso: number;
  shutterSpeed: number;
  whiteBalanceMode: string;
  meteringMode: string;
  focusMode: string;
  focusDistance: number;
  flashMode: string;

  logFormat: LogFormat;
  exposure: number;
  contrast: number;
  saturation: number;
  gamma: number;
  brightness: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  toneContrast: number;
  vibrance: number;
  hue?: number;

  curvesLut?: number[];
  colorWheels?: number[];
  hsl?: HSLAdjustments;
  vignetteParams?: number[];

  lutData?: number[];
  lutSize?: number;
  lutIntensity?: number;

  dehaze?: number;
  hdrStrength?: number;
  sharpen?: number;
  definition?: number;
  softness?: number;
  denoiseLuminance?: number;
  denoiseColor?: number;
  grainAmount?: number;
  grainSize?: number;
  grainRoughness?: number;

  onCameraInfo?: (cameraId: string, focalLengthText: string) => void;
  style?: any;

  highMpMode?: boolean;
  unprocessed?: boolean;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  activeCameraId,
  iso,
  shutterSpeed,
  whiteBalanceMode,
  meteringMode,
  focusMode,
  focusDistance,
  flashMode,
  logFormat,
  exposure,
  contrast,
  saturation,
  gamma,
  brightness,
  temperature,
  tint,
  highlights,
  shadows,
  toneContrast,
  vibrance,
  hue = 0,
  curvesLut,
  colorWheels,
  hsl,
  vignetteParams,
  lutData,
  lutSize = 0,
  lutIntensity = 100,
  dehaze = 0,
  hdrStrength = 0,
  sharpen = 0,
  definition = 0,
  softness = 0,
  denoiseLuminance = 0,
  denoiseColor = 0,
  grainAmount = 0,
  grainSize = 2,
  grainRoughness = 0.5,
  onCameraInfo,
  style,
  highMpMode = false,
  unprocessed = false,
}) => {

  const handleCameraInfo = (event: any) => {
    if (onCameraInfo && event.nativeEvent) {
      onCameraInfo(event.nativeEvent.cameraId, event.nativeEvent.focalLengthText);
    }
  };

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('onCameraInfo', (event: any) => {
      if (onCameraInfo) {
        onCameraInfo(event.cameraId, event.focalLengthText);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [onCameraInfo]);

  const formattedHslAdjustments = useMemo(() => {
    if (!hsl) return new Array(24).fill(0);
    const bands: Array<keyof HSLAdjustments> = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'];
    const arr: number[] = [];
    for (const band of bands) {
      const adj = hsl[band] || { hue: 0, saturation: 0, luminance: 0 };
      arr.push(adj.hue, adj.saturation, adj.luminance);
    }
    return arr;
  }, [hsl]);

  const finalContrast = useMemo(() => 1.0 + contrast / 100, [contrast]);
  const finalSaturation = useMemo(() => 1.0 + saturation / 100, [saturation]);

  if (Platform.OS !== 'android') {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Camera Preview not supported on this platform</Text>
      </View>
    );
  }

  return (
    <NativeCameraPreview
      activeCameraId={activeCameraId}
      iso={iso}
      shutterSpeed={shutterSpeed}
      whiteBalanceMode={whiteBalanceMode}
      meteringMode={meteringMode}
      focusMode={focusMode}
      focusDistance={focusDistance}
      flashMode={flashMode}
      logFormat={logFormat}
      exposure={exposure}
      contrast={finalContrast}
      saturation={finalSaturation}
      gamma={gamma}
      brightness={brightness}
      temperature={temperature}
      tint={tint}
      highlights={highlights}
      shadows={shadows}
      toneContrast={toneContrast}
      vibrance={vibrance}
      hueRotation={hue}
      curvesLut={curvesLut}
      colorWheels={colorWheels}
      hslAdjustments={formattedHslAdjustments}
      vignetteParams={vignetteParams}
      lutData={lutData}
      lutSize={lutSize}
      lutIntensity={lutIntensity}
      dehaze={dehaze}
      hdrStrength={hdrStrength}
      sharpen={sharpen}
      definition={definition}
      softness={softness}
      denoiseLuminance={denoiseLuminance}
      denoiseColor={denoiseColor}
      grainAmount={grainAmount}
      grainSize={grainSize}
      grainRoughness={grainRoughness}
      onCameraInfo={handleCameraInfo}
      highMpMode={highMpMode}
      unprocessed={unprocessed}
      style={[styles.camera, style]}
    />
  );
};

const styles = StyleSheet.create({
  camera: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  fallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
