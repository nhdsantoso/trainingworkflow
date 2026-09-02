import 'server-only';
import type { ParsedTransaction, TransactionItem, TransactionType } from '@/lib/types';
import { guessCategory } from '@/lib/defaults';
import { todayISO, nowHM } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/defaults';

/** Membersihkan & memvalidasi JSON mentah dari LLM menjadi ParsedTransaction yang aman dipakai UI. */
export function normalizeParsed(raw: unknown, allowedCategories: string[]): ParsedTransaction {
  const r = (raw ?? {}) as Record<string, unknown>;

  const amount = toNumber(r.amount);
  const merchant = clean(String(r.merchant ?? '')) || 'Transaksi';
  const date = normalizeDate(String(r.date ?? ''));
  const time = normalizeTime(String(r.time ?? ''));

  const type = normalizeType(String(r.transaction_type ?? 'expense'));
  const category = matchCategory(String(r.category ?? ''), merchant, allowedCategories);
  const payment = matchPayment(String(r.payment_method ?? ''));

  const items: TransactionItem[] = Array.isArray(r.items)
    ? (r.items as unknown[])
        .map((it) => {
          const o = (it ?? {}) as Record<string, unknown>;
          const name = clean(String(o.name ?? ''));
          if (!name) return null;
          return {
            name,
            qty: toNumber(o.qty) || 1,
            price: toNumber(o.price) || 0,
          } as TransactionItem;
        })
        .filter((x): x is TransactionItem => x !== null)
        .slice(0, 40)
    : [];

  let confidence = toNumber(r.confidence, true);
  if (!Number.isFinite(confidence) || confidence <= 0) confidence = 0.5;
  if (confidence > 1) confidence = confidence / 100;
  // Nominal nol berarti data tidak terbaca — turunkan confidence apa pun klaim model.
  if (amount <= 0) confidence = Math.min(confidence, 0.35);

  return {
    date,
    time,
    merchant,
    amount,
    currency: 'IDR',
    category,
    payment_method: payment,
    transaction_type: type,
    reference_number: clean(String(r.reference_number ?? '')),
    items,
    notes: clean(String(r.notes ?? '')),
    confidence: Number(Math.max(0, Math.min(1, confidence)).toFixed(2)),
  };
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function toNumber(v: unknown, allowFraction = false): number {
  if (typeof v === 'number') return allowFraction ? v : Math.round(v);
  const n = Number.parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return allowFraction ? n : Math.round(n);
}

function normalizeDate(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    if (y >= 2000 && y <= 2100) return s;
  }
  return todayISO();
}

function normalizeTime(s: string): string {
  const m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : nowHM();
}

function normalizeType(s: string): TransactionType {
  const v = s.toLowerCase();
  if (v.startsWith('income') || v.includes('masuk') || v.includes('pemasukan')) return 'income';
  if (v.startsWith('transfer') || v.includes('pindah')) return 'transfer';
  return 'expense';
}

/** Kategori dari model harus dipetakan ke kategori milik user. */
function matchCategory(value: string, merchant: string, allowed: string[]): string {
  const list = allowed.length ? allowed : [];
  const v = value.trim().toLowerCase();

  const exact = list.find((c) => c.toLowerCase() === v);
  if (exact) return exact;

  const partial = list.find((c) => v && (c.toLowerCase().includes(v) || v.includes(c.toLowerCase())));
  if (partial) return partial;

  // Padanan istilah Inggris -> kategori default CATATIN.
  const EN_MAP: Record<string, string> = {
    food: 'Makanan & Minuman',
    'food & beverage': 'Makanan & Minuman',
    beverage: 'Makanan & Minuman',
    groceries: 'Belanja',
    transport: 'Transportasi',
    transportation: 'Transportasi',
    shopping: 'Belanja',
    bills: 'Tagihan',
    utilities: 'Tagihan',
    housing: 'Rumah',
    health: 'Kesehatan',
    education: 'Pendidikan',
    entertainment: 'Hiburan',
    travel: 'Travel',
    family: 'Keluarga',
    religious: 'Keagamaan & Sosial',
    investment: 'Investasi',
    salary: 'Gaji',
    business: 'Bisnis',
    other: 'Lainnya',
  };
  const mapped = EN_MAP[v];
  if (mapped && (!list.length || list.includes(mapped))) return mapped;

  const guessed = guessCategory(merchant);
  if (!list.length || list.includes(guessed)) return guessed;
  return list[list.length - 1] || 'Lainnya';
}

function matchPayment(value: string): string {
  const v = value.trim().toLowerCase();
  const found = PAYMENT_METHODS.find((p) => p.toLowerCase() === v);
  if (found) return found;
  if (/qris/.test(v)) return 'QRIS';
  if (/(gopay|ovo|dana|shopeepay|wallet|e-?money)/.test(v)) return 'E-Wallet';
  if (/(credit|kredit)/.test(v)) return 'Kartu Kredit';
  if (/(virtual|va)/.test(v)) return 'Virtual Account';
  if (/(transfer|trf|banking)/.test(v)) return 'Transfer Bank';
  if (/debit/.test(v)) return 'Debit';
  if (/(cash|tunai)/.test(v)) return 'Cash';
  return 'Lainnya';
}
