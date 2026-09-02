'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, FileType2 } from 'lucide-react';
import { PageHeader, SectionTitle, StatTile, LoadingScreen } from '@/components/common';
import { CashFlowChart, DailySpendingChart, NetFlowChart, RankedCategoryBars } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Sheet, EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import {
  dailySeries,
  expenseByCategory,
  incomeByCategory,
  monthlySeries,
  summarize,
} from '@/lib/analytics';
import { currentPeriod, formatIDR, formatPeriod, periodOf, shiftPeriod } from '@/lib/format';
import { exportCSV, exportExcel, exportPDF, toExportRows } from '@/lib/export';

type RangeMode = 'harian' | 'mingguan' | 'bulanan' | 'custom';

export default function LaporanPage() {
  const store = useStore();
  const router = useRouter();
  const [period, setPeriod] = useState(currentPeriod());
  const [exportOpen, setExportOpen] = useState(false);

  const summary = useMemo(() => summarize(store.transactions, period), [store.transactions, period]);
  const prevSummary = useMemo(
    () => summarize(store.transactions, shiftPeriod(period, -1)),
    [store.transactions, period],
  );
  const categories = useMemo(() => expenseByCategory(store.transactions, period), [store.transactions, period]);
  const incomeCats = useMemo(() => incomeByCategory(store.transactions, period), [store.transactions, period]);
  const daily = useMemo(() => dailySeries(store.transactions, period), [store.transactions, period]);
  const trend = useMemo(() => monthlySeries(store.transactions, 6, period), [store.transactions, period]);

  const monthTx = store.transactions.filter((t) => periodOf(t.date) === period);
  const isCurrent = period === currentPeriod();

  const expenseDelta =
    prevSummary.expense > 0 ? ((summary.expense - prevSummary.expense) / prevSummary.expense) * 100 : 0;

  if (!store.ready) return <LoadingScreen />;

  return (
    <div className="pb-8">
      <PageHeader
        title="Laporan Keuangan"
        subtitle={formatPeriod(period)}
        action={
          <Button variant="ghost" size="icon" aria-label="Ekspor" onClick={() => setExportOpen(true)}>
            <Download className="h-5 w-5" />
          </Button>
        }
      />

      <div className="space-y-5 px-4 pt-4">
        {/* Pemilih periode */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-1.5">
          <Button variant="ghost" size="icon" aria-label="Bulan sebelumnya" onClick={() => setPeriod(shiftPeriod(period, -1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="text-[14px] font-bold">{formatPeriod(period)}</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bulan berikutnya"
            disabled={isCurrent}
            onClick={() => setPeriod(shiftPeriod(period, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <section className="grid grid-cols-3 gap-2.5">
          <StatTile label="Pemasukan" value={summary.income} tone="income" />
          <StatTile label="Pengeluaran" value={summary.expense} tone="expense" />
          <StatTile label="Net cash flow" value={summary.net} tone="savings" />
        </section>

        {prevSummary.expense > 0 && (
          <p className="rounded-xl bg-secondary px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
            Pengeluaran {expenseDelta >= 0 ? 'naik' : 'turun'}{' '}
            <span className={`font-bold ${expenseDelta >= 0 ? 'text-destructive' : 'text-success'}`}>
              {Math.abs(Math.round(expenseDelta))}%
            </span>{' '}
            dibanding {formatPeriod(shiftPeriod(period, -1))} ({formatIDR(prevSummary.expense)}).
          </p>
        )}

        {monthTx.length === 0 ? (
          <EmptyState
            icon="📊"
            title="Belum ada data di periode ini"
            description="Pilih bulan lain, atau catat transaksi baru untuk melihat laporannya."
            action={<Button onClick={() => router.push('/tambah?mode=scan')}>Catat transaksi</Button>}
          />
        ) : (
          <>
            <section className="rounded-xl border border-border bg-card p-4">
              <SectionTitle title="Pemasukan vs pengeluaran" />
              <CashFlowChart data={trend} height={200} />
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <SectionTitle title="Pengeluaran harian" />
              <p className="mb-2 text-[11.5px] text-muted-foreground">
                Rata-rata {formatIDR(summary.expense / Math.max(1, daily.filter((d) => d.expense > 0).length))} per
                hari aktif.
              </p>
              <DailySpendingChart data={daily} />
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <SectionTitle title="Tren arus kas bersih" />
              <p className="mb-2 text-[11.5px] text-muted-foreground">
                Biru = surplus, merah = defisit.
              </p>
              <NetFlowChart data={trend} />
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <SectionTitle title="Top pengeluaran terbesar" />
              {categories.length ? (
                <RankedCategoryBars
                  items={categories}
                  max={5}
                  onSelect={(c) => router.push(`/transaksi?kategori=${encodeURIComponent(c)}`)}
                />
              ) : (
                <p className="py-4 text-center text-[12.5px] text-muted-foreground">Belum ada pengeluaran.</p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <SectionTitle title="Semua kategori pengeluaran" />
              <RankedCategoryBars
                items={categories}
                onSelect={(c) => router.push(`/transaksi?kategori=${encodeURIComponent(c)}`)}
              />
            </section>

            {incomeCats.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-4">
                <SectionTitle title="Sumber pemasukan" />
                <RankedCategoryBars
                  items={incomeCats}
                  onSelect={(c) => router.push(`/transaksi?kategori=${encodeURIComponent(c)}`)}
                />
              </section>
            )}
          </>
        )}
      </div>

      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} defaultPeriod={period} />
    </div>
  );
}

function ExportSheet({
  open,
  onClose,
  defaultPeriod,
}: {
  open: boolean;
  onClose: () => void;
  defaultPeriod: string;
}) {
  const store = useStore();
  const { toast } = useToast();
  const [mode, setMode] = useState<RangeMode>('bulanan');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const range = useMemo(() => computeRange(mode, defaultPeriod, from, to), [mode, defaultPeriod, from, to]);
  const rows = useMemo(
    () =>
      store.transactions
        .filter((t) => t.date >= range.from && t.date <= range.to)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [store.transactions, range],
  );

  const run = async (kind: 'csv' | 'excel' | 'pdf') => {
    setBusy(kind);
    try {
      const exportRows = toExportRows(rows, store.wallets);
      const filename = `catatin-${range.from}_${range.to}`;
      if (kind === 'csv') exportCSV(exportRows, filename);
      else if (kind === 'excel') await exportExcel(exportRows, filename);
      else {
        const income = rows.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
        const expense = rows.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
        const catMap = new Map<string, number>();
        for (const t of rows.filter((t) => t.type === 'expense')) {
          catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
        }
        await exportPDF(exportRows, {
          period: defaultPeriod,
          income,
          expense,
          net: income - expense,
          topCategories: [...catMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([category, amount]) => ({ category, amount })),
          userName: store.profile?.name || 'Pengguna CATATIN',
          rangeLabel: range.label,
        }, filename);
      }
      toast(`Berhasil mengekspor ${rows.length} transaksi.`, 'success');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ekspor gagal.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Ekspor Laporan">
      <div className="space-y-4">
        <div>
          <Label htmlFor="range">Rentang waktu</Label>
          <Select id="range" value={mode} onChange={(e) => setMode(e.target.value as RangeMode)}>
            <option value="harian">Harian (hari ini)</option>
            <option value="mingguan">Mingguan (7 hari terakhir)</option>
            <option value="bulanan">Bulanan ({formatPeriod(defaultPeriod)})</option>
            <option value="custom">Rentang khusus</option>
          </Select>
        </div>

        {mode === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ex-from">Dari</Label>
              <Input id="ex-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ex-to">Sampai</Label>
              <Input id="ex-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}

        <p className="rounded-lg bg-secondary px-3 py-2 text-[12.5px] text-muted-foreground">
          {range.label} · <span className="font-semibold text-foreground">{rows.length} transaksi</span> siap diekspor.
        </p>

        <div className="grid gap-2">
          <Button variant="outline" disabled={!rows.length} loading={busy === 'excel'} onClick={() => run('excel')}>
            <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
          </Button>
          <Button variant="outline" disabled={!rows.length} loading={busy === 'csv'} onClick={() => run('csv')}>
            <FileText className="h-4 w-4" /> CSV (.csv)
          </Button>
          <Button variant="outline" disabled={!rows.length} loading={busy === 'pdf'} onClick={() => run('pdf')}>
            <FileType2 className="h-4 w-4" /> PDF (.pdf)
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function computeRange(mode: RangeMode, period: string, from: string, to: string) {
  const today = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (mode === 'harian') {
    const d = iso(today);
    return { from: d, to: d, label: `Hari ini (${d})` };
  }
  if (mode === 'mingguan') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { from: iso(start), to: iso(today), label: `7 hari terakhir (${iso(start)} – ${iso(today)})` };
  }
  if (mode === 'custom') {
    const f = from || `${period}-01`;
    const t = to || iso(today);
    return { from: f, to: t, label: `${f} – ${t}` };
  }
  const [y, m] = period.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${period}-01`,
    to: `${period}-${String(last).padStart(2, '0')}`,
    label: formatPeriod(period),
  };
}
