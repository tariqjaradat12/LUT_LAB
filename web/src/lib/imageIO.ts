export async function loadImageFromFile(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a JPEG, PNG, or WebP photo.');
  }

  // Honor EXIF orientation; keep straight alpha so we don't darken the photo.
  let decoded: ImageBitmap;
  try {
    decoded = await createImageBitmap(file, {
      imageOrientation: 'from-image',
      premultiplyAlpha: 'none',
    });
  } catch {
    decoded = await createImageBitmap(file);
  }

  const canvas = document.createElement('canvas');
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb', alpha: true });
  if (!ctx) {
    decoded.close();
    throw new Error('Could not decode that photo.');
  }

  // Draw onto a clear buffer — do NOT fill black first (that darkens any non-opaque pixels).
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(decoded, 0, 0);
  decoded.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 255) continue;
    if (a === 0) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 255;
      continue;
    }
    // Straight alpha → opaque over black, preserving look of translucent edges only.
    const aa = a / 255;
    d[i] = Math.round(d[i] * aa);
    d[i + 1] = Math.round(d[i + 1] * aa);
    d[i + 2] = Math.round(d[i + 2] * aa);
    d[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  try {
    return await createImageBitmap(canvas, { premultiplyAlpha: 'none' });
  } catch {
    return createImageBitmap(canvas);
  }
}

export function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  type: 'image/png' | 'image/jpeg' = 'image/jpeg',
) {
  const url = canvas.toDataURL(type, 0.95);
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
