const fs = require('fs');
const path = require('path');

const LUTS_DIR = path.join(__dirname, '../luts');
const OUTPUT_FILE = path.join(__dirname, '../src/core/presets/BuiltInLuts.ts');

function findCubeFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findCubeFiles(filePath, fileList);
    } else if (file.endsWith('.cube')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function parseCube(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  let size = 33;
  let title = path.basename(filePath, '.cube');
  const rgbValues = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }
    if (trimmed.startsWith('LUT_3D_SIZE')) {
      size = parseInt(trimmed.split(/\s+/)[1], 10);
      continue;
    }
    if (trimmed.startsWith('TITLE')) {
      // Extract title in quotes
      const match = trimmed.match(/"([^"]+)"/);
      if (match) title = match[1];
      continue;
    }
    if (trimmed.startsWith('DOMAIN_MIN') || trimmed.startsWith('DOMAIN_MAX')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        rgbValues.push([r, g, b]);
      }
    }
  }

  // To prevent huge nested AST in Metro bundler, we output a flat float string and parse it at runtime.
  // This drastically improves compile time and keeps the TS file light.
  const flatFloats = [];
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const idx = b * size * size + g * size + r;
        const val = rgbValues[idx] || [r / (size - 1), g / (size - 1), b / (size - 1)];
        flatFloats.push(val[0].toFixed(5), val[1].toFixed(5), val[2].toFixed(5));
      }
    }
  }

  return {
    title,
    size,
    flatFloatsString: flatFloats.join(',')
  };
}

function main() {
  console.log('Searching for .cube files in luts directory...');
  const cubeFiles = findCubeFiles(LUTS_DIR);
  console.log(`Found ${cubeFiles.length} files:`);
  cubeFiles.forEach(f => console.log(` - ${path.relative(LUTS_DIR, f)}`));

  const presets = cubeFiles.map((filePath, idx) => {
    console.log(`Parsing ${path.basename(filePath)}...`);
    const parsed = parseCube(filePath);
    return {
      id: `lut_${idx + 1}`,
      name: `lut ${idx + 1}`, // default sequential naming
      originalTitle: parsed.title,
      size: parsed.size,
      dataStr: parsed.flatFloatsString
    };
  });

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileContent = `/**
 * BuiltInLutsPresets — Dynamically compiled preset LUTs.
 * Handled via flat-string load to optimize bundling and compilation times.
 */

export interface PresetLut {
  id: string;
  name: string;
  originalTitle: string;
  size: number;
  table: [number, number, number][][][];
}

const PARSED_PRESETS: PresetLut[] = [];

const PRESET_RAW_DATA = [
${presets.map(p => `  {
    id: ${JSON.stringify(p.id)},
    name: ${JSON.stringify(p.name)},
    originalTitle: ${JSON.stringify(p.originalTitle)},
    size: ${p.size},
    data: "${p.dataStr}"
  }`).join(',\n')}
];

// Trilinearly unpack flat-string representations into 3D lookup tables
function unpackTable(size: number, dataStr: string): [number, number, number][][][] {
  const parts = dataStr.split(',');
  const table: [number, number, number][][][] = [];
  let index = 0;

  for (let b = 0; b < size; b++) {
    const gPlane: [number, number, number][][] = [];
    for (let g = 0; g < size; g++) {
      const rRow: [number, number, number][] = [];
      for (let r = 0; r < size; r++) {
        const val: [number, number, number] = [
          parseFloat(parts[index]),
          parseFloat(parts[index + 1]),
          parseFloat(parts[index + 2])
        ];
        rRow.push(val);
        index += 3;
      }
      gPlane.push(rRow);
    }
    table.push(gPlane);
  }
  return table;
}

export function getBuiltInLuts(): PresetLut[] {
  if (PARSED_PRESETS.length === 0) {
    for (const raw of PRESET_RAW_DATA) {
      PARSED_PRESETS.push({
        id: raw.id,
        name: raw.name,
        originalTitle: raw.originalTitle,
        size: raw.size,
        table: unpackTable(raw.size, raw.data)
      });
    }
  }
  return PARSED_PRESETS;
}
`;

  fs.writeFileSync(OUTPUT_FILE, fileContent, 'utf-8');
  console.log(`Successfully generated built-in presets file at ${OUTPUT_FILE}`);
}

main();
