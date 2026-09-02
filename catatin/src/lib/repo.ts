'use client';

import type { AppData, Budget, Category, Debt, Goal, Recurring, Transaction, Wallet } from './types';
import { buildDemoData, buildEmptyData } from './demo-data';
import { DEMO_USER_ID } from './defaults';
import { getSupabaseBrowser } from './supabase/client';
import { RECEIPT_BUCKET } from './supabase/config';
import { nowISO, uid } from './utils';

export type TableName = 'transactions' | 'categories' | 'wallets' | 'budgets' | 'goals' | 'debts' | 'recurring';

/** Nama tabel di Postgres untuk tiap koleksi. */
const SUPABASE_TABLE: Record<TableName, string> = {
  transactions: 'transactions',
  categories: 'categories',
  wallets: 'wallets',
  budgets: 'budgets',
  goals: 'goals',
  debts: 'debts',
  recurring: 'recurring_transactions',
};

type RowOf<K extends TableName> = AppData[K][number];

export interface Repo {
  mode: 'demo' | 'supabase';
  userId: string;
  load(): Promise<AppData>;
  insert<K extends TableName>(table: K, row: RowOf<K>): Promise<RowOf<K>>;
  update<K extends TableName>(table: K, id: string, patch: Partial<RowOf<K>>): Promise<void>;
  remove<K extends TableName>(table: K, id: string): Promise<void>;
  uploadReceipt(file: Blob, filename: string): Promise<string>;
  reset(seedDemo: boolean): Promise<AppData>;
}

/* ------------------------------------------------------------------ */
/* Mode DEMO — localStorage                                            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'catatin:data:v1';

function readLocal(): AppData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed || !Array.isArray(parsed.transactions)) return null;
    // Lengkapi koleksi yang mungkin belum ada pada versi data lama.
    return {
      transactions: parsed.transactions ?? [],
      categories: parsed.categories ?? [],
      wallets: parsed.wallets ?? [],
      budgets: parsed.budgets ?? [],
      goals: parsed.goals ?? [],
      debts: parsed.debts ?? [],
      recurring: parsed.recurring ?? [],
    };
  } catch {
    return null;
  }
}

function writeLocal(data: AppData) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[CATATIN] Gagal menyimpan ke localStorage', e);
  }
}

export class LocalRepo implements Repo {
  mode = 'demo' as const;
  userId = DEMO_USER_ID;
  private cache: AppData;

  constructor() {
    this.cache = readLocal() ?? buildDemoData(DEMO_USER_ID);
    writeLocal(this.cache);
  }

  async load(): Promise<AppData> {
    this.cache = readLocal() ?? this.cache;
    return structuredCloneSafe(this.cache);
  }

  async insert<K extends TableName>(table: K, row: RowOf<K>): Promise<RowOf<K>> {
    (this.cache[table] as RowOf<K>[]).unshift(row);
    writeLocal(this.cache);
    return row;
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<RowOf<K>>): Promise<void> {
    const list = this.cache[table] as RowOf<K>[];
    const idx = list.findIndex((r) => (r as { id: string }).id === id);
    if (idx >= 0) list[idx] = { ...list[idx], ...patch };
    writeLocal(this.cache);
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    const list = this.cache[table] as RowOf<K>[];
    const idx = list.findIndex((r) => (r as { id: string }).id === id);
    if (idx >= 0) list.splice(idx, 1);
    writeLocal(this.cache);
  }

  /** Mode demo menyimpan struk sebagai data URL di localStorage (dikompresi lebih dulu). */
  async uploadReceipt(file: Blob): Promise<string> {
    return await blobToDataUrl(file);
  }

  async reset(seedDemo: boolean): Promise<AppData> {
    this.cache = seedDemo ? buildDemoData(DEMO_USER_ID) : buildEmptyData(DEMO_USER_ID);
    writeLocal(this.cache);
    return structuredCloneSafe(this.cache);
  }
}

/* ------------------------------------------------------------------ */
/* Mode SUPABASE — Postgres + Storage + RLS                            */
/* ------------------------------------------------------------------ */

export class SupabaseRepo implements Repo {
  mode = 'supabase' as const;

  constructor(public userId: string) {}

  private get db() {
    const client = getSupabaseBrowser();
    if (!client) throw new Error('Supabase belum dikonfigurasi.');
    return client;
  }

  async load(): Promise<AppData> {
    const db = this.db;
    const [tx, cat, wal, bud, goal, debt, rec] = await Promise.all([
      db.from('transactions').select('*').order('date', { ascending: false }).order('time', { ascending: false }),
      db.from('categories').select('*').order('name'),
      db.from('wallets').select('*').order('created_at'),
      db.from('budgets').select('*'),
      db.from('goals').select('*'),
      db.from('debts').select('*'),
      db.from('recurring_transactions').select('*'),
    ]);

    const err = [tx, cat, wal, bud, goal, debt, rec].find((r) => r.error)?.error;
    if (err) throw new Error(err.message);

    let data: AppData = {
      transactions: (tx.data || []) as Transaction[],
      categories: (cat.data || []) as Category[],
      wallets: (wal.data || []) as Wallet[],
      budgets: (bud.data || []) as Budget[],
      goals: (goal.data || []) as Goal[],
      debts: (debt.data || []) as Debt[],
      recurring: (rec.data || []) as Recurring[],
    };

    // Akun baru: buat kategori & wallet default sekali saja.
    if (data.categories.length === 0 && data.wallets.length === 0) {
      const seed = buildEmptyData(this.userId);
      await db.from('categories').insert(seed.categories.map((c) => ({ ...c, id: uid() })));
      await db.from('wallets').insert(seed.wallets);
      const [cat2, wal2] = await Promise.all([
        db.from('categories').select('*').order('name'),
        db.from('wallets').select('*').order('created_at'),
      ]);
      data = {
        ...data,
        categories: (cat2.data || []) as Category[],
        wallets: (wal2.data || []) as Wallet[],
      };
    }

    return data;
  }

  async insert<K extends TableName>(table: K, row: RowOf<K>): Promise<RowOf<K>> {
    const payload = { ...(row as unknown as Record<string, unknown>), user_id: this.userId };
    const { data, error } = await this.db.from(SUPABASE_TABLE[table]).insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data as RowOf<K>;
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<RowOf<K>>): Promise<void> {
    const payload = { ...(patch as unknown as Record<string, unknown>) };
    if (table === 'transactions') payload.updated_at = nowISO();
    const { error } = await this.db
      .from(SUPABASE_TABLE[table])
      .update(payload)
      .eq('id', id)
      .eq('user_id', this.userId);
    if (error) throw new Error(error.message);
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    const { error } = await this.db
      .from(SUPABASE_TABLE[table])
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);
    if (error) throw new Error(error.message);
  }

  /** Struk diupload ke bucket privat; path selalu diawali user id agar RLS storage berlaku. */
  async uploadReceipt(file: Blob, filename: string): Promise<string> {
    const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
    const path = `${this.userId}/${Date.now()}-${uid()}.${ext}`;
    const { error } = await this.db.storage.from(RECEIPT_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });
    if (error) throw new Error(error.message);
    return path;
  }

  async reset(seedDemo: boolean): Promise<AppData> {
    const db = this.db;
    for (const table of ['transactions', 'budgets', 'goals', 'debts', 'recurring_transactions'] as const) {
      await db.from(table).delete().eq('user_id', this.userId);
    }
    if (seedDemo) {
      const demo = buildDemoData(this.userId);
      const walletIds = new Set((await db.from('wallets').select('id')).data?.map((w) => w.id) || []);
      const rows = demo.transactions
        .filter((t) => walletIds.has(t.wallet))
        .map((t) => ({ ...t, id: uid(), user_id: this.userId }));
      if (rows.length) await db.from('transactions').insert(rows);
      await db.from('budgets').insert(demo.budgets.map((b) => ({ ...b, id: uid(), user_id: this.userId })));
      await db.from('goals').insert(demo.goals.map((g) => ({ ...g, id: uid(), user_id: this.userId })));
      await db.from('debts').insert(demo.debts.map((d) => ({ ...d, id: uid(), user_id: this.userId })));
      await db
        .from('recurring_transactions')
        .insert(demo.recurring.map((r) => ({ ...r, id: uid(), user_id: this.userId })));
    }
    return this.load();
  }
}

/* ------------------------------------------------------------------ */

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(blob);
  });
}
