export async function loadImageFromFile(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a JPEG or PNG photo.');
  }
  const bitmap = await createImageBitmap(file);
  return bitmap;
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
