export type LutData = {
  size: number;
  data: Float32Array;
};

export type ImportedLut = {
  id: string;
  name: string;
  size: number;
  data: Float32Array;
};

function interpolateVector(
  v0: [number, number, number],
  v1: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    v0[0] * (1 - t) + v1[0] * t,
    v0[1] * (1 - t) + v1[1] * t,
    v0[2] * (1 - t) + v1[2] * t,
  ];
}

function sampleTable(
  table: [number, number, number][][][],
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const size = table.length;
  const clR = Math.min(1, Math.max(0, r));
  const clG = Math.min(1, Math.max(0, g));
  const clB = Math.min(1, Math.max(0, b));

  const x = clR * (size - 1);
  const y = clG * (size - 1);
  const z = clB * (size - 1);

  const x0 = Math.floor(x);
  const x1 = Math.min(x0 + 1, size - 1);
  const y0 = Math.floor(y);
  const y1 = Math.min(y0 + 1, size - 1);
  const z0 = Math.floor(z);
  const z1 = Math.min(z0 + 1, size - 1);

  const dx = x - x0;
  const dy = y - y0;
  const dz = z - z0;

  const c000 = table[z0][y0][x0];
  const c100 = table[z0][y0][x1];
  const c010 = table[z0][y1][x0];
  const c110 = table[z0][y1][x1];
  const c001 = table[z1][y0][x0];
  const c101 = table[z1][y0][x1];
  const c011 = table[z1][y1][x0];
  const c111 = table[z1][y1][x1];

  const c00 = interpolateVector(c000, c100, dx);
  const c01 = interpolateVector(c001, c101, dx);
  const c10 = interpolateVector(c010, c110, dx);
  const c11 = interpolateVector(c011, c111, dx);
  const c0 = interpolateVector(c00, c10, dy);
  const c1 = interpolateVector(c01, c11, dy);
  return interpolateVector(c0, c1, dz);
}

function tableToFlat(table: [number, number, number][][][]): Float32Array {
  const size = table.length;
  const out = new Float32Array(size * size * size * 3);
  let idx = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const v = table[b][g][r];
        out[idx++] = v[0];
        out[idx++] = v[1];
        out[idx++] = v[2];
      }
    }
  }
  return out;
}

export function parseCube(content: string): LutData {
  const lines = content.split(/\r?\n/);
  let size = 33;
  const rgbValues: [number, number, number][] = [];

  for (const line of lines) {
    const commentIndex = line.indexOf('#');
    const cleanLine = commentIndex !== -1 ? line.substring(0, commentIndex) : line;
    const trimmed = cleanLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('LUT_3D_SIZE')) {
      size = parseInt(trimmed.split(/\s+/)[1], 10);
      continue;
    }
    if (
      trimmed.startsWith('TITLE') ||
      trimmed.startsWith('DOMAIN_MIN') ||
      trimmed.startsWith('DOMAIN_MAX')
    ) {
      continue;
    }

    const normalized = trimmed.replace(/,/g, ' ');
    const rgbParts = normalized.trim().split(/\s+/);
    if (rgbParts.length >= 3) {
      const r = parseFloat(rgbParts[0]);
      const g = parseFloat(rgbParts[1]);
      const b = parseFloat(rgbParts[2]);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        rgbValues.push([r, g, b]);
      }
    }
  }

  let maxVal = 0;
  for (const val of rgbValues) {
    maxVal = Math.max(maxVal, val[0], val[1], val[2]);
  }
  if (maxVal > 1) {
    let divisor = 1;
    if (maxVal <= 255) divisor = 255;
    else if (maxVal <= 1023) divisor = 1023;
    else if (maxVal <= 4095) divisor = 4095;
    else if (maxVal <= 65535) divisor = 65535;
    else divisor = maxVal;
    for (let i = 0; i < rgbValues.length; i++) {
      rgbValues[i][0] /= divisor;
      rgbValues[i][1] /= divisor;
      rgbValues[i][2] /= divisor;
    }
  }

  const table: [number, number, number][][][] = [];
  let dataIndex = 0;
  for (let b = 0; b < size; b++) {
    const gPlane: [number, number, number][][] = [];
    for (let g = 0; g < size; g++) {
      const rRow: [number, number, number][] = [];
      for (let r = 0; r < size; r++) {
        if (dataIndex < rgbValues.length) {
          rRow.push(rgbValues[dataIndex++]);
        } else {
          rRow.push([r / (size - 1), g / (size - 1), b / (size - 1)]);
        }
      }
      gPlane.push(rRow);
    }
    table.push(gPlane);
  }

  return resampleLut33({ size, table });
}

export function resampleLut33(lut: { size: number; table: [number, number, number][][][] }): LutData {
  if (lut.size === 33) {
    return { size: 33, data: tableToFlat(lut.table) };
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
        rRow.push(sampleTable(lut.table, normR, normG, normB));
      }
      gPlane.push(rRow);
    }
    table.push(gPlane);
  }
  return { size, data: tableToFlat(table) };
}

export function lutDataToTextureBytes(data: Float32Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = Math.round(Math.min(1, Math.max(0, data[i])) * 255);
  }
  return out;
}

export function importCubeContent(
  content: string,
  name: string,
  existing: ImportedLut[],
): { lut: ImportedLut; importedLuts: ImportedLut[] } {
  const parsed = parseCube(content);
  const id = `imported_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const lut: ImportedLut = {
    id,
    name: name.replace(/\.cube$/i, ''),
    size: parsed.size,
    data: parsed.data,
  };
  return { lut, importedLuts: [...existing, lut] };
}

export async function loadPresetLut(
  id: string,
  name: string,
  url: string,
): Promise<ImportedLut> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load preset "${name}".`);
  const content = await res.text();
  const parsed = parseCube(content);
  return { id, name, size: parsed.size, data: parsed.data };
}
