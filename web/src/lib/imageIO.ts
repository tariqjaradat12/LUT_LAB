export async function loadImageFromFile(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a JPEG or PNG photo.');
  }
  const decoded = await createImageBitmap(file);
  // Flatten any alpha onto black so semi-transparent PNGs don't look washed/faded.
  const flat = document.createElement('canvas');
  flat.width = decoded.width;
  flat.height = decoded.height;
  const ctx = flat.getContext('2d', { colorSpace: 'srgb' })!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(decoded, 0, 0);
  decoded.close();
  return createImageBitmap(flat);
}

export function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  type: 'image/png' | 'image/jpeg' = 'image/png',
) {
  const url = canvas.toDataURL(type, 0.92);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
