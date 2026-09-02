'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppData,
  Budget,
  Category,
  Debt,
  Goal,
  Recurring,
  Transaction,
  UserProfile,
  Wallet,
} from './types';
import { LocalRepo, SupabaseRepo, type Repo, type TableName } from './repo';
import { getSupabaseBrowser } from './supabase/client';
import { isSupabaseConfigured, RECEIPT_BUCKET } from './supabase/config';
import { DEMO_USER_ID } from './defaults';
import { nowISO, uid } from './utils';
import { todayISO, toISO, periodOf } from './format';

const EMPTY: AppData = {
  transactions: [],
  categories: [],
  wallets: [],
  budgets: [],
  goals: [],
  debts: [],
  recurring: [],
};

interface StoreValue extends AppData {
  ready: boolean;
  error: string | null;
  profile: UserProfile | null;
  mode: 'demo' | 'supabase';
  needsLogin: boolean;
  refresh: () => Promise<void>;

  addTransaction: (input: NewTransaction) => Promise<Transaction>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  duplicateTransaction: (id: string) => Promise<Transaction | null>;

  addCategory: (input: { name: string; emoji: string; type: Category['type']; color: string }) => Promise<Category>;
  updateCategory: (id: string, patch: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  addWallet: (input: { name: string; kind: Wallet['kind']; emoji: string; initial_balance: number }) => Promise<Wallet>;
  updateWallet: (id: string, patch: Partial<Wallet>) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;

  saveBudget: (category: string, amount: number, period: string) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  addGoal: (input: Omit<Goal, 'id' | 'user_id' | 'created_at'>) => Promise<Goal>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  addDebt: (input: Omit<Debt, 'id' | 'user_id' | 'created_at'>) => Promise<Debt>;
  updateDebt: (id: string, patch: Partial<Debt>) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;

  addRecurring: (input: Omit<Recurring, 'id' | 'user_id' | 'created_at'>) => Promise<Recurring>;
  updateRecurring: (id: string, patch: Partial<Recurring>) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  runRecurringNow: (id: string) => Promise<void>;

  uploadReceipt: (blob: Blob, filename: string) => Promise<string>;
  receiptUrl: (ref: string | null) => Promise<string | null>;

  resetData: (seedDemo: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

export type NewTransaction = Omit<
  Transaction,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'items' | 'subcategory'
> & {
  items?: Transaction['items'];
  subcategory?: string | null;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const repoRef = useRef<Repo | null>(null);
  const recurringChecked = useRef(false);

  const bootstrap = useCallback(async () => {
    setError(null);
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseBrowser()!;
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          repoRef.current = null;
          setProfile(null);
          setNeedsLogin(true);
          setData(EMPTY);
          setReady(true);
          return;
        }
        setNeedsLogin(false);
        const repo = new SupabaseRepo(user.id);
        repoRef.current = repo;
        setProfile({
          id: user.id,
          email: user.email ?? null,
          name:
            (user.user_metadata?.full_name as string) ||
            (user.user_metadata?.name as string) ||
            user.email?.split('@')[0] ||
            'Pengguna',
          mode: 'supabase',
        });
        setData(await repo.load());
      } else {
        const repo = new LocalRepo();
        repoRef.current = repo;
        setNeedsLogin(false);
        setProfile({ id: DEMO_USER_ID, email: null, name: 'Pengguna Demo', mode: 'demo' });
        setData(await repo.load());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser()!;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void bootstrap();
    });
    return () => sub.subscription.unsubscribe();
  }, [bootstrap]);

  const repo = () => {
    if (!repoRef.current) throw new Error('Data belum siap. Silakan login terlebih dahulu.');
    return repoRef.current;
  };

  /* ---------------- CRUD generik ---------------- */

  const insertRow = useCallback(async <K extends TableName>(table: K, row: AppData[K][number]) => {
    const saved = (await repo().insert(table, row)) as AppData[K][number];
    setData((prev) => ({ ...prev, [table]: [saved, ...(prev[table] as AppData[K])] } as AppData));
    return saved;
  }, []);

  const patchRow = useCallback(
    async <K extends TableName>(table: K, id: string, patch: Partial<AppData[K][number]>) => {
      await repo().update(table, id, patch);
      setData((prev) => ({
        ...prev,
        [table]: (prev[table] as Array<{ id: string }>).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      } as AppData));
    },
    [],
  );

  const removeRow = useCallback(async <K extends TableName>(table: K, id: string) => {
    await repo().remove(table, id);
    setData((prev) => ({
      ...prev,
      [table]: (prev[table] as Array<{ id: string }>).filter((r) => r.id !== id),
    } as AppData));
  }, []);

  /* ---------------- Transaksi ---------------- */

  const addTransaction = useCallback(
    async (input: NewTransaction) => {
      const row: Transaction = {
        id: uid(),
        user_id: repo().userId,
        subcategory: input.subcategory ?? null,
        items: input.items ?? [],
        created_at: nowISO(),
        updated_at: nowISO(),
        ...input,
      } as Transaction;
      const saved = await insertRow('transactions', row);
      return saved as Transaction;
    },
    [insertRow],
  );

  const duplicateTransaction = useCallback(
    async (id: string) => {
      const source = data.transactions.find((t) => t.id === id);
      if (!source) return null;
      const copy: Transaction = {
        ...source,
        id: uid(),
        date: todayISO(),
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      return (await insertRow('transactions', copy)) as Transaction;
    },
    [data.transactions, insertRow],
  );

  /* ---------------- Budget ---------------- */

  const saveBudget = useCallback(
    async (category: string, amount: number, period: string) => {
      const existing = data.budgets.find((b) => b.category === category && b.period === period);
      if (existing) {
        if (amount <= 0) return removeRow('budgets', existing.id);
        return patchRow('budgets', existing.id, { amount });
      }
      if (amount <= 0) return;
      const row: Budget = {
        id: uid(),
        user_id: repo().userId,
        category,
        amount,
        period,
        created_at: nowISO(),
      };
      await insertRow('budgets', row);
    },
    [data.budgets, insertRow, patchRow, removeRow],
  );

  /* ---------------- Transaksi rutin ---------------- */

  /** Membuat transaksi dari sebuah aturan rutin untuk tanggal tertentu. */
  const materializeRecurring = useCallback(
    async (rule: Recurring, date: string) => {
      const tx: Transaction = {
        id: uid(),
        user_id: repo().userId,
        type: rule.type,
        date,
        time: '09:00',
        merchant: rule.name,
        category: rule.category,
        subcategory: null,
        amount: rule.amount,
        payment_method: rule.payment_method,
        wallet: rule.wallet,
        to_wallet: null,
        notes: rule.notes ? `${rule.notes} (otomatis)` : 'Transaksi rutin otomatis',
        receipt_image: null,
        reference_number: null,
        items: [],
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      await insertRow('transactions', tx);
      await patchRow('recurring', rule.id, { last_run: date });
    },
    [insertRow, patchRow],
  );

  /**
   * Menjalankan aturan rutin yang sudah jatuh tempo dan diset auto_create.
   * Dieksekusi sekali per sesi setelah data selesai dimuat.
   */
  useEffect(() => {
    if (!ready || recurringChecked.current || !repoRef.current) return;
    if (data.recurring.length === 0) return;
    recurringChecked.current = true;

    (async () => {
      const today = new Date();
      for (const rule of data.recurring) {
        if (!rule.active || !rule.auto_create) continue;
        const dueDate = nextDueDateWithinMonth(rule, today);
        if (!dueDate) continue;
        if (rule.last_run && rule.last_run >= dueDate) continue;
        const already = data.transactions.some(
          (t) => t.merchant === rule.name && periodOf(t.date) === periodOf(dueDate) && t.amount === rule.amount,
        );
        if (already) continue;
        try {
          await materializeRecurring(rule, dueDate);
        } catch (e) {
          console.warn('[CATATIN] Gagal membuat transaksi rutin', rule.name, e);
        }
      }
    })();
  }, [ready, data.recurring, data.transactions, materializeRecurring]);

  /* ---------------- Struk ---------------- */

  const uploadReceipt = useCallback(async (blob: Blob, filename: string) => {
    return repo().uploadReceipt(blob, filename);
  }, []);

  /** Mengubah referensi struk menjadi URL yang bisa ditampilkan (signed URL untuk Supabase). */
  const receiptUrl = useCallback(async (ref: string | null) => {
    if (!ref) return null;
    if (ref.startsWith('data:') || ref.startsWith('http')) return ref;
    const supabase = getSupabaseBrowser();
    if (!supabase) return null;
    const { data: signed } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(ref, 60 * 60);
    return signed?.signedUrl ?? null;
  }, []);

  /* ---------------- Akun ---------------- */

  const resetData = useCallback(async (seedDemo: boolean) => {
    const next = await repo().reset(seedDemo);
    recurringChecked.current = true;
    setData(next);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    if (supabase) await supabase.auth.signOut();
    else {
      // Mode demo: bersihkan data lokal.
      window.localStorage.removeItem('catatin:data:v1');
      window.location.reload();
    }
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...data,
      ready,
      error,
      profile,
      mode: profile?.mode ?? (isSupabaseConfigured() ? 'supabase' : 'demo'),
      needsLogin,
      refresh: bootstrap,

      addTransaction,
      updateTransaction: (id, patch) => patchRow('transactions', id, { ...patch, updated_at: nowISO() }),
      deleteTransaction: (id) => removeRow('transactions', id),
      duplicateTransaction,

      addCategory: async (input) =>
        (await insertRow('categories', {
          id: uid(),
          user_id: repo().userId,
          is_default: false,
          created_at: nowISO(),
          ...input,
        } as Category)) as Category,
      updateCategory: (id, patch) => patchRow('categories', id, patch),
      deleteCategory: (id) => removeRow('categories', id),

      addWallet: async (input) =>
        (await insertRow('wallets', {
          id: uid(),
          user_id: repo().userId,
          archived: false,
          created_at: nowISO(),
          ...input,
        } as Wallet)) as Wallet,
      updateWallet: (id, patch) => patchRow('wallets', id, patch),
      deleteWallet: (id) => removeRow('wallets', id),

      saveBudget,
      deleteBudget: (id) => removeRow('budgets', id),

      addGoal: async (input) =>
        (await insertRow('goals', { id: uid(), user_id: repo().userId, created_at: nowISO(), ...input } as Goal)) as Goal,
      updateGoal: (id, patch) => patchRow('goals', id, patch),
      deleteGoal: (id) => removeRow('goals', id),

      addDebt: async (input) =>
        (await insertRow('debts', { id: uid(), user_id: repo().userId, created_at: nowISO(), ...input } as Debt)) as Debt,
      updateDebt: (id, patch) => patchRow('debts', id, patch),
      deleteDebt: (id) => removeRow('debts', id),

      addRecurring: async (input) =>
        (await insertRow('recurring', {
          id: uid(),
          user_id: repo().userId,
          created_at: nowISO(),
          ...input,
        } as Recurring)) as Recurring,
      updateRecurring: (id, patch) => patchRow('recurring', id, patch),
      deleteRecurring: (id) => removeRow('recurring', id),
      runRecurringNow: async (id) => {
        const rule = data.recurring.find((r) => r.id === id);
        if (rule) await materializeRecurring(rule, todayISO());
      },

      uploadReceipt,
      receiptUrl,
      resetData,
      signOut,
    }),
    [
      data,
      ready,
      error,
      profile,
      needsLogin,
      bootstrap,
      addTransaction,
      duplicateTransaction,
      insertRow,
      patchRow,
      removeRow,
      saveBudget,
      materializeRecurring,
      uploadReceipt,
      receiptUrl,
      resetData,
      signOut,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore harus dipakai di dalam <StoreProvider>.');
  return ctx;
}

/** Tanggal jatuh tempo aturan rutin pada bulan berjalan, kalau sudah lewat/hari ini. */
function nextDueDateWithinMonth(rule: Recurring, today: Date): string | null {
  if (rule.frequency === 'monthly') {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const day = Math.min(rule.day_of_month || 1, lastDay);
    if (today.getDate() < day) return null;
    return toISO(new Date(today.getFullYear(), today.getMonth(), day));
  }
  if (rule.frequency === 'yearly') {
    if (today.getMonth() + 1 !== rule.month_of_year) return null;
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const day = Math.min(rule.day_of_month || 1, lastDay);
    if (today.getDate() < day) return null;
    return toISO(new Date(today.getFullYear(), today.getMonth(), day));
  }
  // weekly: ambil kemunculan terakhir pada minggu berjalan
  const diff = (today.getDay() - rule.day_of_week + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() - diff);
  return toISO(d);
}
