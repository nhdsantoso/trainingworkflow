/**
 * Tipe data inti CATATIN.
 * Semua entitas memiliki user_id supaya kompatibel dengan Row Level Security Supabase.
 */

export type TransactionType = 'income' | 'expense' | 'transfer';

export type PaymentMethod =
  | 'Cash'
  | 'Debit'
  | 'Kartu Kredit'
  | 'Transfer Bank'
  | 'QRIS'
  | 'E-Wallet'
  | 'Virtual Account'
  | 'Lainnya';

export interface TransactionItem {
  name: string;
  qty?: number;
  price?: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:mm
  merchant: string;
  category: string;
  subcategory: string | null;
  amount: number;
  payment_method: PaymentMethod | string | null;
  wallet: string; // wallet id (sumber dana)
  to_wallet: string | null; // wallet tujuan, hanya untuk type = transfer
  notes: string | null;
  receipt_image: string | null; // URL publik/signed atau data URL (mode demo)
  reference_number: string | null;
  items: TransactionItem[];
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  type: 'income' | 'expense' | 'both';
  color: string;
  is_default: boolean;
  created_at: string;
}

export type WalletKind = 'cash' | 'bank' | 'ewallet' | 'credit' | 'investment';

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  kind: WalletKind;
  emoji: string;
  initial_balance: number;
  archived: boolean;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  period: string; // YYYY-MM
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  target_amount: number;
  current_amount: number;
  target_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
}

export type DebtKind = 'debt' | 'receivable'; // hutang | piutang
export type DebtStatus = 'open' | 'paid';

export interface Debt {
  id: string;
  user_id: string;
  kind: DebtKind;
  person: string;
  amount: number;
  paid_amount: number;
  date: string;
  due_date: string;
  status: DebtStatus;
  notes: string | null;
  created_at: string;
}

export type RecurringFrequency = 'monthly' | 'weekly' | 'yearly';

export interface Recurring {
  id: string;
  user_id: string;
  name: string;
  type: Exclude<TransactionType, 'transfer'>;
  amount: number;
  category: string;
  wallet: string;
  frequency: RecurringFrequency;
  day_of_month: number; // 1-31 (monthly/yearly)
  day_of_week: number; // 0-6 (weekly)
  month_of_year: number; // 1-12 (yearly)
  payment_method: string | null;
  auto_create: boolean; // true = otomatis dibuatkan transaksi, false = hanya pengingat
  active: boolean;
  last_run: string | null; // YYYY-MM-DD terakhir kali dieksekusi
  notes: string | null;
  created_at: string;
}

/** Hasil parsing OCR + AI sebelum dikonfirmasi user. */
export interface ParsedTransaction {
  date: string;
  time: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  payment_method: string;
  transaction_type: TransactionType;
  reference_number: string;
  items: TransactionItem[];
  notes?: string;
  confidence: number; // 0..1
}

export interface ParseResponse {
  ok: boolean;
  data?: ParsedTransaction;
  raw_text?: string;
  warning?: string;
  error?: string;
  engine?: string;
}

export interface AppData {
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
  recurring: Recurring[];
}

export interface UserProfile {
  id: string;
  email: string | null;
  name: string;
  mode: 'demo' | 'supabase';
}
