'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { Transaction, TransactionItem, TransactionType } from '@/lib/types';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatAmountInput, formatIDR, nowHM, parseIDR, todayISO } from '@/lib/format';
import { PAYMENT_METHODS, categoryMeta } from '@/lib/defaults';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export interface TransactionFormValue {
  type: TransactionType;
  date: string;
  time: string;
  merchant: string;
  category: string;
  amount: number;
  payment_method: string;
  wallet: string;
  to_wallet: string | null;
  notes: string;
  reference_number: string;
  items: TransactionItem[];
}

export function emptyFormValue(walletId: string, category: string): TransactionFormValue {
  return {
    type: 'expense',
    date: todayISO(),
    time: nowHM(),
    merchant: '',
    category,
    amount: 0,
    payment_method: 'Cash',
    wallet: walletId,
    to_wallet: null,
    notes: '',
    reference_number: '',
    items: [],
  };
}

export function fromTransaction(tx: Transaction): TransactionFormValue {
  return {
    type: tx.type,
    date: tx.date,
    time: tx.time || nowHM(),
    merchant: tx.merchant,
    category: tx.category,
    amount: tx.amount,
    payment_method: String(tx.payment_method || 'Cash'),
    wallet: tx.wallet,
    to_wallet: tx.to_wallet,
    notes: tx.notes || '',
    reference_number: tx.reference_number || '',
    items: tx.items || [],
  };
}

const TYPES: Array<{ value: TransactionType; label: string; hint: string }> = [
  { value: 'expense', label: 'Pengeluaran', hint: 'Uang keluar' },
  { value: 'income', label: 'Pemasukan', hint: 'Uang masuk' },
  { value: 'transfer', label: 'Transfer', hint: 'Antar dompet' },
];

export function TransactionForm({
  value,
  onChange,
  showItems = true,
}: {
  value: TransactionFormValue;
  onChange: (next: TransactionFormValue) => void;
  showItems?: boolean;
}) {
  const { categories, wallets } = useStore();
  const [amountText, setAmountText] = useState(() =>
    value.amount ? formatAmountInput(String(value.amount)) : '',
  );

  useEffect(() => {
    setAmountText(value.amount ? formatAmountInput(String(value.amount)) : '');
  }, [value.amount]);

  const set = <K extends keyof TransactionFormValue>(key: K, next: TransactionFormValue[K]) =>
    onChange({ ...value, [key]: next });

  const availableCategories = useMemo(
    () =>
      categories.filter((c) =>
        value.type === 'income' ? c.type !== 'expense' : value.type === 'expense' ? c.type !== 'income' : true,
      ),
    [categories, value.type],
  );

  const activeWallets = wallets.filter((w) => !w.archived);
  const meta = categoryMeta(value.category);

  return (
    <div className="space-y-4">
      {/* Jenis transaksi */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-secondary p-1">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              const nextCategory =
                t.value === 'income'
                  ? categories.find((c) => c.name === 'Gaji')?.name || value.category
                  : value.category;
              onChange({
                ...value,
                type: t.value,
                category: t.value === 'transfer' ? 'Investasi' : nextCategory,
                to_wallet:
                  t.value === 'transfer'
                    ? value.to_wallet || activeWallets.find((w) => w.id !== value.wallet)?.id || null
                    : null,
              });
            }}
            className={cn(
              'rounded-lg py-2 text-[13px] font-semibold transition-colors',
              value.type === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Nominal */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Label htmlFor="amount">Nominal</Label>
        <div className="flex items-baseline gap-2">
          <span className="text-[20px] font-bold text-muted-foreground">Rp</span>
          <input
            id="amount"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={amountText}
            onChange={(e) => {
              const formatted = formatAmountInput(e.target.value);
              setAmountText(formatted);
              set('amount', parseIDR(formatted));
            }}
            className="tnum w-full bg-transparent text-[30px] font-extrabold outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Merchant */}
      <div>
        <Label htmlFor="merchant">
          {value.type === 'income' ? 'Sumber pemasukan' : value.type === 'transfer' ? 'Keterangan' : 'Merchant / Toko'}
        </Label>
        <Input
          id="merchant"
          value={value.merchant}
          onChange={(e) => set('merchant', e.target.value)}
          placeholder={value.type === 'income' ? 'Contoh: PT Telkomsel' : 'Contoh: RM Padang Sederhana'}
        />
      </div>

      {/* Kategori */}
      <div>
        <Label htmlFor="category">Kategori</Label>
        <div className="flex items-center gap-2">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[18px]"
            style={{ background: `${meta.color}1F` }}
            aria-hidden
          >
            {meta.emoji}
          </span>
          <Select id="category" value={value.category} onChange={(e) => set('category', e.target.value)}>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.emoji} {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Tanggal & waktu */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="date">Tanggal</Label>
          <Input id="date" type="date" value={value.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="time">Waktu</Label>
          <Input id="time" type="time" value={value.time} onChange={(e) => set('time', e.target.value)} />
        </div>
      </div>

      {/* Dompet */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="wallet">{value.type === 'transfer' ? 'Dari dompet' : 'Dompet'}</Label>
          <Select id="wallet" value={value.wallet} onChange={(e) => set('wallet', e.target.value)}>
            {activeWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.emoji} {w.name}
              </option>
            ))}
          </Select>
        </div>
        {value.type === 'transfer' ? (
          <div>
            <Label htmlFor="to_wallet">Ke dompet</Label>
            <Select
              id="to_wallet"
              value={value.to_wallet || ''}
              onChange={(e) => set('to_wallet', e.target.value || null)}
            >
              <option value="">Pilih dompet…</option>
              {activeWallets
                .filter((w) => w.id !== value.wallet)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.emoji} {w.name}
                  </option>
                ))}
            </Select>
          </div>
        ) : (
          <div>
            <Label htmlFor="method">Metode bayar</Label>
            <Select
              id="method"
              value={value.payment_method}
              onChange={(e) => set('payment_method', e.target.value)}
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Catatan & referensi */}
      <div>
        <Label htmlFor="notes">Catatan</Label>
        <Textarea
          id="notes"
          rows={2}
          value={value.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Contoh: makan siang bareng tim"
        />
      </div>

      <div>
        <Label htmlFor="ref">Nomor referensi (opsional)</Label>
        <Input
          id="ref"
          value={value.reference_number}
          onChange={(e) => set('reference_number', e.target.value)}
          placeholder="Contoh: TRX20260424123045"
        />
      </div>

      {/* Item pembelian */}
      {showItems && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">Item pembelian ({value.items.length})</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set('items', [...value.items, { name: '', qty: 1, price: 0 }])}
            >
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          </div>
          {value.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-3 text-center text-[12px] text-muted-foreground">
              Belum ada item. Item terisi otomatis kalau terbaca di struk.
            </p>
          ) : (
            <ul className="space-y-2">
              {value.items.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input
                    aria-label={`Nama item ${i + 1}`}
                    className="h-10 flex-1"
                    value={item.name}
                    placeholder="Nama item"
                    onChange={(e) => {
                      const items = [...value.items];
                      items[i] = { ...items[i], name: e.target.value };
                      set('items', items);
                    }}
                  />
                  <Input
                    aria-label={`Jumlah item ${i + 1}`}
                    className="h-10 w-14 text-center"
                    inputMode="numeric"
                    value={item.qty ?? 1}
                    onChange={(e) => {
                      const items = [...value.items];
                      items[i] = { ...items[i], qty: Number(e.target.value.replace(/\D/g, '')) || 1 };
                      set('items', items);
                    }}
                  />
                  <Input
                    aria-label={`Harga item ${i + 1}`}
                    className="tnum h-10 w-24 text-right"
                    inputMode="numeric"
                    value={item.price ? formatAmountInput(String(item.price)) : ''}
                    placeholder="0"
                    onChange={(e) => {
                      const items = [...value.items];
                      items[i] = { ...items[i], price: parseIDR(e.target.value) };
                      set('items', items);
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Hapus item ${i + 1}`}
                    onClick={() => set('items', value.items.filter((_, idx) => idx !== i))}
                    className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {value.items.length > 0 && (
            <p className="mt-2 text-right text-[12px] text-muted-foreground">
              Total item:{' '}
              <span className="tnum font-semibold text-foreground">
                {formatIDR(value.items.reduce((a, i) => a + (i.price || 0) * (i.qty || 1), 0))}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Validasi sebelum simpan. Mengembalikan pesan error, atau null kalau valid. */
export function validateForm(value: TransactionFormValue): string | null {
  if (!value.amount || value.amount <= 0) return 'Nominal harus lebih dari 0.';
  if (!value.merchant.trim()) return 'Nama merchant / keterangan belum diisi.';
  if (!value.wallet) return 'Dompet belum dipilih.';
  if (value.type === 'transfer') {
    if (!value.to_wallet) return 'Dompet tujuan belum dipilih.';
    if (value.to_wallet === value.wallet) return 'Dompet asal dan tujuan tidak boleh sama.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return 'Tanggal tidak valid.';
  return null;
}
