import type { Category, Wallet } from './types';

export const DEMO_USER_ID = 'demo-user';

interface CategorySeed {
  name: string;
  emoji: string;
  type: Category['type'];
  color: string;
  /** kata kunci merchant untuk fallback kategorisasi tanpa AI */
  keywords: string[];
}

/** Kategori default CATATIN (Bahasa Indonesia, sesuai spesifikasi). */
export const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: 'Makanan & Minuman',
    emoji: '🍜',
    type: 'expense',
    color: '#F97316',
    keywords: ['resto', 'restoran', 'rumah makan', 'rm ', 'warung', 'kedai', 'cafe', 'kopi', 'coffee',
      'starbucks', 'kfc', 'mcd', 'mcdonald', 'burger', 'pizza', 'bakso', 'padang', 'nasi', 'ayam',
      'sate', 'mie', 'bakery', 'roti', 'catering', 'gofood', 'grabfood', 'shopeefood', 'janji jiwa',
      'kopi kenangan', 'chatime', 'dunkin', 'hokben', 'solaria', 'seafood', 'martabak', 'es teh'],
  },
  {
    name: 'Transportasi',
    emoji: '🚗',
    type: 'expense',
    color: '#0EA5E9',
    keywords: ['grab', 'gojek', 'gocar', 'goride', 'maxim', 'bluebird', 'taksi', 'taxi', 'ojek',
      'pertamina', 'shell', 'spbu', 'bensin', 'bbm', 'parkir', 'tol', 'e-toll', 'etoll', 'mrt',
      'krl', 'transjakarta', 'kereta', 'damri', 'busway', 'bengkel', 'servis motor', 'oli'],
  },
  {
    name: 'Belanja',
    emoji: '🛍',
    type: 'expense',
    color: '#EC4899',
    keywords: ['indomaret', 'alfamart', 'alfamidi', 'superindo', 'hypermart', 'transmart', 'giant',
      'carrefour', 'lotte', 'ranch market', 'supermarket', 'minimarket', 'tokopedia', 'shopee',
      'lazada', 'blibli', 'bukalapak', 'zalora', 'uniqlo', 'h&m', 'zara', 'matahari', 'ace hardware',
      'informa', 'ikea', 'watsons', 'guardian', 'sociolla'],
  },
  {
    name: 'Tagihan',
    emoji: '💳',
    type: 'expense',
    color: '#8B5CF6',
    keywords: ['pln', 'listrik', 'token listrik', 'pdam', 'air', 'indihome', 'telkom', 'first media',
      'biznet', 'myrepublic', 'internet', 'wifi', 'pulsa', 'paket data', 'telkomsel', 'xl', 'indosat',
      'tri', 'smartfren', 'bpjs', 'asuransi', 'iuran', 'netflix', 'spotify', 'disney', 'youtube premium',
      'vidio', 'iflix', 'subscription', 'langganan'],
  },
  {
    name: 'Rumah',
    emoji: '🏠',
    type: 'expense',
    color: '#14B8A6',
    keywords: ['sewa', 'kontrakan', 'kost', 'kos', 'cicilan rumah', 'kpr', 'ipl', 'perabot',
      'renovasi', 'tukang', 'service ac', 'gas elpiji', 'lpg', 'galon'],
  },
  {
    name: 'Kesehatan',
    emoji: '💊',
    type: 'expense',
    color: '#EF4444',
    keywords: ['apotek', 'apotik', 'kimia farma', 'century', 'k24', 'guardian', 'rumah sakit', 'rs ',
      'klinik', 'dokter', 'lab', 'prodia', 'vaksin', 'obat', 'dental', 'gigi', 'halodoc', 'alodokter'],
  },
  {
    name: 'Pendidikan',
    emoji: '📚',
    type: 'expense',
    color: '#3B82F6',
    keywords: ['spp', 'sekolah', 'kampus', 'universitas', 'kuliah', 'les', 'bimbel', 'kursus',
      'gramedia', 'buku', 'udemy', 'coursera', 'ruangguru', 'zenius', 'skill academy'],
  },
  {
    name: 'Hiburan',
    emoji: '🎮',
    type: 'expense',
    color: '#A855F7',
    keywords: ['bioskop', 'cgv', 'xxi', 'cinepolis', 'game', 'steam', 'playstation', 'nintendo',
      'mobile legend', 'konser', 'tiket', 'karaoke', 'gym', 'fitness', 'spa', 'salon', 'wisata'],
  },
  {
    name: 'Travel',
    emoji: '✈️',
    type: 'expense',
    color: '#06B6D4',
    keywords: ['traveloka', 'tiket.com', 'pegipegi', 'airbnb', 'agoda', 'booking.com', 'hotel',
      'garuda', 'lion air', 'citilink', 'airasia', 'batik air', 'pesawat', 'penginapan', 'villa'],
  },
  {
    name: 'Keluarga',
    emoji: '👨‍👩‍👧',
    type: 'expense',
    color: '#F59E0B',
    keywords: ['orang tua', 'ortu', 'anak', 'popok', 'susu', 'mainan', 'baby', 'daycare', 'art',
      'asisten rumah tangga', 'uang saku'],
  },
  {
    name: 'Keagamaan & Sosial',
    emoji: '🕌',
    type: 'expense',
    color: '#10B981',
    keywords: ['zakat', 'infak', 'infaq', 'sedekah', 'donasi', 'kurban', 'qurban', 'perpuluhan',
      'kolekte', 'masjid', 'gereja', 'yayasan', 'kitabisa'],
  },
  {
    name: 'Investasi',
    emoji: '📈',
    type: 'both',
    color: '#22C55E',
    keywords: ['bibit', 'ajaib', 'stockbit', 'reksadana', 'saham', 'obligasi', 'sbn', 'emas',
      'antam', 'pluang', 'crypto', 'indodax', 'deposito'],
  },
  {
    name: 'Gaji',
    emoji: '💼',
    type: 'income',
    color: '#16A34A',
    keywords: ['gaji', 'salary', 'payroll', 'thr', 'bonus', 'tunjangan', 'lembur'],
  },
  {
    name: 'Bisnis',
    emoji: '🏪',
    type: 'income',
    color: '#0D9488',
    keywords: ['omzet', 'penjualan', 'invoice', 'client', 'klien', 'freelance', 'proyek', 'fee'],
  },
  {
    name: 'Lainnya',
    emoji: '📦',
    type: 'both',
    color: '#64748B',
    keywords: [],
  },
];

export const CATEGORY_NAMES = DEFAULT_CATEGORIES.map((c) => c.name);

export function categoryMeta(name: string): { emoji: string; color: string } {
  const found = DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === (name || '').toLowerCase());
  return found ? { emoji: found.emoji, color: found.color } : { emoji: '📦', color: '#64748B' };
}

/**
 * Fallback kategorisasi berbasis kata kunci merchant.
 * Dipakai kalau API AI tidak tersedia, atau sebagai second opinion.
 */
export function guessCategory(merchant: string, notes = ''): string {
  const hay = `${merchant} ${notes}`.toLowerCase();
  for (const cat of DEFAULT_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (hay.includes(kw)) return cat.name;
    }
  }
  return 'Lainnya';
}

interface WalletSeed {
  id: string;
  name: string;
  kind: Wallet['kind'];
  emoji: string;
}

/** Dompet/akun default sesuai spesifikasi. */
export const DEFAULT_WALLETS: WalletSeed[] = [
  { id: 'cash', name: 'Cash', kind: 'cash', emoji: '💵' },
  { id: 'bca', name: 'BCA', kind: 'bank', emoji: '🏦' },
  { id: 'mandiri', name: 'Mandiri', kind: 'bank', emoji: '🏦' },
  { id: 'bri', name: 'BRI', kind: 'bank', emoji: '🏦' },
  { id: 'bni', name: 'BNI', kind: 'bank', emoji: '🏦' },
  { id: 'credit-card', name: 'Kartu Kredit', kind: 'credit', emoji: '💳' },
  { id: 'gopay', name: 'GoPay', kind: 'ewallet', emoji: '🟢' },
  { id: 'ovo', name: 'OVO', kind: 'ewallet', emoji: '🟣' },
  { id: 'dana', name: 'DANA', kind: 'ewallet', emoji: '🔵' },
  { id: 'shopeepay', name: 'ShopeePay', kind: 'ewallet', emoji: '🟠' },
  { id: 'investasi', name: 'Investasi', kind: 'investment', emoji: '📈' },
];

export const PAYMENT_METHODS = [
  'Cash',
  'Debit',
  'Kartu Kredit',
  'Transfer Bank',
  'QRIS',
  'E-Wallet',
  'Virtual Account',
  'Lainnya',
] as const;

export const CATEGORY_EMOJI_CHOICES = [
  '🍜', '🚗', '🛍', '💳', '🏠', '💊', '📚', '🎮', '✈️', '👨‍👩‍👧', '🕌', '📈',
  '💼', '🏪', '📦', '☕', '🎁', '🐾', '🧾', '💡', '🎓', '🏋️', '💄', '🔧',
];
