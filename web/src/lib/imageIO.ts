/**
 * Absolute safety cap — only used when a photo exceeds what most GPUs allow
 * as a WebGL texture (often 8192). Editing otherwise keeps original resolution.
 */
export const MAX_TEXTURE_EDGE = 8192;

function fitWithinEdge(width: number, height: number, maxEdge: number) {
  const edge = Math.max(width, height);
  if (edge <= maxEdge || edge < 1) return { width, height };
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeOriented(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, {
      imageOrientation: 'from-image',
      premultiplyAlpha: 'none',
    });
  } catch {
    return createImageBitmap(file);
  }
}

async function downscaleBitmap(source: ImageBitmap, width: number, height: number): Promise<ImageBitmap> {
  if (source.width === width && source.height === height) return source;
  try {
    const scaled = await createImageBitmap(source, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
      premultiplyAlpha: 'none',
    });
    source.close();
    return scaled;
  } catch {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      source.close();
      throw new Error('Could not resize that photo.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    source.close();
    try {
      return await createImageBitmap(canvas, { premultiplyAlpha: 'none' });
    } catch {
      return createImageBitmap(canvas);
    }
  }
}

/**
 * Decode a photo at original resolution for editing/export.
 * Only downscales if larger than MAX_TEXTURE_EDGE (GPU limit).
 * Avoids the old per-pixel getImageData scan that froze large files.
 */
export async function loadImageFromFile(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a JPEG, PNG, or WebP photo.');
  }

  let decoded = await decodeOriented(file);
  const fitted = fitWithinEdge(decoded.width, decoded.height, MAX_TEXTURE_EDGE);
  if (fitted.width !== decoded.width || fitted.height !== decoded.height) {
    decoded = await downscaleBitmap(decoded, fitted.width, fitted.height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb', alpha: true });
  if (!ctx) {
    decoded.close();
    throw new Error('Could not decode that photo.');
  }

  // Opaque composite without scanning every pixel (that froze multi‑MP photos).
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(decoded, 0, 0);
  decoded.close();

  try {
    return await createImageBitmap(canvas, { premultiplyAlpha: 'none' });
  } catch {
    return createImageBitmap(canvas);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
