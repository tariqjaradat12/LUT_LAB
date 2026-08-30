import type { CurvePoint, EditParams, HSLAdjustments } from '../engine/types';
import { DEFAULT_EDIT_PARAMS, defaultCurve, HUE_BANDS } from '../engine/types';

function cloneCurvePoints(points: CurvePoint[]): CurvePoint[] {
  return points.map((p) => ({ ...p }));
}

function cloneHsl(hsl: HSLAdjustments): HSLAdjustments {
  const out = {} as HSLAdjustments;
  for (const band of HUE_BANDS) {
    out[band] = { ...hsl[band] };
  }
  return out;
}

/** Fresh defaults — never reuse a shared object (fixes reset / hidden fade). */
export function cloneDefaultParams(): EditParams {
  return {
    ...DEFAULT_EDIT_PARAMS,
    bokehCenter: { ...DEFAULT_EDIT_PARAMS.bokehCenter },
    linearMaskStart: { ...DEFAULT_EDIT_PARAMS.linearMaskStart },
    linearMaskEnd: { ...DEFAULT_EDIT_PARAMS.linearMaskEnd },
    circularMaskCenter: { ...DEFAULT_EDIT_PARAMS.circularMaskCenter },
    doubleExposureOffset: { ...DEFAULT_EDIT_PARAMS.doubleExposureOffset },
    curves: {
      rgb: cloneCurvePoints(DEFAULT_EDIT_PARAMS.curves.rgb),
      r: cloneCurvePoints(DEFAULT_EDIT_PARAMS.curves.r),
      g: cloneCurvePoints(DEFAULT_EDIT_PARAMS.curves.g),
      b: cloneCurvePoints(DEFAULT_EDIT_PARAMS.curves.b),
    },
    hsl: cloneHsl(DEFAULT_EDIT_PARAMS.hsl),
  };
}

export function resetCurveChannel(): CurvePoint[] {
  return defaultCurve();
}
