/**
 * PreviewCanvas — Simulated color grading preview canvas.
 * Renders a grid of color swatches showing the effect of the current EditParams.
 * In a production build this would render a live GPU-graded video frame via native bridge.
 * Hosts the PositionalOverlay when a positional tool is active.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, TouchableOpacity, PanResponder } from 'react-native';
import { EditParams, EditingEngine, Point2D } from '../../core/engine/EditingEngine';
import { LutEngine } from '../../core/engine/LutEngine';
import { PositionalOverlay } from './PositionalOverlay';
import { LogFormat } from '../../core/engine/ColorGradingEngine';
import { LogVideoPlayer } from '../LogVideoPlayer';
import { CurvesEngine } from '../../core/engine/CurvesEngine';

export type PositionalTool =
  | 'vignette'
  | 'grain'
  | 'halation'
  | 'bokeh'
  | 'smear'
  | 'longexposure'
  | 'lineargradient'
  | 'circulargradient'
  | 'controlpoint'
  | null;

interface PreviewCanvasProps {
  params: EditParams;
  positionalTool: PositionalTool;
  activeControlPointId?: string | null;
  setActiveControlPointId?: (id: string | null) => void;
  onParamsChange: (p: EditParams) => void;
  mediaUri: string | null;
  logFormat: LogFormat;
  brushEraseMode?: boolean;
  paused?: boolean;
  setPaused?: (paused: boolean) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  theme?: 'light' | 'dark';
  customAccentColor?: string;
}

// Sample input colors for the swatch grid
const SAMPLE_COLORS: [number, number, number][] = [
  [0.05, 0.05, 0.05], // deep black
  [0.15, 0.12, 0.10], // dark shadow
  [0.30, 0.28, 0.25], // mid-dark
  [0.50, 0.47, 0.45], // grey
  [0.70, 0.68, 0.65], // light grey
  [0.90, 0.89, 0.87], // near white
  [0.85, 0.20, 0.15], // red
  [0.85, 0.55, 0.10], // orange
  [0.85, 0.82, 0.10], // yellow
  [0.15, 0.72, 0.25], // green
  [0.10, 0.65, 0.85], // cyan
  [0.15, 0.25, 0.85], // blue
  [0.55, 0.15, 0.85], // purple
  [0.85, 0.15, 0.65], // magenta
  [0.95, 0.72, 0.45], // warm skin
  [0.60, 0.45, 0.35], // dark skin
];

const toHex = (r: number, g: number, b: number): string => {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
};

import { LongExposureModel, VignetteModel, HalationModel } from '../../core/engine/EffectsEngine';

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  params,
  positionalTool,
  activeControlPointId,
  setActiveControlPointId,
  onParamsChange,
  mediaUri,
  logFormat,
  brushEraseMode = false,
  paused = false,
  setPaused,
  onInteractionStart,
  onInteractionEnd,
  theme,
  customAccentColor,
}) => {
  const [canvasSize, setCanvasSize] = useState({ width: 320, height: 240 });

  const latestRef = useRef({ params, canvasSize, onParamsChange });
  latestRef.current = { params, canvasSize, onParamsChange };

  const lastTapRef = useRef<number>(0);
  const lastTouchCountRef = useRef<number>(0);
  const lastDistRef = useRef<number>(0);
  const lastMidRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastScaleRef = useRef<number>(1.0);
  const lastCenterRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const lastPanPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDoubleTapRef = useRef<boolean>(false);

  const zoomPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e, gestureState) => {
        const now = Date.now();
        const doubleTap = now - lastTapRef.current < 300;
        lastTapRef.current = now;
        if (doubleTap) {
          isDoubleTapRef.current = true;
          return true;
        }
        return false;
      },

      onMoveShouldSetPanResponderCapture: (e, gestureState) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          return true;
        }
        const { params: currentParams } = latestRef.current;
        const isZoomed = (currentParams.zoomScale ?? 1.0) > 1.05;
        if (touches.length === 1 && !overlayProps && isZoomed) {
          return true;
        }
        return false;
      },

      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => false,

      onPanResponderGrant: (e, gestureState) => {
        const { params: currentParams, canvasSize: currentCanvasSize, onParamsChange: currentOnParamsChange } = latestRef.current;
        
        // Reset touch count so that onPanResponderMove initializes the baseline on the next move frame
        lastTouchCountRef.current = 0;

        if (isDoubleTapRef.current) {
          isDoubleTapRef.current = false;
          const isZoomed = (currentParams.zoomScale ?? 1.0) > 1.05;
          const touch = e.nativeEvent;
          // Capture coordinates relative to the canvas layout dimensions
          const clickX = touch.locationX ?? (currentCanvasSize.width / 2);
          const clickY = touch.locationY ?? (currentCanvasSize.height / 2);
          const tx = clickX / currentCanvasSize.width;
          const ty = clickY / currentCanvasSize.height;

          if (isZoomed) {
            currentOnParamsChange({
              ...currentParams,
              zoomScale: 1.0,
              zoomX: 0.5,
              zoomY: 0.5,
            });
          } else {
            currentOnParamsChange({
              ...currentParams,
              zoomScale: 2.5,
              zoomX: Math.max(0, Math.min(1, tx)),
              zoomY: Math.max(0, Math.min(1, ty)),
            });
          }
        }
      },

      onPanResponderMove: (e, gestureState) => {
        const { params: currentParams, canvasSize: currentCanvasSize, onParamsChange: currentOnParamsChange } = latestRef.current;
        const touches = e.nativeEvent.touches;
        const count = touches.length;

        if (count !== lastTouchCountRef.current) {
          lastTouchCountRef.current = count;
          if (count === 2) {
            const p1 = { x: touches[0].pageX, y: touches[0].pageY };
            const p2 = { x: touches[1].pageX, y: touches[1].pageY };
            lastDistRef.current = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
            lastMidRef.current = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            lastScaleRef.current = currentParams.zoomScale ?? 1.0;
            lastCenterRef.current = { x: currentParams.zoomX ?? 0.5, y: currentParams.zoomY ?? 0.5 };
          } else if (count === 1) {
            lastPanPosRef.current = { x: touches[0].pageX, y: touches[0].pageY };
            lastScaleRef.current = currentParams.zoomScale ?? 1.0;
            lastCenterRef.current = { x: currentParams.zoomX ?? 0.5, y: currentParams.zoomY ?? 0.5 };
          }
          return;
        }

        if (count === 2) {
          const p1 = { x: touches[0].pageX, y: touches[0].pageY };
          const p2 = { x: touches[1].pageX, y: touches[1].pageY };
          const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
          const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

          const ratio = dist / Math.max(1.0, lastDistRef.current);
          const newScale = Math.max(1.0, Math.min(5.0, lastScaleRef.current * ratio));

          const dx = mid.x - lastMidRef.current.x;
          const dy = mid.y - lastMidRef.current.y;

          const imgDx = dx / Math.max(1.0, currentCanvasSize.width * lastScaleRef.current);
          const imgDy = dy / Math.max(1.0, currentCanvasSize.height * lastScaleRef.current);

          const newZoomX = Math.max(0.0, Math.min(1.0, lastCenterRef.current.x - imgDx));
          const newZoomY = Math.max(0.0, Math.min(1.0, lastCenterRef.current.y - imgDy));

          currentOnParamsChange({
            ...currentParams,
            zoomScale: newScale,
            zoomX: newZoomX,
            zoomY: newZoomY,
          });
        } else if (count === 1 && !overlayProps) {
          const isZoomed = (currentParams.zoomScale ?? 1.0) > 1.05;
          if (isZoomed) {
            const dx = touches[0].pageX - lastPanPosRef.current.x;
            const dy = touches[0].pageY - lastPanPosRef.current.y;

            const imgDx = dx / Math.max(1.0, currentCanvasSize.width * lastScaleRef.current);
            const imgDy = dy / Math.max(1.0, currentCanvasSize.height * lastScaleRef.current);

            const newZoomX = Math.max(0.0, Math.min(1.0, lastCenterRef.current.x - imgDx));
            const newZoomY = Math.max(0.0, Math.min(1.0, lastCenterRef.current.y - imgDy));

            currentOnParamsChange({
              ...currentParams,
              zoomX: newZoomX,
              zoomY: newZoomY,
            });
          }
        }
      },

      onPanResponderRelease: () => {
        lastTouchCountRef.current = 0;
      },
      onPanResponderTerminate: () => {
        lastTouchCountRef.current = 0;
      },
    })
  );

  const curvesLut = React.useMemo(() => {
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

  const colorWheels = React.useMemo(() => {
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

  const vignetteParams = React.useMemo(() => {
    return [
      params.vignetteStrength,
      params.vignetteRadius,
      params.vignetteSoftness,
      params.vignetteCenter.x,
      params.vignetteCenter.y,
    ];
  }, [params.vignetteStrength, params.vignetteRadius, params.vignetteSoftness, params.vignetteCenter]);

  const doubleExposureParams = React.useMemo(() => {
    const blendModes = { screen: 0, multiply: 1, overlay: 2, lighten: 3 };
    return {
      enabled: params.doubleExposureEnabled,
      opacity: params.doubleExposureOpacity,
      offsetX: params.doubleExposureOffset.x,
      offsetY: params.doubleExposureOffset.y,
      blendMode: blendModes[params.doubleExposureBlend] ?? 0,
      uri: params.doubleExposureUri || null,
    };
  }, [
    params.doubleExposureEnabled,
    params.doubleExposureOpacity,
    params.doubleExposureOffset,
    params.doubleExposureBlend,
    params.doubleExposureUri,
  ]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setCanvasSize({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  }, []);

  // Compute base graded colors applying coordinate-based operations (like gradients, vignette, U-Points)
  const baseGradedColors = SAMPLE_COLORS.map(([r, g, b], i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const px = (col + 0.5) / 8;
    const py = (row + 0.5) / 2;

    // 1. Perspective warp the coordinates
    const [wx, wy] = EditingEngine.applyPerspectiveWarp(px, py, params);

    // 2. Apply editing pipeline with coordinates
    let [gr, gg, gb] = EditingEngine.applyAllTools(r, g, b, params, wx, wy);

    // 3. Apply Vignette (which is coordinate-based)
    const vig = VignetteModel.factor(wx, wy, params);
    gr *= vig; gg *= vig; gb *= vig;

    // 4. Apply Halation (which is coordinate-based)
    const [hR, hG, hB] = HalationModel.sample(wx, wy, gr, gg, gb, params);
    gr += hR; gg += hG; gb += hB;

    return [
      EditingEngine.clamp(gr, 0, 1),
      EditingEngine.clamp(gg, 0, 1),
      EditingEngine.clamp(gb, 0, 1),
    ] as [number, number, number];
  });

  // Apply Long Exposure horizontal details trail convolution
  const gradedColors = baseGradedColors.map((color, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);

    return LongExposureModel.sampleTrail(
      col,
      row,
      8,
      params.longExposureAmount,
      params.longExposureDirection,
      params.longExposureThreshold,
      (c, r) => baseGradedColors[r * 8 + c]
    );
  });

  const lutParams = React.useMemo(
    () => LutEngine.getLutParams(
      params.activeLutPresetId,
      params.customLutData,
      params.customLutSize,
      params.importedLuts || []
    ),
    [params.activeLutPresetId, params.customLutData, params.customLutSize, params.importedLuts]
  );

  // Determine positional overlay config
  const getOverlayProps = () => {
    switch (positionalTool) {
      case 'vignette':
        return {
          mode: 'circle' as const,
          center: params.vignetteCenter,
          radius: params.vignetteRadius,
          accentColor: '#F8FAFC',
          onCenterChange: (pt: any) => onParamsChange({ ...params, vignetteCenter: pt }),
          onRadiusChange: (r: number) => onParamsChange({ ...params, vignetteRadius: r }),
        };
      case 'grain':
        return {
          mode: 'circle' as const,
          center: params.grainMask,
          radius: params.grainMask.radius,
          accentColor: '#FBBF24',
          onCenterChange: (pt: any) => onParamsChange({ ...params, grainMask: { ...params.grainMask, ...pt } }),
          onRadiusChange: (r: number) => onParamsChange({ ...params, grainMask: { ...params.grainMask, radius: r } }),
        };
      case 'halation':
        return {
          mode: 'circle' as const,
          center: params.halationCenter,
          radius: params.halationRadius,
          accentColor: params.halationColor,
          onCenterChange: (pt: any) => onParamsChange({ ...params, halationCenter: pt }),
          onRadiusChange: (r: number) => onParamsChange({ ...params, halationRadius: r }),
        };
      case 'bokeh':
        return {
          mode: 'circle' as const,
          center: params.bokehCenter,
          radius: params.bokehCenter.radius,
          accentColor: '#60A5FA',
          onCenterChange: (pt: any) => onParamsChange({ ...params, bokehCenter: { ...params.bokehCenter, ...pt } }),
          onRadiusChange: (r: number) => onParamsChange({ ...params, bokehCenter: { ...params.bokehCenter, radius: r } }),
        };

      case 'controlpoint':
        const activeCp = params.controlPoints.find(c => c.id === activeControlPointId);
        return {
          mode: 'controlpoint' as const,
          center: activeCp ? { x: activeCp.x, y: activeCp.y } : { x: 0.5, y: 0.5 },
          radius: activeCp ? activeCp.radius : 0.25,
          accentColor: '#F43F5E',
          controlPoints: params.controlPoints,
          activeControlPointId: activeControlPointId,
          onAddControlPoint: (pt: Point2D) => {
            const col = Math.min(7, Math.max(0, Math.floor(pt.x * 8)));
            const row = Math.min(1, Math.max(0, Math.floor(pt.y * 2)));
            const sampledColor = SAMPLE_COLORS[row * 8 + col];
            const newCp = {
              id: `cp_${Date.now()}`,
              x: pt.x,
              y: pt.y,
              radius: 0.25,
              brightness: 0,
              contrast: 0,
              structure: 0,
              saturation: 0,
              temperature: 0,
              targetColor: sampledColor,
              enabled: true,
            };
            onParamsChange({
              ...params,
              controlPoints: [...params.controlPoints, newCp]
            });
            setActiveControlPointId?.(newCp.id);
          },
          onSelectControlPoint: (id: string | null) => {
            setActiveControlPointId?.(id);
          },
          onCenterChange: (pt: Point2D, id?: string | null) => {
            const targetId = id || activeControlPointId;
            if (!targetId) return;
            const col = Math.min(7, Math.max(0, Math.floor(pt.x * 8)));
            const row = Math.min(1, Math.max(0, Math.floor(pt.y * 2)));
            const sampledColor = SAMPLE_COLORS[row * 8 + col];
            const updated = params.controlPoints.map(c => 
              c.id === targetId ? { ...c, x: pt.x, y: pt.y, targetColor: sampledColor } : c
            );
            onParamsChange({ ...params, controlPoints: updated });
          },
          onRadiusChange: (r: number) => {
            if (!activeControlPointId) return;
            const updated = params.controlPoints.map(c =>
              c.id === activeControlPointId ? { ...c, radius: r } : c
            );
            onParamsChange({ ...params, controlPoints: updated });
          },
        };
      case 'lineargradient': {
        const activeMask = params.masks.find(m => m.id === params.activeMaskId);
        if (!activeMask) return null;
        return {
          mode: 'lineargradient' as const,
          center: { x: activeMask.x1, y: activeMask.y1 },
          end: { x: activeMask.x2, y: activeMask.y2 },
          accentColor: '#38BDF8',
          onCenterChange: (pt: Point2D) => {
            const updated = params.masks.map(m =>
              m.id === params.activeMaskId ? { ...m, x1: pt.x, y1: pt.y } : m
            );
            onParamsChange({ ...params, masks: updated });
          },
          onEndChange: (pt: Point2D) => {
            const updated = params.masks.map(m =>
              m.id === params.activeMaskId ? { ...m, x2: pt.x, y2: pt.y } : m
            );
            onParamsChange({ ...params, masks: updated });
          },
          onRadiusChange: (r: number) => {
            const updated = params.masks.map(m =>
              m.id === params.activeMaskId ? { ...m, feather: r } : m
            );
            onParamsChange({ ...params, masks: updated });
          },
        };
      }
      case 'circulargradient': {
        const activeMask = params.masks.find(m => m.id === params.activeMaskId);
        if (!activeMask) return null;
        return {
          mode: 'circle' as const,
          center: { x: activeMask.x1, y: activeMask.y1 },
          radius: activeMask.x2,
          accentColor: '#A78BFA',
          onCenterChange: (pt: Point2D) => {
            const updated = params.masks.map(m =>
              m.id === params.activeMaskId ? { ...m, x1: pt.x, y1: pt.y } : m
            );
            onParamsChange({ ...params, masks: updated });
          },
          onRadiusChange: (r: number) => {
            const updated = params.masks.map(m =>
              m.id === params.activeMaskId ? { ...m, x2: r } : m
            );
            onParamsChange({ ...params, masks: updated });
          },
        };
      }
      case 'brush' as any: {
        const activeMask = params.masks.find(m => m.id === params.activeMaskId);
        if (!activeMask) return null;
        return {
          mode: 'brush' as const,
          center: { x: 0.5, y: 0.5 },
          radius: activeMask.feather, // feather serves as brush radius
          accentColor: '#FB923C',
          onCenterChange: () => {},
          onBrushStroke: (x: number, y: number, r: number, isStart: boolean) => {
            onParamsChange({
              ...params,
              brushStroke: [x, y, r, isStart ? 1.0 : 0.0, 0.0, brushEraseMode ? 1.0 : 0.0] // 6th param: isErase
            });
          }
        };
      }
      case 'longexposure':
      case 'smear': {
        return {
          mode: 'point' as const,
          center: params.longExposureCenter || { x: 0.5, y: 0.5 },
          accentColor: '#10B981',
          onCenterChange: (pt: Point2D) => {
            onParamsChange({ ...params, longExposureCenter: pt });
          },
        };
      }
      default:
        return null;
    }
  };

  const overlayProps = getOverlayProps();

  // Common perspective styling warp
  const perspectiveTransform = [
    { perspective: 400 },
    { rotateX: `${params.perspectiveVertical * 0.22}deg` },
    { rotateY: `${params.perspectiveHorizontal * 0.22}deg` },
    { rotateZ: `${params.perspectiveRotate * 0.25}deg` },
    { scaleY: 1.0 + (params.perspectiveAspect / 100.0) * 0.35 }
  ] as any;

  const isVideo = !!mediaUri && !(
    mediaUri.toLowerCase().endsWith('.jpg') ||
    mediaUri.toLowerCase().endsWith('.jpeg') ||
    mediaUri.toLowerCase().endsWith('.png') ||
    mediaUri.toLowerCase().endsWith('.webp') ||
    mediaUri.toLowerCase().endsWith('.heic') ||
    mediaUri.toLowerCase().includes('image')
  );

  return (
    <View style={styles.outer}>
      <View style={styles.canvas} onLayout={handleLayout} {...zoomPanResponder.current.panHandlers}>
        {mediaUri ? (
          <LogVideoPlayer
            videoUrl={mediaUri}
            logFormat={logFormat}
            paused={paused}
            exposure={params.exposure}
            brightness={params.brightness}
            contrast={1.0 + params.contrast / 100}
            saturation={1.0 + params.saturation / 100}
            gamma={1.0}
            curvesLut={curvesLut}
            colorWheels={colorWheels}
            temperature={params.temperature}
            tint={params.tint}
            highlights={params.highlights}
            shadows={params.shadows}
            toneContrast={params.toneContrast}
            vibrance={params.vibrance}
            hue={params.hue}
            hsl={params.hsl}
            vignetteParams={vignetteParams}
            doubleExposureParams={doubleExposureParams}
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
            halationStrength={params.halationStrength}
            halationRadius={params.halationRadius}
            halationColor={params.halationColor}
            halationCenterX={params.halationCenter.x}
            halationCenterY={params.halationCenter.y}
            perspectiveVertical={params.perspectiveVertical}
            perspectiveHorizontal={params.perspectiveHorizontal}
            perspectiveAspect={params.perspectiveAspect}
            perspectiveRotate={params.perspectiveRotate}
            controlPoints={params.controlPoints}
            masks={params.masks}
            brushStroke={(params as any).brushStroke || []}
            bokehStrength={params.bokehStrength}
            bokehRadius={params.bokehRadius}
            bokehShape={params.bokehShape}
            bokehCenterX={params.bokehCenter?.x ?? 0.5}
            bokehCenterY={params.bokehCenter?.y ?? 0.5}
            longExposureAmount={params.longExposureAmount}
            longExposureDirection={params.longExposureDirection}
            longExposureThreshold={params.longExposureThreshold}
            longExposureCenterX={params.longExposureCenter?.x ?? 0.5}
            longExposureCenterY={params.longExposureCenter?.y ?? 0.5}
            showMaskOverlay={params.showMaskOverlay}
            activeMaskIndex={params.masks.findIndex(m => m.id === params.activeMaskId)}
            lutData={lutParams.lutData}
            lutSize={lutParams.lutSize}
            lutIntensity={params.lutIntensity}
            lutColorOffset={params.lutColorOffset}
            lutToneOffset={params.lutToneOffset}
            cropX={params.crop.x}
            cropY={params.crop.y}
            cropWidth={params.crop.width}
            cropHeight={params.crop.height}
            zoomScale={params.zoomScale ?? 1.0}
            zoomX={params.zoomX ?? 0.5}
            zoomY={params.zoomY ?? 0.5}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <>
            {/* Swatch grid preview */}
            <View style={[styles.swatchGrid, { transform: perspectiveTransform }]}>
              {gradedColors.map(([r, g, b], i) => (
                <View
                  key={i}
                  style={[styles.swatch, { backgroundColor: toHex(r, g, b) }]}
                />
              ))}
            </View>

            {/* Gradient overlay preview for light / color shifts */}
            <View style={[styles.gradientBar, { transform: perspectiveTransform }]}>
              {Array.from({ length: 20 }).map((_, i) => {
                const t = i / 19;
                const [r, g, b] = EditingEngine.applyAllTools(t, t, t, params);
                return (
                  <View
                    key={i}
                    style={[styles.gradStep, { backgroundColor: toHex(r, g, b) }]}
                  />
                );
              })}
            </View>
          </>
        )}

        {/* Render all control points as indicators */}
        {positionalTool === 'controlpoint' && params.controlPoints.map(cp => {
          const isActive = cp.id === activeControlPointId;
          const cpX = cp.x * canvasSize.width;
          const cpY = cp.y * canvasSize.height;
          return (
            <View
              key={cp.id}
              style={[
                styles.cpIndicator,
                {
                  left: cpX - 10,
                  top: cpY - 10,
                  borderColor: isActive ? '#F43F5E' : '#94A3B8',
                  backgroundColor: isActive ? 'rgba(244,63,94,0.35)' : 'rgba(15,23,42,0.7)',
                }
              ]}
            >
              <Text style={styles.cpText}>+</Text>
            </View>
          );
        })}

        {/* Info overlay */}
        <View style={styles.infoOverlay}>
          <Text style={styles.infoText}>
            EXP {params.exposure >= 0 ? '+' : ''}{params.exposure.toFixed(1)} ·
            CON {params.contrast >= 0 ? '+' : ''}{params.contrast} ·
            SAT {params.saturation >= 0 ? '+' : ''}{params.saturation}
          </Text>
          {positionalTool && (
            <Text style={styles.positionalHint}>
              {positionalTool.toUpperCase()} - drag canvas to position
            </Text>
          )}
        </View>

        {/* Play/Pause Button Overlay for Videos */}
        {isVideo && setPaused && (
          <TouchableOpacity
            style={styles.playPauseBtn}
            onPress={() => setPaused(!paused)}
            activeOpacity={0.85}
          >
            <Text style={styles.playPauseText}>
              {paused ? '▶ PLAY' : '❚❚ PAUSE'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Positional overlay for positional tools */}
        {overlayProps && (
          <PositionalOverlay
            {...overlayProps}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={onInteractionEnd}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
  },

  canvas: {
    width: '100%',
    height: 340,
    position: 'relative',
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 260,
  },
  swatch: {
    width: '12.5%',
    height: 130,
  },
  gradientBar: {
    flexDirection: 'row',
    height: 80,
  },
  gradStep: {
    flex: 1,
    height: 80,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 2,
  },
  infoText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  positionalHint: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  cpIndicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 1.5,
    elevation: 3,
  },
  cpText: {
    fontSize: 10,
    color: '#fff',
  },
  playPauseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  playPauseText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
