export type LogFormat = 'slog3' | 'clog' | 'dlog' | 'rec709' | 'arrilogc3' | 'arrilogc4' | 'redlog3g10' | 'flog' | 'flog2' | 'vlog' | 'hlg';

export interface GradingParameters {
  exposure: number;   // -2.0 to 2.0
  contrast: number;   // 0.5 to 2.0
  saturation: number; // 0.0 to 2.0
  gamma: number;      // 0.5 to 2.0
}

export class ColorGradingEngine {
  /**
   * Log mathematical coefficients for GPU conversion formulas.
   * Exposing them in core allows shared validation and configuration.
   */
  public static getLogCoefficients(format: LogFormat) {
    switch (format) {
      case 'slog3':
        return {
          a: 0.078,
          b: 0.14,
          c: 0.2615,
          d: 0.092784,
          e: 0.015636,
          f: 1.022377,
        };
      case 'clog':
        // Canon Log 1 curves
        return {
          a: 0.529136,
          b: 0.073059,
          c: 1.0,
          d: 0.0,
          e: 0.0,
          f: 1.0,
        };
      case 'dlog':
        // DJI D-Log curves
        return {
          a: 0.58,
          b: 0.0075,
          c: 1.4,
          d: 0.0,
          e: 0.0,
          f: 1.0,
        };
      case 'rec709':
      default:
        return {
          a: 1.0,
          b: 0.0,
          c: 1.0,
          d: 0.0,
          e: 0.0,
          f: 1.0,
        };
    }
  }

  /**
   * Pure TypeScript implementation of Log conversion for software/simulation rendering.
   * Implements Log to Linear and grading adjustments in CPU-space.
   */
  public static gradePixel(
    r: number,
    g: number,
    b: number,
    format: LogFormat,
    params: GradingParameters
  ): [number, number, number] {
    // 1. Convert Log to Linear
    let linR = this.logToLinearValue(r, format);
    let linG = this.logToLinearValue(g, format);
    let linB = this.logToLinearValue(b, format);

    // 2. Exposure adjustment
    const expFactor = Math.pow(2.0, params.exposure);
    linR *= expFactor;
    linG *= expFactor;
    linB *= expFactor;

    // 3. Contrast adjustment
    linR = Math.max(0, (linR - 0.5) * params.contrast + 0.5);
    linG = Math.max(0, (linG - 0.5) * params.contrast + 0.5);
    linB = Math.max(0, (linB - 0.5) * params.contrast + 0.5);

    // 4. Gamma correction
    const invGamma = 1.0 / params.gamma;
    linR = Math.pow(linR, invGamma);
    linG = Math.pow(linG, invGamma);
    linB = Math.pow(linB, invGamma);

    // 5. Saturation adjustment
    const luma = 0.2126 * linR + 0.7152 * linG + 0.0722 * linB;
    linR = Math.max(0, luma + (linR - luma) * params.saturation);
    linG = Math.max(0, luma + (linG - luma) * params.saturation);
    linB = Math.max(0, luma + (linB - luma) * params.saturation);

    return [
      Math.min(1.0, linR),
      Math.min(1.0, linG),
      Math.min(1.0, linB),
    ];
  }

  public static logToLinearValue(val: number, format: LogFormat): number {
    if (format === 'rec709' || format === 'hlg') return val;

    if (format === 'slog3') {
      // Sony S-Log3 standard curve formula
      if (val >= 0.089686) {
        return Math.pow((val - 0.015636) / 1.022377, 1.0 / 0.2615);
      } else {
        return (val - 0.092784) / 0.007291;
      }
    }

    if (format === 'arrilogc3') {
      if (val >= 0.149658) {
        return Math.pow(10.0, (val - 0.385537) / 0.2471896) * 0.076612 - 0.0093707;
      } else {
        return (val - 0.092784) / 5.3707;
      }
    }

    if (format === 'arrilogc4') {
      const t = (val - 0.492615) / 0.263009;
      return (Math.pow(10.0, t) - 0.018275) / 0.981725;
    }

    if (format === 'redlog3g10') {
      return (Math.pow(10.0, (val - 0.151703) / 0.224476) - 1.0) / 150.1977;
    }

    if (format === 'flog') {
      return Math.pow(10.0, (val - 0.382) / 0.245) * 0.0766 - 0.0094;
    }

    if (format === 'flog2') {
      return Math.pow(10.0, (val - 0.382) / 0.240) * 0.0766 - 0.0093;
    }

    if (format === 'vlog') {
      if (val >= 0.181) {
        return Math.pow(10.0, (val - 0.30) / 0.34) - 0.0075;
      } else {
        return (val - 0.125) / 5.6;
      }
    }

    // Default Log (Canon/DJI style standard logarithmic base-10 curve)
    // Formula: Vout = (pow(10, (Vin - d) / c) - b) / a
    try {
      const coefs = this.getLogCoefficients(format);
      const exponent = (val - coefs.d) / coefs.c;
      return (Math.pow(10, exponent) - coefs.b) / coefs.a;
    } catch {
      return val;
    }
  }
}
