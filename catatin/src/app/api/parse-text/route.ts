import { NextResponse } from 'next/server';
import { askJSON, isAIConfigured } from '@/lib/server/ai';
import { normalizeParsed } from '@/lib/server/normalize';
import { parseFreeText } from '@/lib/parser';
import { CATEGORY_NAMES } from '@/lib/defaults';
import type { ParseResponse } from '@/lib/types';

export const runtime = 'nodejs';

const SYSTEM = `Anda mengubah kalimat bebas berbahasa Indonesia menjadi satu transaksi keuangan terstruktur.
Jawab HANYA satu objek JSON, tanpa penjelasan.
Pahami satuan lisan: "75 ribu"=75000, "1,5 juta"=1500000, "50rb"=50000, "25k"=25000.
transaction_type: "income" untuk uang masuk (gaji, bonus, terima transfer), "transfer" untuk pindah dana antar rekening/top up sendiri, selain itu "expense".
payment_method pilih salah satu: Cash, Debit, Kartu Kredit, Transfer Bank, QRIS, E-Wallet, Virtual Account, Lainnya.
confidence 0..1 sesuai kejelasan kalimat. Jangan mengarang nominal yang tidak disebutkan.`;

export async function POST(request: Request): Promise<NextResponse<ParseResponse>> {
  try {
    const body = (await request.json()) as { text?: string; categories?: string[] };
    const text = (body.text || '').trim();
    const categories = body.categories?.length ? body.categories : CATEGORY_NAMES;

    if (!text) {
      return NextResponse.json({ ok: false, error: 'Teks kosong.' }, { status: 400 });
    }

    if (isAIConfigured()) {
      const raw = await askJSON<Record<string, unknown>>({
        system: SYSTEM,
        prompt: `Kategori tersedia (pilih tepat satu, salin persis): ${categories.join(', ')}.
Tanggal hari ini: ${new Date().toISOString().slice(0, 10)}.
Kalimat pengguna: "${text.slice(0, 800)}"

Keluarkan JSON:
{"date":"YYYY-MM-DD","time":"HH:MM","merchant":"","amount":0,"currency":"IDR","category":"","payment_method":"","transaction_type":"expense","reference_number":"","items":[],"notes":"","confidence":0.0}`,
        maxTokens: 700,
      });
      const data = normalizeParsed({ notes: text, ...raw }, categories);
      return NextResponse.json({
        ok: true,
        data,
        engine: 'ai',
        warning: data.confidence < 0.8 ? 'Data transaksi kurang jelas. Mohon periksa kembali.' : undefined,
      });
    }

    // Fallback tanpa LLM: parser heuristik bahasa Indonesia.
    const data = normalizeParsed(parseFreeText(text), categories);
    return NextResponse.json({
      ok: true,
      data,
      engine: 'heuristik',
      warning: 'AI belum aktif — hasil dibaca dengan aturan sederhana. Mohon periksa kembali.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Gagal memproses teks.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
