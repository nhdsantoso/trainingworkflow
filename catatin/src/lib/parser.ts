import type { ParsedTransaction, TransactionItem, TransactionType } from './types';
import { guessCategory } from './defaults';
import { todayISO, nowHM } from './format';

/**
 * Parser heuristik (tanpa LLM).
 *
 * Dipakai untuk dua hal:
 *  1. Fallback kalau ANTHROPIC_API_KEY belum diisi, tetapi teks OCR sudah tersedia.
 *  2. Memparsing input teks/suara bebas seperti "makan siang 75 ribu pakai qris".
 *
 * Hasilnya selalu ditampilkan di halaman konfirmasi, tidak pernah langsung disimpan.
 */

const BULAN_ID: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4,
  mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, aug: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10,
  nov: 11, november: 11, des: 12, desember: 12, dec: 12,
};

const TOTAL_KEYS = [
  'grand total', 'total bayar', 'total belanja', 'total pembayaran', 'total tagihan',
  'jumlah bayar', 'nominal transfer', 'nominal', 'total akhir', 'total', 'jumlah', 'amount', 'bayar',
];

const PAYMENT_PATTERNS: Array<[RegExp, string]> = [
  [/\bqris\b/i, 'QRIS'],
  [/\b(gopay|ovo|dana|shopeepay|linkaja|e-?wallet|e-?money)\b/i, 'E-Wallet'],
  [/\b(kartu kredit|credit card|visa|mastercard|cc)\b/i, 'Kartu Kredit'],
  [/\b(virtual account|va\b|briva|bni va)\b/i, 'Virtual Account'],
  [/\b(transfer|trf|m-?banking|mobile banking|bi-?fast|rtgs|skn)\b/i, 'Transfer Bank'],
  [/\b(debit|kartu debit|edc)\b/i, 'Debit'],
  [/\b(tunai|cash|kembali(an)?)\b/i, 'Cash'],
];

/** Ubah "1.250.000" / "Rp 75,000" / "75.000,50" menjadi angka. */
export function parseMoneyToken(token: string): number | null {
  let s = token.replace(/rp\.?/gi, '').replace(/idr/gi, '').trim();
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    // Pemisah desimal = karakter terakhir.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    if (decimals !== 2) s = s.replace(/\./g, '');
  }

  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/** Menangani "75 ribu", "1,5 juta", "50rb", "25k", "3jt". */
export function parseSpokenAmount(text: string): number | null {
  const m = text
    .toLowerCase()
    .match(/(\d+(?:[.,]\d+)?)\s*(ribu|rb|k|juta|jt|m|miliar|milyar)?/);
  if (!m) return null;
  const base = Number.parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(base)) return null;
  const unit = m[2];
  if (!unit) return null;
  const mult: Record<string, number> = {
    ribu: 1_000, rb: 1_000, k: 1_000,
    juta: 1_000_000, jt: 1_000_000, m: 1_000_000,
    miliar: 1_000_000_000, milyar: 1_000_000_000,
  };
  return Math.round(base * (mult[unit] ?? 1));
}

export function extractDate(text: string): string | null {
  // 2026-04-24
  let m = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  // 24/04/2026 atau 24-04-26
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day <= 31 && month <= 12) return iso(year, month, day);
  }

  // 24 April 2026 / 24 Apr 26
  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,12})\s+(\d{2,4})\b/);
  if (m) {
    const month = BULAN_ID[m[2].toLowerCase()];
    if (month) {
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      return iso(year, month, Number(m[1]));
    }
  }
  return null;
}

export function extractTime(text: string): string | null {
  const m = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?\b/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function extractPaymentMethod(text: string): string {
  for (const [re, label] of PAYMENT_PATTERNS) if (re.test(text)) return label;
  return 'Lainnya';
}

export function extractReference(text: string): string {
  const m =
    text.match(/(?:no\.?\s*ref(?:erensi)?|ref(?:erence)?\s*(?:no|id)?|trx\s*id|id\s*transaksi|no\.?\s*transaksi)\s*[:.#-]?\s*([A-Z0-9-]{6,})/i) ||
    text.match(/\b([A-Z]{2,4}\d{8,})\b/);
  return m ? m[1].trim() : '';
}

/** Ambil nominal total dari teks struk. */
export function extractTotal(text: string): { amount: number; confident: boolean } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const key of TOTAL_KEYS) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const lower = lines[i].toLowerCase();
      if (!lower.includes(key)) continue;
      // Cari angka di baris yang sama, lalu di baris berikutnya.
      const inline = lines[i].match(/[\d][\d.,]{2,}/g);
      if (inline?.length) {
        const value = parseMoneyToken(inline[inline.length - 1]);
        if (value && value >= 100) return { amount: value, confident: true };
      }
      const next = lines[i + 1]?.match(/[\d][\d.,]{2,}/g);
      if (next?.length) {
        const value = parseMoneyToken(next[next.length - 1]);
        if (value && value >= 100) return { amount: value, confident: true };
      }
    }
  }

  // Fallback: angka terbesar yang masuk akal.
  const candidates: number[] = [];
  for (const token of text.match(/[\d][\d.,]{2,}/g) || []) {
    const value = parseMoneyToken(token);
    if (value && value >= 500 && value <= 5_000_000_000) candidates.push(value);
  }
  if (!candidates.length) return { amount: 0, confident: false };
  return { amount: Math.max(...candidates), confident: false };
}

export function extractMerchant(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const skip = /^(struk|receipt|invoice|nota|npwp|jl\.?|jalan|telp|phone|no\.?|tanggal|date|kasir|cashier|www\.|http)/i;
  for (const line of lines.slice(0, 6)) {
    if (skip.test(line)) continue;
    if (/^[\d\W]+$/.test(line)) continue;
    if (line.length < 3 || line.length > 48) continue;
    return titleCase(line);
  }
  return lines[0] ? titleCase(lines[0].slice(0, 40)) : 'Transaksi';
}

/** Item pembelian sederhana: "2 x Ayam Bakar  50.000". */
export function extractItems(text: string): TransactionItem[] {
  const items: TransactionItem[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d{1,2})\s*[xX*]?\s+([A-Za-z][A-Za-z0-9 .,'&/-]{2,40}?)\s+([\d][\d.,]{2,})\s*$/);
    if (!m) continue;
    const price = parseMoneyToken(m[3]);
    if (!price || price < 100) continue;
    items.push({ name: titleCase(m[2].trim()), qty: Number(m[1]), price });
    if (items.length >= 25) break;
  }
  return items;
}

/** Parsing lengkap teks struk hasil OCR tanpa bantuan LLM. */
export function parseReceiptText(text: string): ParsedTransaction {
  const total = extractTotal(text);
  const merchant = extractMerchant(text);
  const date = extractDate(text) || todayISO();
  const time = extractTime(text) || nowHM();
  const method = extractPaymentMethod(text);
  const items = extractItems(text);
  const category = guessCategory(merchant, text.slice(0, 400));

  let confidence = 0.35;
  if (total.confident) confidence += 0.25;
  else if (total.amount > 0) confidence += 0.1;
  if (extractDate(text)) confidence += 0.1;
  if (method !== 'Lainnya') confidence += 0.08;
  if (category !== 'Lainnya') confidence += 0.07;
  if (items.length > 0) confidence += 0.05;
  if (text.length > 120) confidence += 0.05;

  return {
    date,
    time,
    merchant,
    amount: total.amount,
    currency: 'IDR',
    category,
    payment_method: method,
    transaction_type: 'expense',
    reference_number: extractReference(text),
    items,
    confidence: Math.min(0.79, Number(confidence.toFixed(2))), // heuristik tidak pernah "sangat yakin"
  };
}

const INCOME_HINTS = /\b(gaji|salary|thr|bonus|terima|diterima|masuk|pemasukan|pendapatan|dibayar|refund|cashback|untung|omzet|dapat)\b/i;
const TRANSFER_HINTS = /\b(pindah(kan)?|transfer ke|top ?up|tarik tunai|setor)\b/i;

/** Parsing input teks/suara bebas: "makan siang 75 ribu pakai qris di padang". */
export function parseFreeText(input: string): ParsedTransaction {
  const text = input.trim();
  const lower = text.toLowerCase();

  const amount =
    parseSpokenAmount(lower) ??
    (() => {
      const tokens = lower.match(/[\d][\d.,]*/g) || [];
      const values = tokens.map(parseMoneyToken).filter((n): n is number => !!n && n >= 100);
      return values.length ? Math.max(...values) : 0;
    })();

  let type: TransactionType = 'expense';
  if (TRANSFER_HINTS.test(lower)) type = 'transfer';
  else if (INCOME_HINTS.test(lower)) type = 'income';

  // Frasa pembuka (sebelum angka pertama) — biasanya nama layanan: "grab ke kantor".
  const leading = trimMerchantPhrase(text, true).split(/\s+/).slice(0, 4).join(' ');

  // "di / dari / pada X" hampir selalu menunjuk merchant; "ke X" biasanya tujuan,
  // sehingga untuk "ke" frasa pembuka lebih dipercaya.
  const atMatch = text.match(/\b(?:di|dari|pada)\s+([A-Za-z][\w .'&-]{2,40})/i);
  const toMatch = text.match(/\bke\s+([A-Za-z][\w .'&-]{2,40})/i);

  let merchant = '';
  if (atMatch) merchant = trimMerchantPhrase(atMatch[1]);
  if (!merchant && leading) merchant = leading;
  if (!merchant && toMatch) merchant = trimMerchantPhrase(toMatch[1]);
  merchant = titleCase(merchant || 'Transaksi');

  const method = extractPaymentMethod(text);

  // Untuk pemasukan, kata kunci merchant seperti "telkomsel" tidak boleh menarik
  // transaksi ke kategori pengeluaran (Tagihan). Pakai kategori pemasukan.
  const category =
    type === 'income'
      ? /\b(omzet|penjualan|invoice|klien|client|freelance|proyek|fee|bisnis)\b/i.test(lower)
        ? 'Bisnis'
        : /\b(gaji|salary|payroll|thr|bonus|tunjangan|lembur)\b/i.test(lower)
          ? 'Gaji'
          : 'Lainnya'
      : type === 'transfer'
        ? 'Investasi'
        : guessCategory(merchant, text);

  let confidence = 0.4;
  if (amount > 0) confidence += 0.25;
  if (atMatch || toMatch) confidence += 0.1;
  if (category !== 'Lainnya') confidence += 0.1;
  if (method !== 'Lainnya') confidence += 0.05;

  return {
    date: extractDate(text) || todayISO(),
    time: extractTime(text) || nowHM(),
    merchant,
    amount,
    currency: 'IDR',
    category,
    payment_method: method,
    transaction_type: type,
    reference_number: '',
    items: [],
    notes: text,
    confidence: Math.min(0.78, Number(confidence.toFixed(2))),
  };
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Singkatan umum pada nama usaha Indonesia yang tetap ditulis kapital. */
const ABBREVIATIONS = new Set(['rm', 'pt', 'cv', 'ud', 'tk', 'sd', 'smp', 'sma', 'ac', 'tv', 'id', 'kg', 'ml', 'atm', 'spbu', 'rs']);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (ABBREVIATIONS.has(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();
}

/**
 * Memotong frasa merchant di angka dan kata sambung.
 * `stopAtPreposition` dipakai untuk frasa pembuka ("grab ke kantor" -> "grab");
 * untuk frasa yang sudah diambil setelah preposisi, opsi ini dimatikan.
 */
function trimMerchantPhrase(raw: string, stopAtPreposition = false): string {
  let out = raw.split(/\d/)[0];
  out = out.split(/\b(?:pakai|pake|dengan|via|untuk|buat|lewat|memakai|seharga|sebesar|senilai)\b/i)[0];
  if (stopAtPreposition) out = out.split(/\b(?:di|ke|dari|pada)\b/i)[0];
  return out.replace(/[\s.,-]+$/, '').trim();
}
