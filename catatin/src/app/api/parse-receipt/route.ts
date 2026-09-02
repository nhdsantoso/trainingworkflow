import { NextResponse } from 'next/server';
import { askJSON, isAIConfigured } from '@/lib/server/ai';
import { runOcr, activeOcrProvider } from '@/lib/server/ocr';
import { normalizeParsed } from '@/lib/server/normalize';
import { parseReceiptText } from '@/lib/parser';
import { CATEGORY_NAMES } from '@/lib/defaults';
import type { ParseResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

const SYSTEM = `Anda adalah mesin ekstraksi data transaksi keuangan Indonesia.
Anda membaca struk belanja, bukti transfer m-banking, bukti pembayaran e-wallet (GoPay/OVO/DANA/ShopeePay), dan tangkapan layar QRIS.
Jawab HANYA dengan satu objek JSON, tanpa penjelasan, tanpa markdown.

Aturan:
- "amount" adalah nominal akhir yang dibayar (Grand Total / Total Bayar / Nominal Transfer) dalam Rupiah, berupa angka bulat tanpa titik, tanpa "Rp".
- Abaikan subtotal, pajak terpisah, kembalian, dan saldo akhir kecuali tidak ada total.
- "date" format YYYY-MM-DD. Kalau struk tidak mencantumkan tahun, pakai tahun berjalan. Kalau tanggal tidak terbaca, pakai tanggal hari ini.
- "time" format HH:MM 24 jam. Kalau tidak ada, kosongkan string.
- "merchant" adalah nama toko/penerima transfer sesuai yang tertulis, rapikan kapitalisasinya.
- "transaction_type": "expense" untuk pembelian/pembayaran keluar, "income" untuk dana masuk (gaji, transfer masuk, refund), "transfer" untuk pemindahan antar rekening milik sendiri atau top up e-wallet.
- "payment_method" pilih salah satu: Cash, Debit, Kartu Kredit, Transfer Bank, QRIS, E-Wallet, Virtual Account, Lainnya.
- "reference_number" nomor referensi/transaksi kalau ada, selain itu string kosong.
- "items" daftar barang kalau terbaca jelas, masing-masing {name, qty, price}. Kalau tidak jelas, array kosong.
- "confidence" antara 0 dan 1: seberapa yakin Anda pada nominal DAN merchant. Jujur — beri nilai rendah (<0.8) kalau gambar buram, terpotong, atau nominal ambigu.
- Jangan mengarang data yang tidak terlihat.`;

function userPrompt(categories: string[], ocrText: string, hint: string) {
  return `Kategori yang tersedia (pilih tepat satu, salin persis): ${categories.join(', ')}.
Tanggal hari ini: ${new Date().toISOString().slice(0, 10)}.
${hint ? `Catatan tambahan dari pengguna: ${hint}\n` : ''}${
    ocrText
      ? `Berikut teks hasil OCR dari bukti transaksi. Gambar aslinya juga dilampirkan bila tersedia — gunakan keduanya.\n---\n${ocrText.slice(0, 6000)}\n---`
      : 'Baca gambar bukti transaksi yang dilampirkan.'
  }

Keluarkan JSON dengan bentuk persis:
{"date":"YYYY-MM-DD","time":"HH:MM","merchant":"","amount":0,"currency":"IDR","category":"","payment_method":"","transaction_type":"expense","reference_number":"","items":[],"notes":"","confidence":0.0}`;
}

export async function POST(request: Request): Promise<NextResponse<ParseResponse>> {
  try {
    const form = await request.formData();
    const file = form.get('image');
    const hint = String(form.get('hint') || '');
    const categories = safeCategories(form.get('categories'));

    if (!(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: 'Tidak ada gambar yang dikirim.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Ukuran gambar melebihi 8 MB. Coba foto ulang dengan resolusi lebih kecil.' },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mediaType = normalizeMediaType(file.type);

    // 1) OCR (opsional, tergantung provider yang dikonfigurasi)
    let ocrText = '';
    let ocrError: string | null = null;
    const provider = activeOcrProvider();
    if (provider !== 'llm') {
      try {
        ocrText = (await runOcr(base64, mediaType)).text;
      } catch (e) {
        ocrError = e instanceof Error ? e.message : 'OCR gagal.';
      }
    }

    // 2) AI transaction parser
    if (isAIConfigured()) {
      const raw = await askJSON<Record<string, unknown>>({
        system: SYSTEM,
        prompt: userPrompt(categories, ocrText, hint),
        image: { mediaType, base64 },
        maxTokens: 1600,
      });
      const data = normalizeParsed(raw, categories);
      return NextResponse.json({
        ok: true,
        data,
        raw_text: ocrText || undefined,
        engine: `${provider === 'llm' ? 'vision' : provider}+ai`,
        warning: warningFor(data.confidence, ocrError),
      });
    }

    // 3) Fallback tanpa LLM: hanya bisa jalan kalau OCR menghasilkan teks
    if (ocrText.trim()) {
      const data = normalizeParsed(parseReceiptText(ocrText), categories);
      return NextResponse.json({
        ok: true,
        data,
        raw_text: ocrText,
        engine: `${provider}+heuristik`,
        warning:
          'AI parser belum aktif (ANTHROPIC_API_KEY kosong). Data diambil dengan aturan sederhana — mohon periksa kembali.',
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          ocrError ||
          'Belum ada OCR/AI yang dikonfigurasi. Isi ANTHROPIC_API_KEY (disarankan) atau OCR_SPACE_API_KEY / GOOGLE_VISION_API_KEY di file .env.local, lalu jalankan ulang server.',
      },
      { status: 503 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Gagal memproses gambar.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function warningFor(confidence: number, ocrError: string | null): string | undefined {
  if (confidence < 0.8) return 'Data transaksi kurang jelas. Mohon periksa kembali.';
  if (ocrError) return `OCR eksternal gagal (${ocrError}), data dibaca langsung dari gambar.`;
  return undefined;
}

function safeCategories(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return CATEGORY_NAMES;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.length) return parsed.map(String).slice(0, 60);
  } catch {
    /* abaikan, pakai default */
  }
  return CATEGORY_NAMES;
}

function normalizeMediaType(type: string): string {
  const t = (type || '').toLowerCase();
  if (t === 'image/jpg') return 'image/jpeg';
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(t)) return t;
  return 'image/jpeg';
}
