import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Semua pemanggilan LLM dilakukan di server.
 * API key TIDAK PERNAH dikirim ke browser (tidak memakai prefix NEXT_PUBLIC_).
 */
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-5';

export function isAIConfigured(): boolean {
  return Boolean(API_KEY);
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY belum diisi di environment.');
  if (!client) client = new Anthropic({ apiKey: API_KEY });
  return client;
}

export interface VisionInput {
  mediaType: string;
  base64: string;
}

/**
 * Memanggil model dan memaksa jawaban berupa JSON valid.
 * `image` opsional — kalau diisi, model membaca gambar langsung (OCR + parsing sekaligus).
 */
export async function askJSON<T>(opts: {
  system: string;
  prompt: string;
  image?: VisionInput | null;
  maxTokens?: number;
}): Promise<T> {
  const anthropic = getClient();

  const content: Anthropic.MessageParam['content'] = [];
  if (opts.image) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: opts.image.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        data: opts.image.base64,
      },
    });
  }
  content.push({ type: 'text', text: opts.prompt });

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system,
    messages: [
      { role: 'user', content },
      // Prefill "{" memaksa model langsung menulis JSON tanpa basa-basi.
      { role: 'assistant', content: '{' },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return parseJSONLoose<T>(`{${text}`);
}

/** Jawaban bebas (dipakai untuk AI Keuangan). */
export async function askText(opts: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}): Promise<string> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 1200,
    system: opts.system,
    messages: opts.messages,
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/** Toleran terhadap code fence atau teks tambahan di sekitar JSON. */
export function parseJSONLoose<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error('Model tidak mengembalikan JSON yang valid.');
  }
}
