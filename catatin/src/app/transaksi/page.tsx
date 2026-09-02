'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { PageHeader, LoadingScreen } from '@/components/common';
import { TransactionRow } from '@/components/transaction-row';
import { Input, Label, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, Sheet } from '@/components/ui/misc';
import { useStore } from '@/lib/store';
import { formatDayHeader, formatIDR, parseIDR, formatAmountInput } from '@/lib/format';
import type { Transaction, TransactionType } from '@/lib/types';

interface Filters {
  q: string;
  type: TransactionType | 'all';
  category: string;
  wallet: string;
  from: string;
  to: string;
  min: number;
  max: number;
}

const EMPTY_FILTERS: Filters = {
  q: '',
  type: 'all',
  category: '',
  wallet: '',
  from: '',
  to: '',
  min: 0,
  max: 0,
};

export default function TransaksiPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <TransaksiInner />
    </Suspense>
  );
}

function TransaksiInner() {
  const store = useStore();
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    category: params.get('kategori') || '',
    wallet: params.get('dompet') || '',
  });
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => applyFilters(store.transactions, filters), [store.transactions, filters]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const totals = useMemo(
    () => ({
      income: filtered.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0),
      expense: filtered.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0),
    }),
    [filtered],
  );

  const activeCount = countActive(filters);

  if (!store.ready) return <LoadingScreen />;

  return (
    <div>
      <PageHeader
        title="Transaksi"
        subtitle={`${filtered.length} transaksi ditemukan`}
        action={
          <Button variant="ghost" size="icon" aria-label="Filter" onClick={() => setFilterOpen(true)}>
            <span className="relative">
              <SlidersHorizontal className="h-5 w-5" />
              {activeCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </span>
          </Button>
        }
      />

      <div className="space-y-3 px-4 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari merchant, kategori, catatan…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            aria-label="Cari transaksi"
          />
          {filters.q && (
            <button
              onClick={() => setFilters((f) => ({ ...f, q: '' }))}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilters((f) => ({ ...f, type: t }))}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                filters.type === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {t === 'all' ? 'Semua' : t === 'expense' ? 'Pengeluaran' : t === 'income' ? 'Pemasukan' : 'Transfer'}
            </button>
          ))}
        </div>

        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.category && (
              <Chip label={filters.category} onClear={() => setFilters((f) => ({ ...f, category: '' }))} />
            )}
            {filters.wallet && (
              <Chip
                label={store.wallets.find((w) => w.id === filters.wallet)?.name || filters.wallet}
                onClear={() => setFilters((f) => ({ ...f, wallet: '' }))}
              />
            )}
            {(filters.from || filters.to) && (
              <Chip
                label={`${filters.from || '…'} → ${filters.to || '…'}`}
                onClear={() => setFilters((f) => ({ ...f, from: '', to: '' }))}
              />
            )}
            {(filters.min > 0 || filters.max > 0) && (
              <Chip
                label={`${formatIDR(filters.min, { compact: true })} – ${filters.max ? formatIDR(filters.max, { compact: true }) : '∞'}`}
                onClear={() => setFilters((f) => ({ ...f, min: 0, max: 0 }))}
              />
            )}
            <button
              onClick={() => setFilters({ ...EMPTY_FILTERS, q: filters.q })}
              className="text-[12px] font-semibold text-primary hover:underline"
            >
              Reset
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border bg-card p-2.5">
            <p className="text-[11px] text-muted-foreground">Pemasukan</p>
            <p className="tnum text-[14px] font-bold text-[color:var(--viz-income)]">
              {formatIDR(totals.income)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-2.5">
            <p className="text-[11px] text-muted-foreground">Pengeluaran</p>
            <p className="tnum text-[14px] font-bold text-[color:var(--viz-expense)]">
              {formatIDR(totals.expense)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pb-6 pt-4">
        {grouped.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="Tidak ada transaksi"
            description="Coba ubah kata kunci atau filter yang aktif."
          />
        ) : (
          grouped.map(([date, rows]) => {
            const dayTotal = rows.reduce(
              (a, t) => a + (t.type === 'expense' ? -t.amount : t.type === 'income' ? t.amount : 0),
              0,
            );
            return (
              <section key={date}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h2 className="text-[12.5px] font-bold text-muted-foreground">{formatDayHeader(date)}</h2>
                  <span className="tnum text-[12px] font-semibold text-muted-foreground">
                    {formatIDR(dayTotal, { withSign: true })}
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-card p-1.5">
                  {rows.map((t) => (
                    <TransactionRow key={t.id} tx={t} wallets={store.wallets} href={`/transaksi/${t.id}`} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
      />
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge tone="primary" className="gap-1 py-1">
      {label}
      <button onClick={onClear} aria-label={`Hapus filter ${label}`} className="rounded-full hover:bg-black/10">
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function FilterSheet({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (f: Filters) => void;
}) {
  const store = useStore();
  const [draft, setDraft] = useState(filters);

  // Sinkronkan draft setiap sheet dibuka.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setDraft(filters);
  }
  if (!open && wasOpen) setWasOpen(false);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filter Transaksi"
      footer={
        <>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              onApply({ ...EMPTY_FILTERS, q: filters.q });
              onClose();
            }}
          >
            Reset
          </Button>
          <Button
            className="flex-[2]"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Terapkan
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div>
          <Label htmlFor="f-cat">Kategori</Label>
          <Select
            id="f-cat"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          >
            <option value="">Semua kategori</option>
            {store.categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.emoji} {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="f-wallet">Dompet</Label>
          <Select
            id="f-wallet"
            value={draft.wallet}
            onChange={(e) => setDraft({ ...draft, wallet: e.target.value })}
          >
            <option value="">Semua dompet</option>
            {store.wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.emoji} {w.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="f-from">Dari tanggal</Label>
            <Input
              id="f-from"
              type="date"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="f-to">Sampai tanggal</Label>
            <Input
              id="f-to"
              type="date"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="f-min">Nominal minimum</Label>
            <Input
              id="f-min"
              inputMode="numeric"
              placeholder="0"
              value={draft.min ? formatAmountInput(String(draft.min)) : ''}
              onChange={(e) => setDraft({ ...draft, min: parseIDR(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="f-max">Nominal maksimum</Label>
            <Input
              id="f-max"
              inputMode="numeric"
              placeholder="Tanpa batas"
              value={draft.max ? formatAmountInput(String(draft.max)) : ''}
              onChange={(e) => setDraft({ ...draft, max: parseIDR(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function applyFilters(list: Transaction[], f: Filters): Transaction[] {
  const q = f.q.trim().toLowerCase();
  return list.filter((t) => {
    if (f.type !== 'all' && t.type !== f.type) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.wallet && t.wallet !== f.wallet && t.to_wallet !== f.wallet) return false;
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.min && t.amount < f.min) return false;
    if (f.max && t.amount > f.max) return false;
    if (q) {
      const hay = `${t.merchant} ${t.category} ${t.notes || ''} ${t.payment_method || ''} ${t.reference_number || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function countActive(f: Filters): number {
  let n = 0;
  if (f.category) n++;
  if (f.wallet) n++;
  if (f.from || f.to) n++;
  if (f.min || f.max) n++;
  return n;
}
