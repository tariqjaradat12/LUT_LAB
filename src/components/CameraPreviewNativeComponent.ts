import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ViewProps } from 'react-native';
import type { Double, Float, Int32, DirectEventHandler } from 'react-native/Libraries/Types/CodegenTypes';

export interface CameraPreviewNativeProps extends ViewProps {
  // Camera-specific Props
  activeCameraId?: string;
  iso?: Int32;
  shutterSpeed?: Int32;
  whiteBalanceMode?: string;
  meteringMode?: string;
  focusMode?: string;
  focusDistance?: Float;
  flashMode?: string;

  // Real-time Grading/Adjustments Props
  logFormat?: string;
  exposure?: Float;
  contrast?: Float;
  saturation?: Float;
  gamma?: Float;
  brightness?: Float;
  temperature?: Float;
  tint?: Float;
  highlights?: Float;
  shadows?: Float;
  toneContrast?: Float;
  vibrance?: Float;
  hueRotation?: Float;

  // Array / Complex Parameters
  curvesLut?: ReadonlyArray<Double>;
  colorWheels?: ReadonlyArray<Double>;
  hslAdjustments?: ReadonlyArray<Double>;
  vignetteParams?: ReadonlyArray<Double>;
  
  // LUT Texture Parameters
  lutData?: ReadonlyArray<Double>;
  lutSize?: Float;
  lutIntensity?: Float;

  // Detail & Overhauls
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

  // Resolution & Processing modes
  highMpMode?: boolean;
  unprocessed?: boolean;

  // Native Event Callbacks
  onCameraInfo?: DirectEventHandler<Readonly<{
    cameraId: string;
    focalLengthText: string;
  }>>;
}

export default codegenNativeComponent<CameraPreviewNativeProps>('CameraPreview');
