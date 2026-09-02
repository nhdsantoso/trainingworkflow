'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageHeader, LoadingScreen } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Progress, Sheet, EmptyState, ConfirmDialog } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import { budgetProgress, summarize } from '@/lib/analytics';
import { currentPeriod, formatAmountInput, formatIDR, formatPeriod, parseIDR, shiftPeriod } from '@/lib/format';

export default function AnggaranPage() {
  const store = useStore();
  const { toast } = useToast();
  const [period, setPeriod] = useState(currentPeriod());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ category: string; amount: number } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const progress = useMemo(
    () => budgetProgress(store.budgets, store.transactions, period),
    [store.budgets, store.transactions, period],
  );
  const summary = useMemo(() => summarize(store.transactions, period), [store.transactions, period]);

  const totalBudget = progress.reduce((a, b) => a + b.budget.amount, 0);
  const totalSpent = progress.reduce((a, b) => a + b.spent, 0);

  if (!store.ready) return <LoadingScreen />;

  return (
    <div className="pb-8">
      <PageHeader
        title="Budget"
        subtitle={formatPeriod(period)}
        back="/profil"
        action={
          <Button variant="ghost" size="icon" aria-label="Tambah budget" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-1.5">
          <Button variant="ghost" size="icon" aria-label="Bulan sebelumnya" onClick={() => setPeriod(shiftPeriod(period, -1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="text-[14px] font-bold">{formatPeriod(period)}</p>
          <Button variant="ghost" size="icon" aria-label="Bulan berikutnya" onClick={() => setPeriod(shiftPeriod(period, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {progress.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[13px] font-bold">Total budget</p>
              <p className="tnum text-[13px] font-bold">
                {formatIDR(totalSpent)} <span className="text-muted-foreground">/ {formatIDR(totalBudget)}</span>
              </p>
            </div>
            <Progress
              value={totalBudget ? (totalSpent / totalBudget) * 100 : 0}
              indicatorClassName={totalSpent > totalBudget ? 'bg-destructive' : 'bg-primary'}
            />
            <p className="mt-2 text-[12px] text-muted-foreground">
              Pengeluaran bulan ini {formatIDR(summary.expense)} · sisa budget{' '}
              <span className={totalBudget - totalSpent < 0 ? 'font-bold text-destructive' : 'font-bold text-success'}>
                {formatIDR(totalBudget - totalSpent)}
              </span>
            </p>
          </section>
        )}

        {progress.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="Belum ada budget"
            description="Tetapkan batas pengeluaran per kategori agar CATATIN bisa mengingatkan Anda."
            action={<Button onClick={() => { setEditing(null); setOpen(true); }}>Buat budget pertama</Button>}
          />
        ) : (
          <ul className="space-y-2.5">
            {progress.map((b) => (
              <li key={b.budget.id} className="rounded-xl border border-border bg-card p-4">
                <button
                  className="w-full text-left"
                  onClick={() => {
                    setEditing({ category: b.budget.category, amount: b.budget.amount });
                    setOpen(true);
                  }}
                >
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-bold">
                      {b.emoji} {b.budget.category}
                    </span>
                    <span className="tnum shrink-0 text-[12.5px] text-muted-foreground">
                      {formatIDR(b.spent)} / {formatIDR(b.budget.amount)}
                    </span>
                  </div>
                  <Progress
                    value={b.ratio}
                    indicatorClassName={
                      b.status === 'over' ? 'bg-destructive' : b.status === 'warning' ? 'bg-warning' : 'bg-primary'
                    }
                  />
                  <p
                    className={`mt-1.5 text-[12px] font-medium ${
                      b.status === 'over' ? 'text-destructive' : b.status === 'warning' ? 'text-warning' : 'text-muted-foreground'
                    }`}
                  >
                    {b.status === 'over'
                      ? `🔴 Budget ${b.budget.category.toLowerCase()} telah terlampaui ${formatIDR(Math.abs(b.remaining))}.`
                      : b.status === 'warning'
                        ? `⚠️ Budget ${b.budget.category.toLowerCase()} sudah ${Math.round(b.ratio)}% terpakai.`
                        : `Sisa ${formatIDR(b.remaining)} · ${Math.round(b.ratio)}% terpakai`}
                  </p>
                </button>
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(b.budget.id)}>
                    Hapus
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BudgetSheet
        open={open}
        onClose={() => setOpen(false)}
        period={period}
        editing={editing}
        onSaved={() => toast('Budget disimpan.', 'success')}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Hapus budget?"
        description="Batas pengeluaran untuk kategori ini akan dihapus."
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await store.deleteBudget(deleteId);
          setDeleteId(null);
          toast('Budget dihapus.', 'success');
        }}
      />
    </div>
  );
}

function BudgetSheet({
  open,
  onClose,
  period,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  period: string;
  editing: { category: string; amount: number } | null;
  onSaved: () => void;
}) {
  const store = useStore();
  const { toast } = useToast();
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  const expenseCategories = store.categories.filter((c) => c.type !== 'income');

  if (open && !wasOpen) {
    setWasOpen(true);
    setCategory(editing?.category || expenseCategories[0]?.name || '');
    setAmount(editing?.amount ? formatAmountInput(String(editing.amount)) : '');
  }
  if (!open && wasOpen) setWasOpen(false);

  const save = async () => {
    const value = parseIDR(amount);
    if (!category) return toast('Pilih kategori dulu.', 'error');
    if (value <= 0) return toast('Nominal budget harus lebih dari 0.', 'error');
    setSaving(true);
    try {
      await store.saveBudget(category, value, period);
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan budget.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah Budget' : 'Budget Baru'}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button className="flex-[2]" loading={saving} onClick={save}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div>
          <Label htmlFor="b-cat">Kategori</Label>
          <Select id="b-cat" value={category} disabled={!!editing} onChange={(e) => setCategory(e.target.value)}>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.emoji} {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="b-amount">Budget per bulan ({formatPeriod(period)})</Label>
          <Input
            id="b-amount"
            inputMode="numeric"
            placeholder="3.000.000"
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
          />
        </div>
      </div>
    </Sheet>
  );
}
