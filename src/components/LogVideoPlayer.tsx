import React from 'react';
import { Platform, ViewProps, View, Text, StyleSheet } from 'react-native';
import { LogFormat } from '../core/engine/ColorGradingEngine';
import { ControlPoint, LutMask, HSLAdjustments } from '../core/engine/EditingEngine';
import NativeLogVideoPlayer from './LogVideoPlayerNativeComponent';

export interface LogVideoPlayerProps extends ViewProps {
  videoUrl: string;
  logFormat: LogFormat;
  paused?: boolean;
  exposure: number;   // -2.0 to 2.0
  contrast: number;   // 0.5 to 2.0
  saturation: number; // 0.0 to 2.0
  gamma: number;      // 0.5 to 2.0

  // Advanced Grading Parameters
  curvesLut?: number[]; // Float32Array serialized as number[]
  colorWheels?: number[]; // [shH, shS, shL, mtH, mtS, mtL, hlH, hlS, hlL]
  temperature?: number;
  tint?: number;
  highlights?: number;
  shadows?: number;
  toneContrast?: number;
  vibrance?: number;
  hue?: number;
  hueRotation?: number;
  vignetteParams?: number[]; // [strength, radius, softness, centerX, centerY]
  doubleExposureParams?: {
    enabled: boolean;
    opacity: number;
    offsetX: number;
    offsetY: number;
    blendMode: number; // 0=screen, 1=multiply, 2=overlay, 3=lighten
    uri: string | null;
  };

  // Additional settings
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
  halationStrength?: number;
  halationRadius?: number;
  halationColor?: string;
  halationCenterX?: number;
  halationCenterY?: number;
  perspectiveVertical?: number;
  perspectiveHorizontal?: number;
  perspectiveAspect?: number;
  perspectiveRotate?: number;

  controlPoints?: ControlPoint[];
  masks?: LutMask[];
  brushStroke?: number[];
  showMaskOverlay?: boolean;
  activeMaskIndex?: number;

  lutData?: number[];
  lutSize?: number;
  lutIntensity?: number;
  lutColorOffset?: number;
  lutToneOffset?: number;

  // Bokeh
  bokehStrength?: number;
  bokehRadius?: number;
  bokehShape?: string;
  bokehCenterX?: number;
  bokehCenterY?: number;



  // Long Shutter Smear Trail
  longExposureAmount?: number;
  longExposureDirection?: number;
  longExposureThreshold?: number;
  longExposureCenterX?: number;
  longExposureCenterY?: number;

  brightness?: number;
  hsl?: HSLAdjustments;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  zoomScale?: number;
  zoomX?: number;
  zoomY?: number;
}

const LogVideoPlayerFallback: React.FC<LogVideoPlayerProps> = ({
  videoUrl,
  logFormat,
  exposure,
  contrast,
  saturation,
  gamma,
  style,
  ...props
}) => (
  <View style={[styles.fallbackContainer, style]} {...props}>
    <Text style={styles.fallbackTitle}>Log Video Grading Player (GPU Simulation - Fallback)</Text>
    <Text style={styles.fallbackDetail} numberOfLines={1}>Source: {videoUrl}</Text>
    
    <View style={styles.specGrid}>
      <View style={styles.specItem}>
        <Text style={styles.specLabel}>Log Preset:</Text>
        <Text style={styles.specValue}>{logFormat.toUpperCase()}</Text>
      </View>
      <View style={styles.specItem}>
        <Text style={styles.specLabel}>Exposure:</Text>
        <Text style={[styles.specValue, styles.highlightValue]}>
          {exposure >= 0 ? `+${exposure.toFixed(2)}` : exposure.toFixed(2)} EV
        </Text>
      </View>
      <View style={styles.specItem}>
        <Text style={styles.specLabel}>Contrast:</Text>
        <Text style={styles.specValue}>{contrast.toFixed(2)}x</Text>
      </View>
      <View style={styles.specItem}>
        <Text style={styles.specLabel}>Saturation:</Text>
        <Text style={styles.specValue}>{saturation.toFixed(2)}x</Text>
      </View>
      <View style={styles.specItem}>
        <Text style={styles.specLabel}>Gamma Curve:</Text>
        <Text style={styles.specValue}>{gamma.toFixed(2)}</Text>
      </View>
    </View>
    
    <View style={styles.shaderPreview}>
      <Text style={styles.shaderText}>
        Applying GPU LUT conversions to texture frames...
      </Text>
    </View>
  </View>
);

import { useEffect, useState } from 'react';
import { gradingBus } from '../core/engine/GradingBus';

export const LogVideoPlayer: React.FC<LogVideoPlayerProps> = ({
  videoUrl,
  logFormat,
  paused,
  exposure: initialExposure,
  contrast: initialContrast,
  saturation: initialSaturation,
  gamma,
  curvesLut: initialCurvesLut,
  colorWheels: initialColorWheels,
  temperature: initialTemperature,
  tint: initialTint,
  highlights: initialHighlights,
  shadows: initialShadows,
  toneContrast: initialToneContrast,
  vibrance: initialVibrance,
  hue: initialHue,
  vignetteParams: initialVignetteParams,
  doubleExposureParams: initialDoubleExposureParams,
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
  halationStrength = 0,
  halationRadius = 0.3,
  halationColor = '#FF4422',
  halationCenterX = 0.5,
  halationCenterY = 0.3,
  perspectiveVertical = 0,
  perspectiveHorizontal = 0,
  perspectiveAspect = 0,
  perspectiveRotate = 0,
  controlPoints = [],
  masks = [],
  brushStroke = [],
  showMaskOverlay = false,
  activeMaskIndex = -1,
  lutData = [],
  lutSize = 0,
  lutIntensity = 100,
  lutColorOffset = 0,
  lutToneOffset = 0,
  bokehStrength = 0,
  bokehRadius = 0.3,
  bokehShape = 'circle',
  bokehCenterX = 0.5,
  bokehCenterY = 0.5,

  longExposureAmount = 0,
  longExposureDirection = 0,
  longExposureThreshold = 0.4,
  longExposureCenterX = 0.5,
  longExposureCenterY = 0.5,
  brightness: initialBrightness = 0,
  hsl: initialHsl,
  cropX = 0,
  cropY = 0,
  cropWidth = 1,
  cropHeight = 1,
  zoomScale = 1,
  zoomX = 0.5,
  zoomY = 0.5,
  style,
  ...props
}) => {
  const [liveParams, setLiveParams] = useState({
    paused,
    exposure: initialExposure,
    contrast: initialContrast,
    saturation: initialSaturation,
    curvesLut: initialCurvesLut,
    colorWheels: initialColorWheels,
    temperature: initialTemperature,
    tint: initialTint,
    highlights: initialHighlights,
    shadows: initialShadows,
    toneContrast: initialToneContrast,
    vibrance: initialVibrance,
    hueRotation: initialHue ?? props.hueRotation ?? 0,
    vignetteParams: initialVignetteParams,
    doubleExposureParams: initialDoubleExposureParams,
    dehaze,
    hdrStrength,
    sharpen,
    definition,
    softness,
    denoiseLuminance,
    denoiseColor,
    grainAmount,
    grainSize,
    grainRoughness,
    halationStrength,
    halationRadius,
    halationColor,
    halationCenterX,
    halationCenterY,
    perspectiveVertical,
    perspectiveHorizontal,
    perspectiveAspect,
    perspectiveRotate,
    controlPoints,
    masks,
    brushStroke,
    showMaskOverlay,
    activeMaskIndex,
    lutData,
    lutSize,
    lutIntensity,
    lutColorOffset,
    lutToneOffset,
    bokehStrength,
    bokehRadius,
    bokehShape,
    bokehCenterX,
    bokehCenterY,

    longExposureAmount,
    longExposureDirection,
    longExposureThreshold,
    longExposureCenterX,
    longExposureCenterY,
    brightness: initialBrightness,
    hsl: initialHsl,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    zoomScale,
    zoomX,
    zoomY,
  });

  useEffect(() => {
    setLiveParams({
      paused,
      exposure: initialExposure,
      contrast: initialContrast,
      saturation: initialSaturation,
      curvesLut: initialCurvesLut,
      colorWheels: initialColorWheels,
      temperature: initialTemperature,
      tint: initialTint,
      highlights: initialHighlights,
      shadows: initialShadows,
      toneContrast: initialToneContrast,
      vibrance: initialVibrance,
      hueRotation: initialHue ?? props.hueRotation ?? 0,
      vignetteParams: initialVignetteParams,
      doubleExposureParams: initialDoubleExposureParams,
      dehaze,
      hdrStrength,
      sharpen,
      definition,
      softness,
      denoiseLuminance,
      denoiseColor,
      grainAmount,
      grainSize,
      grainRoughness,
      halationStrength,
      halationRadius,
      halationColor,
      halationCenterX,
      halationCenterY,
      perspectiveVertical,
      perspectiveHorizontal,
      perspectiveAspect,
      perspectiveRotate,
      controlPoints,
      masks,
      brushStroke,
      showMaskOverlay,
      activeMaskIndex,
      lutData,
      lutSize,
      lutIntensity,
      lutColorOffset,
      lutToneOffset,
      bokehStrength,
      bokehRadius,
      bokehShape,
      bokehCenterX,
      bokehCenterY,

      longExposureAmount,
      longExposureDirection,
      longExposureThreshold,
      longExposureCenterX,
      longExposureCenterY,
      brightness: initialBrightness,
      hsl: initialHsl,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      zoomScale,
      zoomX,
      zoomY,
    });
  }, [
    initialExposure,
    initialContrast,
    initialSaturation,
    initialCurvesLut,
    initialColorWheels,
    initialTemperature,
    initialTint,
    initialHighlights,
    initialShadows,
    initialToneContrast,
    initialVibrance,
    initialVignetteParams,
    initialDoubleExposureParams,
    dehaze,
    hdrStrength,
    sharpen,
    definition,
    softness,
    denoiseLuminance,
    denoiseColor,
    grainAmount,
    grainSize,
    grainRoughness,
    halationStrength,
    halationRadius,
    halationColor,
    halationCenterX,
    halationCenterY,
    perspectiveVertical,
    perspectiveHorizontal,
    perspectiveAspect,
    perspectiveRotate,
    controlPoints,
    masks,
    brushStroke,
    showMaskOverlay,
    activeMaskIndex,
    lutData,
    lutSize,
    lutIntensity,
    lutColorOffset,
    lutToneOffset,
    bokehStrength,
    bokehRadius,
    bokehShape,
    bokehCenterX,
    bokehCenterY,

    paused,
    longExposureAmount,
    longExposureDirection,
    longExposureThreshold,
    initialBrightness,
    initialHsl,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    zoomScale,
    zoomX,
    zoomY,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const unsubscribe = gradingBus.subscribe((key, value) => {
      setLiveParams(prev => {
        if (key === 'doubleExposureOffset') {
          return {
            ...prev,
            doubleExposureParams: prev.doubleExposureParams
              ? {
                  ...prev.doubleExposureParams,
                  offsetX: value.x,
                  offsetY: value.y,
                }
              : null,
          };
        } else if (key === 'doubleExposureParams') {
          return {
            ...prev,
            doubleExposureParams: value,
          };
        } else if (key === 'contrast') {
          return {
            ...prev,
            contrast: 1.0 + value / 100,
          };
        } else if (key === 'saturation') {
          return {
            ...prev,
            saturation: 1.0 + value / 100,
          };
        } else if (key === 'x') {
          return {
            ...prev,
            doubleExposureParams: prev.doubleExposureParams
              ? { ...prev.doubleExposureParams, offsetX: value }
              : null,
          };
        } else if (key === 'y') {
          return {
            ...prev,
            doubleExposureParams: prev.doubleExposureParams
              ? { ...prev.doubleExposureParams, offsetY: value }
              : null,
          };
        } else if (key === 'doubleExposureOpacity') {
          return {
            ...prev,
            doubleExposureParams: prev.doubleExposureParams
              ? { ...prev.doubleExposureParams, opacity: value }
              : null,
          };
        } else if (key === 'brightness') {
          return {
            ...prev,
            brightness: value,
          };
        } else if (key === 'hsl') {
          return {
            ...prev,
            hsl: value,
          };
        } else if (key === 'hue') {
          return {
            ...prev,
            hueRotation: value,
          };
        } else {
          return {
            ...prev,
            [key]: value,
          };
        }
      });
    });

    return unsubscribe;
  }, []);

  if (Platform.OS !== 'android') {
    return (
      <LogVideoPlayerFallback
        videoUrl={videoUrl}
        logFormat={logFormat}
        exposure={initialExposure}
        contrast={initialContrast}
        saturation={initialSaturation}
        gamma={gamma}
        style={style}
        {...props}
      />
    );
  }

  return (
    <NativeLogVideoPlayer
      videoUrl={videoUrl}
      logFormat={logFormat}
      paused={liveParams.paused}
      exposure={liveParams.exposure}
      contrast={liveParams.contrast}
      saturation={liveParams.saturation}
      gamma={gamma}
      curvesLut={liveParams.curvesLut}
      colorWheels={liveParams.colorWheels}
      temperature={liveParams.temperature}
      tint={liveParams.tint}
      highlights={liveParams.highlights}
      shadows={liveParams.shadows}
      toneContrast={liveParams.toneContrast}
      vibrance={liveParams.vibrance}
      hueRotation={liveParams.hueRotation}
      vignetteParams={liveParams.vignetteParams}
      doubleExposureEnabled={liveParams.doubleExposureParams?.enabled ?? false}
      doubleExposureOpacity={liveParams.doubleExposureParams?.opacity ?? 0.5}
      doubleExposureOffsetX={liveParams.doubleExposureParams?.offsetX ?? 0.0}
      doubleExposureOffsetY={liveParams.doubleExposureParams?.offsetY ?? 0.0}
      doubleExposureBlend={liveParams.doubleExposureParams?.blendMode ?? 0}
      doubleExposureUri={liveParams.doubleExposureParams?.uri ?? undefined}
      dehaze={liveParams.dehaze}
      hdrStrength={liveParams.hdrStrength}
      sharpen={liveParams.sharpen}
      definition={liveParams.definition}
      softness={liveParams.softness}
      denoiseLuminance={liveParams.denoiseLuminance}
      denoiseColor={liveParams.denoiseColor}
      grainAmount={liveParams.grainAmount}
      grainSize={liveParams.grainSize}
      grainRoughness={liveParams.grainRoughness}
      halationStrength={liveParams.halationStrength}
      halationRadius={liveParams.halationRadius}
      halationColor={liveParams.halationColor}
      halationCenterX={liveParams.halationCenterX}
      halationCenterY={liveParams.halationCenterY}
      perspectiveVertical={liveParams.perspectiveVertical}
      perspectiveHorizontal={liveParams.perspectiveHorizontal}
      perspectiveAspect={liveParams.perspectiveAspect}
      perspectiveRotate={liveParams.perspectiveRotate}
      controlPoints={React.useMemo(() => {
        return (liveParams.controlPoints || []).slice(0, 10).flatMap(cp => [
          cp.x,
          cp.y,
          cp.radius,
          cp.brightness,
          cp.contrast,
          cp.structure,
          cp.saturation,
          cp.temperature,
          cp.targetColor[0],
          cp.targetColor[1],
          cp.targetColor[2]
        ]);
      }, [liveParams.controlPoints])}
      masks={React.useMemo(() => {
        return (liveParams.masks || []).slice(0, 5).flatMap(m => {
          let x2 = m.x2;
          let y2 = m.y2;
          if (m.type === 'radial') {
            // m.x2 is outer radius. Inner boundary is radius * (1.0 - feather)
            x2 = m.x2 * (1.0 - m.feather);
            y2 = m.x2;
          }
          return [
            m.type === 'linear' ? 0.0 : m.type === 'radial' ? 1.0 : 2.0,
            m.enabled ? 1.0 : 0.0,
            m.inverted ? 1.0 : 0.0,
            m.x1,
            m.y1,
            x2,
            y2,
            m.feather,
            m.exposure,
            m.contrast,
            m.saturation,
            m.temperature,
            (m.intensity ?? 100.0) / 100.0
          ];
        });
      }, [liveParams.masks])}
      brushStroke={liveParams.brushStroke}
      showMaskOverlay={liveParams.showMaskOverlay}
      activeMaskIndex={liveParams.activeMaskIndex}
      lutData={liveParams.lutData}
      lutSize={liveParams.lutSize}
      lutIntensity={liveParams.lutIntensity}
      lutColorOffset={liveParams.lutColorOffset}
      lutToneOffset={liveParams.lutToneOffset}
      bokehStrength={liveParams.bokehStrength}
      bokehRadius={liveParams.bokehRadius}
      bokehShape={liveParams.bokehShape}
      bokehCenterX={liveParams.bokehCenterX}
      bokehCenterY={liveParams.bokehCenterY}

      longExposureAmount={liveParams.longExposureAmount}
      longExposureDirection={liveParams.longExposureDirection}
      longExposureThreshold={liveParams.longExposureThreshold}
      longExposureCenterX={liveParams.longExposureCenterX}
      longExposureCenterY={liveParams.longExposureCenterY}
      brightness={liveParams.brightness}
      hslAdjustments={React.useMemo(() => {
        const bands: Array<keyof HSLAdjustments> = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'];
        const arr: number[] = [];
        for (const band of bands) {
          const adj = liveParams.hsl?.[band] || { hue: 0, saturation: 0, luminance: 0 };
          arr.push(adj.hue, adj.saturation, adj.luminance);
        }
        return arr;
      }, [liveParams.hsl])}
      cropX={liveParams.cropX}
      cropY={liveParams.cropY}
      cropWidth={liveParams.cropWidth}
      cropHeight={liveParams.cropHeight}
      zoomScale={liveParams.zoomScale}
      zoomX={liveParams.zoomX}
      zoomY={liveParams.zoomY}
      style={[styles.defaultStyle, style]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  defaultStyle: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    borderRadius: 16,
  },
  fallbackContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'space-between',
  },
  fallbackTitle: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 15,
  },
  fallbackDetail: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  specItem: {
    width: '30%',
    marginVertical: 4,
  },
  specLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
  },
  specValue: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  highlightValue: {
    color: '#8B5CF6',
  },
  shaderPreview: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  shaderText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
});
