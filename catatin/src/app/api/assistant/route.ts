import { NextResponse } from 'next/server';
import { askText, isAIConfigured } from '@/lib/server/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `Anda adalah "AI Keuangan" di aplikasi CATATIN, asisten keuangan pribadi berbahasa Indonesia.

Aturan wajib:
- Jawab HANYA berdasarkan DATA_KEUANGAN yang diberikan. Jangan mengarang angka.
- Kalau data yang dibutuhkan tidak ada, katakan terus terang dan sebutkan apa yang perlu dicatat dulu.
- Format semua nominal sebagai Rupiah, contoh: Rp 1.250.000.
- Jawab ringkas dan konkret: mulai dengan angka/kesimpulan, lalu 2-4 poin pendukung.
- Kalau pengguna minta saran penghematan, sebutkan kategori dan merchant spesifik dari datanya beserta perkiraan penghematan per bulan.
- Nada: hangat, lugas, tanpa menggurui, tanpa jargon berlebihan.
- Gunakan bullet "•" bila perlu. Maksimal sekitar 180 kata kecuali diminta lebih detail.`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string;
      context?: unknown;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    const question = (body.question || '').trim();
    if (!question) return NextResponse.json({ ok: false, error: 'Pertanyaan kosong.' }, { status: 400 });

    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'AI Keuangan butuh ANTHROPIC_API_KEY di file .env.local. Sementara itu, ringkasan otomatis di Dashboard & Laporan tetap dihitung dari data Anda.',
        },
        { status: 503 },
      );
    }

    const history = (body.history || []).slice(-8);
    const contextBlock = `DATA_KEUANGAN (JSON, satuan Rupiah):\n${JSON.stringify(body.context ?? {})}`;

    const answer = await askText({
      system: SYSTEM,
      messages: [
        ...history,
        { role: 'user', content: `${contextBlock}\n\nPERTANYAAN PENGGUNA:\n${question}` },
      ],
      maxTokens: 1200,
    });

    return NextResponse.json({ ok: true, answer });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI gagal menjawab.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
