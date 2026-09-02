import 'server-only';

/**
 * Lapisan OCR.
 *
 * Dua provider didukung:
 *  - "ocrspace"  : OCR.space API (gratis untuk volume kecil) — set OCR_SPACE_API_KEY
 *  - "google"    : Google Cloud Vision DOCUMENT_TEXT_DETECTION — set GOOGLE_VISION_API_KEY
 *  - "llm"       : tanpa OCR API, gambar dibaca langsung oleh model vision (default fallback)
 *
 * Teks mentah hasil OCR dipakai sebagai input untuk AI transaction parser.
 */
export type OcrProvider = 'ocrspace' | 'google' | 'llm';

export function activeOcrProvider(): OcrProvider {
  const explicit = (process.env.OCR_PROVIDER || '').toLowerCase();
  if (explicit === 'ocrspace' && process.env.OCR_SPACE_API_KEY) return 'ocrspace';
  if (explicit === 'google' && process.env.GOOGLE_VISION_API_KEY) return 'google';
  if (explicit === 'llm') return 'llm';
  if (process.env.OCR_SPACE_API_KEY) return 'ocrspace';
  if (process.env.GOOGLE_VISION_API_KEY) return 'google';
  return 'llm';
}

export interface OcrResult {
  text: string;
  provider: OcrProvider;
  confidence: number | null;
}

export async function runOcr(base64: string, mediaType: string): Promise<OcrResult> {
  const provider = activeOcrProvider();
  if (provider === 'ocrspace') return ocrSpace(base64, mediaType);
  if (provider === 'google') return googleVision(base64);
  return { text: '', provider: 'llm', confidence: null };
}

async function ocrSpace(base64: string, mediaType: string): Promise<OcrResult> {
  const body = new URLSearchParams({
    base64Image: `data:${mediaType};base64,${base64}`,
    language: process.env.OCR_SPACE_LANGUAGE || 'eng',
    isOverlayRequired: 'false',
    scale: 'true',
    OCREngine: '2',
    detectOrientation: 'true',
  });

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      apikey: process.env.OCR_SPACE_API_KEY as string,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) throw new Error(`OCR.space gagal (HTTP ${res.status}).`);

  const json = (await res.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
    ParsedResults?: Array<{ ParsedText?: string; TextOrientation?: string }>;
  };

  if (json.IsErroredOnProcessing) {
    const msg = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(', ') : json.ErrorMessage;
    throw new Error(`OCR.space: ${msg || 'gagal memproses gambar'}`);
  }

  const text = (json.ParsedResults || []).map((r) => r.ParsedText || '').join('\n').trim();
  return { text, provider: 'ocrspace', confidence: text.length > 40 ? 0.9 : 0.6 };
}

async function googleVision(base64: string): Promise<OcrResult> {
  const key = process.env.GOOGLE_VISION_API_KEY as string;
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['id', 'en'] },
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Google Vision gagal (HTTP ${res.status}).`);

  const json = (await res.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      error?: { message?: string };
    }>;
  };

  const first = json.responses?.[0];
  if (first?.error?.message) throw new Error(`Google Vision: ${first.error.message}`);

  const text = first?.fullTextAnnotation?.text?.trim() || '';
  return { text, provider: 'google', confidence: text.length > 40 ? 0.92 : 0.6 };
}
