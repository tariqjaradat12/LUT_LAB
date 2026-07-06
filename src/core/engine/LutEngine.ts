import { ColorGradingEngine, LogFormat } from './ColorGradingEngine';
import { EditingEngine, EditParams } from './EditingEngine';
import { getBuiltInLuts } from '../presets/BuiltInLuts';

export interface LutData {
  size: number;
  table: [number, number, number][][][]; // 3D array indexed as table[B][G][R] -> [R, G, B]
}

export class LutEngine {
  /**
   * Compiles the active user adjustments into a standard .cube 3D LUT format.
   * Uses standard grid size 33.
   * Outputs a string that can be directly written to a file for other tools (Resolve, Premiere).
   */
  public static compileLut(
    format: LogFormat,
    params: EditParams,
    title = 'LUTLABCustomLUT'
  ): string {
    const size = 33;
    const header = [
      `# Mapped via LUT LAB GPU Color Grading Suite`,
      `# Decodes ${format.toUpperCase()} and applies color/tone parameters`,
      `TITLE "${title}"`,
      `LUT_3D_SIZE ${size}`,
      `DOMAIN_MIN 0.0 0.0 0.0`,
      `DOMAIN_MAX 1.0 1.0 1.0`,
      ``,
    ].join('\n');

    const lines: string[] = [];

    // Adobe .cube spec: Red sweeps fastest, then Green, then Blue.
    for (let b = 0; b < size; b++) {
      const normB = b / (size - 1);
      for (let g = 0; g < size; g++) {
        const normG = g / (size - 1);
        for (let r = 0; r < size; r++) {
          const normR = r / (size - 1);

          // Convert Log to Linear
          const linR = ColorGradingEngine.logToLinearValue(normR, format);
          const linG = ColorGradingEngine.logToLinearValue(normG, format);
          const linB = ColorGradingEngine.logToLinearValue(normB, format);

          // Apply all adjustments using EditingEngine
          const [outR, outG, outB] = EditingEngine.applyAllTools(
            linR,
            linG,
            linB,
            params
          );

          lines.push(`${outR.toFixed(6)} ${outG.toFixed(6)} ${outB.toFixed(6)}`);
        }
      }
    }

    return header + lines.join('\n');
  }

  /**
   * Parses an external .cube file content string and returns a structured LutData object.
   * Supports both 3D LUT formats.
   */
  public static parseLut(cubeContent: string | { content?: string }): LutData {
    const raw = typeof cubeContent === 'string'
      ? cubeContent
      : (cubeContent?.content ?? '');
    const lines = raw.split(/\r?\n/);
    let size = 33; // Default fallback
    const rgbValues: [number, number, number][] = [];

    for (const line of lines) {
      // Remove inline and trailing comments starting with '#'
      const commentIndex = line.indexOf('#');
      const cleanLine = commentIndex !== -1 ? line.substring(0, commentIndex) : line;
      const trimmed = cleanLine.trim();
      
      // Skip empty lines
      if (trimmed.length === 0) {
        continue;
      }

      // Check header values
      if (trimmed.startsWith('LUT_3D_SIZE')) {
        const parts = trimmed.split(/\s+/);
        size = parseInt(parts[1], 10);
        continue;
      }

      if (trimmed.startsWith('TITLE') || trimmed.startsWith('DOMAIN_MIN') || trimmed.startsWith('DOMAIN_MAX')) {
        continue;
      }

      // Support comma separators by replacing them with space
      const normalized = trimmed.replace(/,/g, ' ');
      const rgbParts = normalized.trim().split(/\s+/);
      if (rgbParts.length >= 3) {
        const r = parseFloat(rgbParts[0]);
        const g = parseFloat(rgbParts[1]);
        const b = parseFloat(rgbParts[2]);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
          rgbValues.push([r, g, b]);
        }
      }
    }

    // Auto-scale integer coordinate values if they exceed 1.0
    let maxVal = 0;
    for (const val of rgbValues) {
      maxVal = Math.max(maxVal, val[0], val[1], val[2]);
    }
    if (maxVal > 1.0) {
      let divisor = 1.0;
      if (maxVal <= 255.0) {
        divisor = 255.0;
      } else if (maxVal <= 1023.0) {
        divisor = 1023.0;
      } else if (maxVal <= 4095.0) {
        divisor = 4095.0;
      } else if (maxVal <= 65535.0) {
        divisor = 65535.0;
      } else {
        divisor = maxVal;
      }
      for (let i = 0; i < rgbValues.length; i++) {
        rgbValues[i][0] /= divisor;
        rgbValues[i][1] /= divisor;
        rgbValues[i][2] /= divisor;
      }
    }

    // Reconstruct 3D array: table[b][g][r]
    // Red changes fastest, then green, then blue.
    const table: [number, number, number][][][] = [];
    let dataIndex = 0;

    for (let b = 0; b < size; b++) {
      const gPlane: [number, number, number][][] = [];
      for (let g = 0; g < size; g++) {
        const rRow: [number, number, number][] = [];
        for (let r = 0; r < size; r++) {
          if (dataIndex < rgbValues.length) {
            rRow.push(rgbValues[dataIndex]);
            dataIndex++;
          } else {
            // Identity fallback if file contains insufficient data
            rRow.push([r / (size - 1), g / (size - 1), b / (size - 1)]);
          }
        }
        gPlane.push(rRow);
      }
      table.push(gPlane);
    }

    return { size, table };
  }

  /**
   * Resamples a LutData object to a standard 33x33x33 grid size.
   * Uses trilinear interpolation to build a new 33x33x33 table.
   */
  public static resampleLut33(lut: LutData): LutData {
    if (lut.size === 33) {
      return lut;
    }
    const size = 33;
    const table: [number, number, number][][][] = [];
    for (let b = 0; b < size; b++) {
      const gPlane: [number, number, number][][] = [];
      const normB = b / (size - 1);
      for (let g = 0; g < size; g++) {
        const rRow: [number, number, number][] = [];
        const normG = g / (size - 1);
        for (let r = 0; r < size; r++) {
          const normR = r / (size - 1);
          const val = LutEngine.applyLutTrilinear(normR, normG, normB, lut);
          rRow.push(val);
        }
        gPlane.push(rRow);
      }
      table.push(gPlane);
    }
    return { size, table };
  }

  /**
   * Rebuilds a 3D table from a flat array.
   */
  public static rebuildTable(size: number, data: number[]): [number, number, number][][][] {
    const table: [number, number, number][][][] = [];
    let idx = 0;
    for (let b = 0; b < size; b++) {
      const gPlane: [number, number, number][][] = [];
      for (let g = 0; g < size; g++) {
        const rRow: [number, number, number][] = [];
        for (let r = 0; r < size; r++) {
          if (idx + 2 < data.length) {
            rRow.push([data[idx], data[idx + 1], data[idx + 2]]);
            idx += 3;
          } else {
            rRow.push([r / (size - 1), g / (size - 1), b / (size - 1)]);
          }
        }
        gPlane.push(rRow);
      }
      table.push(gPlane);
    }
    return table;
  }

  /**
   * Resolves the active LUT preset ID into flat Float32Array values of size 33.
   */
  public static getLutParams(
    activeLutPresetId: string | null,
    customLutData: number[] | null,
    customLutSize: number,
    importedLuts: Array<{ id: string; name: string; data: number[]; size: number }>
  ): { lutData: number[]; lutSize: number } {
    if (!activeLutPresetId) {
      return { lutData: [], lutSize: 0 };
    }

    if (activeLutPresetId === 'custom') {
      return {
        lutData: customLutData || [],
        lutSize: customLutSize || 33
      };
    }

    if (activeLutPresetId.startsWith('imported_')) {
      const match = importedLuts.find(l => l.id === activeLutPresetId);
      return {
        lutData: match ? match.data : [],
        lutSize: match ? match.size : 33
      };
    }

    const size = 33;
    const data = new Float32Array(size * size * size * 3);
    let idx = 0;

    if (activeLutPresetId.startsWith('procedural_')) {
      for (let b = 0; b < size; b++) {
        const normB = b / (size - 1);
        for (let g = 0; g < size; g++) {
          const normG = g / (size - 1);
          for (let r = 0; r < size; r++) {
            const normR = r / (size - 1);
            let outR = normR;
            let outG = normG;
            let outB = normB;
            if (activeLutPresetId === 'procedural_7') {
              outR = normR * 0.393 + normG * 0.769 + normB * 0.189;
              outG = normR * 0.349 + normG * 0.686 + normB * 0.168;
              outB = normR * 0.272 + normG * 0.534 + normB * 0.131;
            } else if (activeLutPresetId === 'procedural_8') {
              const grey = 0.2126 * normR + 0.7152 * normG + 0.0722 * normB;
              const c = Math.pow(grey, 1.45);
              outR = c; outG = c; outB = c;
            } else if (activeLutPresetId === 'procedural_9') {
              outR = normR * 0.78;
              outG = normG * 1.16;
              outB = normB * 0.82;
            } else if (activeLutPresetId === 'procedural_10') {
              outR = normR * 1.25;
              outG = normG * 0.75;
              outB = normB * 1.35;
            }
            data[idx++] = outR;
            data[idx++] = outG;
            data[idx++] = outB;
          }
        }
      }
    } else {
      const presets = getBuiltInLuts();
      const preset = presets.find(l => l.id === activeLutPresetId);
      if (preset) {
        const table = preset.table;
        for (let b = 0; b < size; b++) {
          for (let g = 0; g < size; g++) {
            for (let r = 0; r < size; r++) {
              const val = table[b][g][r];
              data[idx++] = val[0];
              data[idx++] = val[1];
              data[idx++] = val[2];
            }
          }
        }
      }
    }

    return {
      lutData: Array.from(data),
      lutSize: size
    };
  }

  /**
   * Applies a 3D LUT to a single input pixel color using trilinear interpolation.
   * Maps input pixel coordinate to cell indexes, grabs the 8 surrounding grid coordinates,
   * and computes the final weighted color.
   */
  public static applyLutTrilinear(
    r: number,
    g: number,
    b: number,
    lut: LutData
  ): [number, number, number] {
    const size = lut.size;
    const table = lut.table;

    // Clamp input to [0, 1]
    const clR = Math.min(1.0, Math.max(0.0, r));
    const clG = Math.min(1.0, Math.max(0.0, g));
    const clB = Math.min(1.0, Math.max(0.0, b));

    // Calculate position in LUT coordinates
    const x = clR * (size - 1);
    const y = clG * (size - 1);
    const z = clB * (size - 1);

    // Surrounding indices
    const x0 = Math.floor(x);
    const x1 = Math.min(x0 + 1, size - 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(y0 + 1, size - 1);
    const z0 = Math.floor(z);
    const z1 = Math.min(z0 + 1, size - 1);

    // Interpolation weights
    const dx = x - x0;
    const dy = y - y0;
    const dz = z - z0;

    // Grabbing the 8 corners
    const c000 = table[z0][y0][x0];
    const c100 = table[z0][y0][x1];
    const c010 = table[z0][y1][x0];
    const c110 = table[z0][y1][x1];
    const c001 = table[z1][y0][x0];
    const c101 = table[z1][y0][x1];
    const c011 = table[z1][y1][x0];
    const c111 = table[z1][y1][x1];

    // Linear interpolation along X-axis
    const c00 = interpolateVector(c000, c100, dx);
    const c01 = interpolateVector(c001, c101, dx);
    const c10 = interpolateVector(c010, c110, dx);
    const c11 = interpolateVector(c011, c111, dx);

    // Linear interpolation along Y-axis
    const c0 = interpolateVector(c00, c10, dy);
    const c1 = interpolateVector(c01, c11, dy);

    // Linear interpolation along Z-axis (final graded color)
    return interpolateVector(c0, c1, dz);
  }
}

// Inline helper for vector interpolation
function interpolateVector(
  v0: [number, number, number],
  v1: [number, number, number],
  t: number
): [number, number, number] {
  return [
    v0[0] * (1.0 - t) + v1[0] * t,
    v0[1] * (1.0 - t) + v1[1] * t,
    v0[2] * (1.0 - t) + v1[2] * t,
  ];
}
