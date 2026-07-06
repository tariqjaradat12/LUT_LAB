import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ViewProps } from 'react-native';
import type { Double, Float, Int32 } from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  videoUrl?: string;
  logFormat?: string;
  paused?: boolean;
  exposure?: Float;
  contrast?: Float;
  saturation?: Float;
  gamma?: Float;
  curvesLut?: ReadonlyArray<Double>;
  colorWheels?: ReadonlyArray<Double>;
  temperature?: Float;
  tint?: Float;
  highlights?: Float;
  shadows?: Float;
  toneContrast?: Float;
  vibrance?: Float;
  hueRotation?: Float;
  vignetteParams?: ReadonlyArray<Double>;
  
  doubleExposureEnabled?: boolean;
  doubleExposureOpacity?: Float;
  doubleExposureOffsetX?: Float;
  doubleExposureOffsetY?: Float;
  doubleExposureBlend?: Int32;
  doubleExposureUri?: string;

  // New adjustment properties
  dehaze?: Float;
  hdrStrength?: Float;
  sharpen?: Float;
  definition?: Float;
  softness?: Float;
  denoiseLuminance?: Float;
  denoiseColor?: Float;
  grainAmount?: Float;
  grainSize?: Float;
  grainRoughness?: Float;
  halationStrength?: Float;
  halationRadius?: Float;
  halationColor?: string;
  halationCenterX?: Float;
  halationCenterY?: Float;
  perspectiveVertical?: Float;
  perspectiveHorizontal?: Float;
  perspectiveAspect?: Float;
  perspectiveRotate?: Float;
  
  // Flat-array structured data
  controlPoints?: ReadonlyArray<Double>;
  masks?: ReadonlyArray<Double>;
  brushStroke?: ReadonlyArray<Double>;
  showMaskOverlay?: boolean;
  activeMaskIndex?: Int32;

  // 3D LUT texture updates
  lutData?: ReadonlyArray<Double>;
  lutSize?: Float;
  lutIntensity?: Float;
  lutColorOffset?: Float;
  lutToneOffset?: Float;

  // Bokeh
  bokehStrength?: Float;
  bokehRadius?: Float;
  bokehShape?: string;
  bokehCenterX?: Float;
  bokehCenterY?: Float;


  // Long Shutter Smear Trail
  longExposureAmount?: Float;
  longExposureDirection?: Float;
  longExposureThreshold?: Float;
  longExposureCenterX?: Float;
  longExposureCenterY?: Float;

  // Added for real-time grading updates
  brightness?: Float;
  hslAdjustments?: ReadonlyArray<Double>;

  cropX?: Float;
  cropY?: Float;
  cropWidth?: Float;
  cropHeight?: Float;
  zoomScale?: Float;
  zoomX?: Float;
  zoomY?: Float;
}

export default codegenNativeComponent<NativeProps>('LogVideoPlayer');
