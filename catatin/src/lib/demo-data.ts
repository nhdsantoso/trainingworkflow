import type { AppData, Transaction, Wallet, Category, Budget, Goal, Debt, Recurring } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_WALLETS, DEMO_USER_ID } from './defaults';
import { toISO, currentPeriod, shiftPeriod } from './format';
import { nowISO, uid } from './utils';

function d(offsetDays: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - offsetDays);
  return toISO(dt);
}

/**
 * Tanggal pada bulan berjalan.
 *
 * Hari yang diminta (1-28) dipetakan secara proporsional ke rentang hari yang
 * sudah berjalan, supaya data demo selalu tersebar rapi kapan pun aplikasi
 * dibuka — termasuk di tanggal-tanggal awal bulan.
 */
function thisMonth(day: number): string {
  const now = new Date();
  const elapsed = now.getDate();
  const mapped = elapsed <= 1 ? 1 : 1 + Math.round(((Math.min(day, 28) - 1) / 27) * (elapsed - 1));
  return toISO(new Date(now.getFullYear(), now.getMonth(), Math.max(1, Math.min(mapped, elapsed))));
}

/** Tanggal tertentu pada bulan lalu. */
function lastMonth(day: number): string {
  const now = new Date();
  const dt = new Date(now.getFullYear(), now.getMonth() - 1, day);
  return toISO(dt);
}

export function buildDefaultCategories(userId = DEMO_USER_ID): Category[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: `cat-${i}`,
    user_id: userId,
    name: c.name,
    emoji: c.emoji,
    type: c.type,
    color: c.color,
    is_default: true,
    created_at: nowISO(),
  }));
}

export function buildDefaultWallets(userId = DEMO_USER_ID): Wallet[] {
  return DEFAULT_WALLETS.map((w) => ({
    id: w.id,
    user_id: userId,
    name: w.name,
    kind: w.kind,
    emoji: w.emoji,
    initial_balance: 0,
    archived: false,
    created_at: nowISO(),
  }));
}

type TxSeed = [
  type: Transaction['type'],
  date: string,
  time: string,
  merchant: string,
  category: string,
  amount: number,
  wallet: string,
  method: string,
  notes: string,
];

const SEED_TX: TxSeed[] = [
  // ---- Bulan berjalan: pemasukan
  ['income', thisMonth(1), '09:00', 'PT Telkomsel Indonesia', 'Gaji', 30_000_000, 'bca', 'Transfer Bank', 'Gaji bulanan'],
  ['income', thisMonth(12), '14:20', 'Proyek Freelance Branding', 'Bisnis', 4_500_000, 'bca', 'Transfer Bank', 'Termin 1'],

  // ---- Bulan berjalan: pengeluaran (makanan)
  ['expense', thisMonth(2), '12:30', 'RM Padang Sederhana', 'Makanan & Minuman', 75_000, 'gopay', 'QRIS', 'Makan siang'],
  ['expense', thisMonth(3), '08:15', 'Kopi Kenangan', 'Makanan & Minuman', 22_000, 'gopay', 'QRIS', 'Kopi pagi'],
  ['expense', thisMonth(4), '19:40', 'GoFood - Ayam Geprek', 'Makanan & Minuman', 55_000, 'gopay', 'E-Wallet', 'Makan malam'],
  ['expense', thisMonth(6), '13:05', 'Warung Tegal Bahari', 'Makanan & Minuman', 35_000, 'cash', 'Cash', ''],
  ['expense', thisMonth(8), '20:10', 'Pizza Hut Kuningan', 'Makanan & Minuman', 245_000, 'credit-card', 'Kartu Kredit', 'Makan bareng keluarga'],
  ['expense', thisMonth(9), '12:00', 'Hokben Sudirman', 'Makanan & Minuman', 120_000, 'ovo', 'QRIS', 'Lunch meeting'],
  ['expense', thisMonth(11), '07:50', 'Starbucks Plaza Semanggi', 'Makanan & Minuman', 68_000, 'credit-card', 'Kartu Kredit', ''],
  ['expense', thisMonth(14), '12:45', 'RM Padang Sederhana', 'Makanan & Minuman', 82_000, 'gopay', 'QRIS', 'Makan siang'],
  ['expense', thisMonth(16), '18:30', 'Sate Khas Senayan', 'Makanan & Minuman', 186_000, 'bca', 'Debit', 'Dinner'],
  ['expense', thisMonth(18), '11:20', 'Janji Jiwa', 'Makanan & Minuman', 26_000, 'dana', 'QRIS', ''],
  ['expense', thisMonth(21), '13:15', 'Bakso Solo Samrat', 'Makanan & Minuman', 48_000, 'cash', 'Cash', ''],

  // ---- Transportasi
  ['expense', thisMonth(2), '07:30', 'Grab', 'Transportasi', 32_000, 'gopay', 'E-Wallet', 'Ke kantor'],
  ['expense', thisMonth(5), '18:00', 'Gojek', 'Transportasi', 28_500, 'gopay', 'E-Wallet', 'Pulang kantor'],
  ['expense', thisMonth(7), '09:10', 'SPBU Pertamina 31.129', 'Transportasi', 300_000, 'credit-card', 'Kartu Kredit', 'Isi bensin'],
  ['expense', thisMonth(10), '08:05', 'MRT Jakarta', 'Transportasi', 14_000, 'dana', 'E-Wallet', ''],
  ['expense', thisMonth(13), '17:45', 'Grab', 'Transportasi', 45_000, 'ovo', 'E-Wallet', ''],
  ['expense', thisMonth(19), '08:20', 'e-Toll Mandiri', 'Transportasi', 150_000, 'mandiri', 'Debit', 'Top up e-toll'],

  // ---- Belanja
  ['expense', thisMonth(3), '16:40', 'Superindo Kemang', 'Belanja', 425_000, 'bca', 'Debit', 'Belanja mingguan'],
  ['expense', thisMonth(9), '21:00', 'Tokopedia', 'Belanja', 389_000, 'credit-card', 'Virtual Account', 'Peralatan rumah'],
  ['expense', thisMonth(15), '19:25', 'Indomaret Cipete', 'Belanja', 87_500, 'shopeepay', 'QRIS', ''],
  ['expense', thisMonth(17), '20:15', 'Uniqlo Grand Indonesia', 'Belanja', 349_000, 'credit-card', 'Kartu Kredit', 'Kemeja kerja'],

  // ---- Tagihan
  ['expense', thisMonth(5), '10:00', 'PLN Prabayar', 'Tagihan', 500_000, 'bca', 'Virtual Account', 'Token listrik'],
  ['expense', thisMonth(5), '10:05', 'IndiHome', 'Tagihan', 465_000, 'bca', 'Virtual Account', 'Internet rumah'],
  ['expense', thisMonth(15), '09:00', 'Netflix', 'Tagihan', 186_000, 'credit-card', 'Kartu Kredit', 'Langganan bulanan'],
  ['expense', thisMonth(15), '09:02', 'Spotify Premium', 'Tagihan', 54_990, 'credit-card', 'Kartu Kredit', 'Langganan bulanan'],
  ['expense', thisMonth(6), '11:00', 'Telkomsel Halo', 'Tagihan', 350_000, 'bca', 'Virtual Account', 'Tagihan pascabayar'],
  ['expense', thisMonth(7), '10:30', 'BPJS Kesehatan', 'Tagihan', 450_000, 'bca', 'Virtual Account', ''],

  // ---- Rumah
  ['expense', thisMonth(2), '08:00', 'Sewa Apartemen Kalibata', 'Rumah', 4_500_000, 'bca', 'Transfer Bank', 'Sewa bulanan'],
  ['expense', thisMonth(8), '15:20', 'Ace Hardware', 'Rumah', 275_000, 'credit-card', 'Kartu Kredit', 'Perlengkapan rumah'],
  ['expense', thisMonth(12), '09:30', 'Gas Elpiji 12kg', 'Rumah', 215_000, 'cash', 'Cash', ''],

  // ---- Kesehatan, pendidikan, hiburan, keagamaan
  ['expense', thisMonth(11), '16:00', 'Apotek Kimia Farma', 'Kesehatan', 185_000, 'dana', 'QRIS', 'Obat & vitamin'],
  ['expense', thisMonth(20), '10:00', 'Klinik Gigi Senyum', 'Kesehatan', 750_000, 'bca', 'Debit', 'Scaling gigi'],
  ['expense', thisMonth(14), '20:00', 'Gramedia Matraman', 'Pendidikan', 195_000, 'shopeepay', 'QRIS', 'Buku strategi merek'],
  ['expense', thisMonth(16), '21:30', 'CGV Grand Indonesia', 'Hiburan', 130_000, 'ovo', 'E-Wallet', 'Nonton berdua'],
  ['expense', thisMonth(19), '19:00', 'Fitness First', 'Hiburan', 600_000, 'credit-card', 'Kartu Kredit', 'Membership gym'],
  ['expense', thisMonth(10), '17:00', 'Kitabisa - Donasi', 'Keagamaan & Sosial', 500_000, 'bca', 'Transfer Bank', 'Sedekah bulanan'],
  ['expense', thisMonth(4), '09:00', 'Uang Bulanan Orang Tua', 'Keluarga', 2_000_000, 'bca', 'Transfer Bank', 'Kirim ke orang tua'],

  // ---- Investasi (transfer ke wallet investasi)
  ['transfer', thisMonth(2), '09:30', 'Bibit - Reksadana', 'Investasi', 3_000_000, 'bca', 'Transfer Bank', 'Autodebet investasi'],

  // ---- Bulan lalu (untuk perbandingan tren)
  ['income', lastMonth(1), '09:00', 'PT Telkomsel Indonesia', 'Gaji', 30_000_000, 'bca', 'Transfer Bank', 'Gaji bulanan'],
  ['expense', lastMonth(2), '08:00', 'Sewa Apartemen Kalibata', 'Rumah', 4_500_000, 'bca', 'Transfer Bank', 'Sewa bulanan'],
  ['expense', lastMonth(3), '12:00', 'RM Padang Sederhana', 'Makanan & Minuman', 68_000, 'gopay', 'QRIS', ''],
  ['expense', lastMonth(6), '13:00', 'Warung Tegal Bahari', 'Makanan & Minuman', 32_000, 'cash', 'Cash', ''],
  ['expense', lastMonth(9), '19:00', 'Sate Khas Senayan', 'Makanan & Minuman', 165_000, 'bca', 'Debit', ''],
  ['expense', lastMonth(12), '12:30', 'Hokben Sudirman', 'Makanan & Minuman', 95_000, 'ovo', 'QRIS', ''],
  ['expense', lastMonth(15), '20:00', 'GoFood - Nasi Goreng', 'Makanan & Minuman', 62_000, 'gopay', 'E-Wallet', ''],
  ['expense', lastMonth(18), '11:00', 'Kopi Kenangan', 'Makanan & Minuman', 24_000, 'gopay', 'QRIS', ''],
  ['expense', lastMonth(22), '13:00', 'Bakso Solo Samrat', 'Makanan & Minuman', 45_000, 'cash', 'Cash', ''],
  ['expense', lastMonth(25), '18:30', 'Pizza Hut Kuningan', 'Makanan & Minuman', 210_000, 'credit-card', 'Kartu Kredit', ''],
  ['expense', lastMonth(5), '07:30', 'Grab', 'Transportasi', 36_000, 'gopay', 'E-Wallet', ''],
  ['expense', lastMonth(8), '09:00', 'SPBU Pertamina 31.129', 'Transportasi', 300_000, 'credit-card', 'Kartu Kredit', ''],
  ['expense', lastMonth(14), '17:00', 'Gojek', 'Transportasi', 27_000, 'gopay', 'E-Wallet', ''],
  ['expense', lastMonth(20), '08:00', 'e-Toll Mandiri', 'Transportasi', 200_000, 'mandiri', 'Debit', ''],
  ['expense', lastMonth(4), '16:00', 'Superindo Kemang', 'Belanja', 512_000, 'bca', 'Debit', ''],
  ['expense', lastMonth(17), '20:00', 'Shopee', 'Belanja', 275_000, 'shopeepay', 'E-Wallet', ''],
  ['expense', lastMonth(5), '10:00', 'PLN Prabayar', 'Tagihan', 450_000, 'bca', 'Virtual Account', ''],
  ['expense', lastMonth(5), '10:05', 'IndiHome', 'Tagihan', 465_000, 'bca', 'Virtual Account', ''],
  ['expense', lastMonth(15), '09:00', 'Netflix', 'Tagihan', 186_000, 'credit-card', 'Kartu Kredit', ''],
  ['expense', lastMonth(6), '11:00', 'Telkomsel Halo', 'Tagihan', 350_000, 'bca', 'Virtual Account', ''],
  ['expense', lastMonth(10), '17:00', 'Kitabisa - Donasi', 'Keagamaan & Sosial', 500_000, 'bca', 'Transfer Bank', ''],
  ['expense', lastMonth(4), '09:00', 'Uang Bulanan Orang Tua', 'Keluarga', 2_000_000, 'bca', 'Transfer Bank', ''],
  ['expense', lastMonth(21), '20:00', 'CGV Grand Indonesia', 'Hiburan', 100_000, 'ovo', 'E-Wallet', ''],
  ['transfer', lastMonth(2), '09:30', 'Bibit - Reksadana', 'Investasi', 3_000_000, 'bca', 'Transfer Bank', 'Autodebet investasi'],
];

/**
 * Riwayat ringkas 4 bulan sebelumnya supaya grafik tren 6 bulan tidak setengah kosong.
 * Nominalnya sengaja bervariasi agar tren terlihat wajar, bukan garis datar.
 */
function historySeeds(): TxSeed[] {
  const now = new Date();
  const out: TxSeed[] = [];
  const variance = [0.94, 1.08, 0.97, 1.03];

  for (let back = 5; back >= 2; back--) {
    const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const v = variance[(back - 2) % variance.length];
    const on = (day: number) => toISO(new Date(base.getFullYear(), base.getMonth(), day));
    const amt = (n: number) => Math.round((n * v) / 1000) * 1000;

    out.push(
      ['income', on(1), '09:00', 'PT Telkomsel Indonesia', 'Gaji', 30_000_000, 'bca', 'Transfer Bank', 'Gaji bulanan'],
      ['expense', on(2), '08:00', 'Sewa Apartemen Kalibata', 'Rumah', 4_500_000, 'bca', 'Transfer Bank', 'Sewa bulanan'],
      ['expense', on(4), '10:00', 'PLN Prabayar', 'Tagihan', amt(480_000), 'bca', 'Virtual Account', 'Token listrik'],
      ['expense', on(5), '10:05', 'IndiHome', 'Tagihan', 465_000, 'bca', 'Virtual Account', 'Internet rumah'],
      ['expense', on(6), '11:00', 'Telkomsel Halo', 'Tagihan', 350_000, 'bca', 'Virtual Account', 'Pascabayar'],
      ['expense', on(3), '09:00', 'Uang Bulanan Orang Tua', 'Keluarga', 2_000_000, 'bca', 'Transfer Bank', ''],
      ['expense', on(8), '16:00', 'Superindo Kemang', 'Belanja', amt(1_150_000), 'bca', 'Debit', 'Belanja bulanan'],
      ['expense', on(12), '12:30', 'Aneka Warung & Resto', 'Makanan & Minuman', amt(2_450_000), 'gopay', 'QRIS', 'Akumulasi makan bulan ini'],
      ['expense', on(14), '09:00', 'Transportasi Harian', 'Transportasi', amt(1_320_000), 'gopay', 'E-Wallet', 'Grab, bensin, tol'],
      ['expense', on(18), '20:00', 'Hiburan & Langganan', 'Hiburan', amt(640_000), 'credit-card', 'Kartu Kredit', ''],
      ['expense', on(10), '17:00', 'Kitabisa - Donasi', 'Keagamaan & Sosial', 500_000, 'bca', 'Transfer Bank', ''],
      ['transfer', on(2), '09:30', 'Bibit - Reksadana', 'Investasi', 3_000_000, 'bca', 'Transfer Bank', 'Autodebet investasi'],
    );
  }
  return out;
}

export function buildDemoTransactions(userId = DEMO_USER_ID): Transaction[] {
  return [...historySeeds(), ...SEED_TX].map(([type, date, time, merchant, category, amount, wallet, method, notes], i) => ({
    id: `demo-tx-${i}`,
    user_id: userId,
    type,
    date,
    time,
    merchant,
    category,
    subcategory: null,
    amount,
    payment_method: method,
    wallet,
    to_wallet: type === 'transfer' ? 'investasi' : null,
    notes: notes || null,
    receipt_image: null,
    reference_number: null,
    items: [],
    created_at: nowISO(),
    updated_at: nowISO(),
  })).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function buildDemoBudgets(userId = DEMO_USER_ID): Budget[] {
  const period = currentPeriod();
  const seeds: Array<[string, number]> = [
    ['Makanan & Minuman', 3_000_000],
    ['Transportasi', 2_000_000],
    ['Hiburan', 1_000_000],
    ['Belanja', 2_500_000],
    ['Tagihan', 2_500_000],
  ];
  return seeds.map(([category, amount], i) => ({
    id: `budget-${i}`,
    user_id: userId,
    category,
    amount,
    period,
    created_at: nowISO(),
  }));
}

function buildDemoGoals(userId = DEMO_USER_ID): Goal[] {
  return [
    {
      id: 'goal-0',
      user_id: userId,
      name: 'Liburan Jepang',
      emoji: '🗾',
      target_amount: 30_000_000,
      current_amount: 12_500_000,
      target_date: `${new Date().getFullYear()}-12-31`,
      notes: 'Tokyo - Osaka, 10 hari',
      created_at: nowISO(),
    },
    {
      id: 'goal-1',
      user_id: userId,
      name: 'Dana Darurat',
      emoji: '🛟',
      target_amount: 90_000_000,
      current_amount: 42_000_000,
      target_date: `${new Date().getFullYear() + 1}-06-30`,
      notes: '6x pengeluaran bulanan',
      created_at: nowISO(),
    },
  ];
}

function buildDemoDebts(userId = DEMO_USER_ID): Debt[] {
  return [
    {
      id: 'debt-0',
      user_id: userId,
      kind: 'receivable',
      person: 'Rizky (tim media)',
      amount: 1_500_000,
      paid_amount: 0,
      date: d(20),
      due_date: d(-10),
      status: 'open',
      notes: 'Talangin tiket event',
      created_at: nowISO(),
    },
    {
      id: 'debt-1',
      user_id: userId,
      kind: 'debt',
      person: 'Cicilan Laptop - Home Credit',
      amount: 2_500_000,
      paid_amount: 0,
      date: d(40),
      due_date: d(-3),
      status: 'open',
      notes: 'Cicilan ke-4 dari 12',
      created_at: nowISO(),
    },
  ];
}

function buildDemoRecurring(userId = DEMO_USER_ID): Recurring[] {
  // Transaksi untuk bulan berjalan sudah ada di data demo, jadi last_run diisi
  // agar aturan rutin tidak membuat duplikat saat aplikasi pertama dibuka.
  const now = new Date();
  const ranThisMonth = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const base = {
    user_id: userId,
    frequency: 'monthly' as const,
    day_of_week: 1,
    month_of_year: 1,
    active: true,
    last_run: ranThisMonth,
    created_at: nowISO(),
  };
  return [
    { ...base, id: 'rec-0', name: 'Gaji Telkomsel', type: 'income' as const, amount: 30_000_000, category: 'Gaji', wallet: 'bca', day_of_month: 1, payment_method: 'Transfer Bank', auto_create: true, notes: 'Gaji bulanan' },
    { ...base, id: 'rec-1', name: 'Netflix', type: 'expense' as const, amount: 186_000, category: 'Tagihan', wallet: 'credit-card', day_of_month: 15, payment_method: 'Kartu Kredit', auto_create: false, notes: 'Langganan streaming' },
    { ...base, id: 'rec-2', name: 'IndiHome', type: 'expense' as const, amount: 465_000, category: 'Tagihan', wallet: 'bca', day_of_month: 5, payment_method: 'Virtual Account', auto_create: false, notes: 'Internet rumah' },
    { ...base, id: 'rec-3', name: 'Sewa Apartemen', type: 'expense' as const, amount: 4_500_000, category: 'Rumah', wallet: 'bca', day_of_month: 2, payment_method: 'Transfer Bank', auto_create: false, notes: 'Sewa bulanan' },
    { ...base, id: 'rec-4', name: 'Autodebet Investasi', type: 'expense' as const, amount: 3_000_000, category: 'Investasi', wallet: 'bca', day_of_month: 2, payment_method: 'Transfer Bank', auto_create: false, notes: 'Reksadana Bibit' },
  ];
}

/** Saldo awal wallet supaya total saldo demo terlihat wajar. */
const DEMO_OPENING_BALANCE: Record<string, number> = {
  cash: 1_500_000,
  bca: 45_000_000,
  mandiri: 8_000_000,
  bri: 3_000_000,
  bni: 0,
  'credit-card': 0,
  gopay: 750_000,
  ovo: 400_000,
  dana: 350_000,
  shopeepay: 250_000,
  investasi: 55_000_000,
};

export function buildDemoData(userId = DEMO_USER_ID): AppData {
  const wallets = buildDefaultWallets(userId).map((w) => ({
    ...w,
    initial_balance: DEMO_OPENING_BALANCE[w.id] ?? 0,
  }));
  return {
    transactions: buildDemoTransactions(userId),
    categories: buildDefaultCategories(userId),
    wallets,
    budgets: buildDemoBudgets(userId),
    goals: buildDemoGoals(userId),
    debts: buildDemoDebts(userId),
    recurring: buildDemoRecurring(userId),
  };
}

/** Data kosong (dipakai untuk akun Supabase baru sebelum user pilih seed demo). */
export function buildEmptyData(userId: string): AppData {
  return {
    transactions: [],
    categories: buildDefaultCategories(userId),
    wallets: buildDefaultWallets(userId),
    budgets: [],
    goals: [],
    debts: [],
    recurring: [],
  };
}

export const DEMO_PERIODS = [shiftPeriod(currentPeriod(), -1), currentPeriod()];
export { uid };
