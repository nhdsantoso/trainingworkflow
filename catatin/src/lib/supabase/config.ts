export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

/**
 * Aplikasi berjalan dalam dua mode:
 *  - "supabase" : env NEXT_PUBLIC_SUPABASE_URL & ANON_KEY tersedia -> auth + Postgres + Storage
 *  - "demo"     : env belum diisi -> data tersimpan lokal di browser (localStorage)
 * Ini membuat aplikasi tetap 100% bisa dipakai sebelum Supabase dikonfigurasi.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http'));
}

export const RECEIPT_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_RECEIPT_BUCKET || 'receipts';
