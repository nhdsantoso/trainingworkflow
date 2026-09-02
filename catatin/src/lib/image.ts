'use client';

/**
 * Image preprocessing di sisi klien — tahap pertama pipeline OCR.
 *
 * Tujuan:
 *  - memperkecil ukuran upload (hemat kuota, jauh lebih cepat),
 *  - meluruskan orientasi EXIF,
 *  - opsional menaikkan kontras & mengurangi warna supaya teks struk lebih tajam saat di-OCR.
 */

export interface PreprocessResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalSize: number;
  size: number;
}

export async function preprocessImage(
  file: File | Blob,
  opts: { maxDimension?: number; quality?: number; enhance?: boolean } = {},
): Promise<PreprocessResult> {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.86;
  const enhance = opts.enhance ?? true;

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar.');

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  if (enhance) applyContrast(ctx, width, height);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal mengonversi gambar.'))),
      'image/jpeg',
      quality,
    ),
  );

  return {
    blob,
    dataUrl: canvas.toDataURL('image/jpeg', Math.min(quality, 0.7)),
    width,
    height,
    originalSize: file.size,
    size: blob.size,
  };
}

/** Peregangan kontras ringan + sedikit desaturasi: membantu OCR pada struk termal yang pudar. */
function applyContrast(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;

  // Cari persentil 5% dan 95% dari luminance sebagai titik hitam/putih.
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    hist[lum | 0]++;
  }
  const total = width * height;
  let low = 0;
  let high = 255;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc > total * 0.05) {
      low = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc > total * 0.05) {
      high = i;
      break;
    }
  }
  const range = Math.max(24, high - low);

  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = ((d[i + c] - low) / range) * 255;
      d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  ctx.putImageData(image, 0, 0);
}

async function loadBitmap(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* jatuh ke <img> di bawah */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal membuka gambar.'));
    };
    img.src = url;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
