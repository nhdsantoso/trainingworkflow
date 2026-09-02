'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Sparkles, Wallet2, Target, PiggyBank, Bell } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  buildFinancialContext,
  buildInsights,
  budgetProgress,
  expenseByCategory,
  monthlySeries,
  summarize,
  totalBalance,
  walletBalances,
  type Insight,
} from '@/lib/analytics';
import { currentPeriod, formatIDR, formatPeriod, todayISO } from '@/lib/format';
import { PageHeader, SectionTitle, StatTile, InsightCard, LoadingScreen } from '@/components/common';
import { CashFlowChart, RankedCategoryBars } from '@/components/charts';
import { TransactionRow } from '@/components/transaction-row';
import { Progress, Badge, EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const store = useStore();
  const router = useRouter();
  const [hideBalance, setHideBalance] = useState(false);
  const [aiInsights, setAiInsights] = useState<Insight[]>([]);
  const period = currentPeriod();

  useEffect(() => {
    if (store.ready && store.needsLogin) router.replace('/masuk');
  }, [store.ready, store.needsLogin, router]);

  const data = useMemo(
    () => ({
      transactions: store.transactions,
      categories: store.categories,
      wallets: store.wallets,
      budgets: store.budgets,
      goals: store.goals,
      debts: store.debts,
      recurring: store.recurring,
    }),
    [store.transactions, store.categories, store.wallets, store.budgets, store.goals, store.debts, store.recurring],
  );

  const summary = useMemo(() => summarize(store.transactions, period), [store.transactions, period]);
  const balance = useMemo(() => totalBalance(store.wallets, store.transactions), [store.wallets, store.transactions]);
  const categories = useMemo(() => expenseByCategory(store.transactions, period), [store.transactions, period]);
  const trend = useMemo(() => monthlySeries(store.transactions, 6, period), [store.transactions, period]);
  const insights = useMemo(() => (store.ready ? buildInsights(data, period) : []), [data, period, store.ready]);
  const budgets = useMemo(
    () => budgetProgress(store.budgets, store.transactions, period),
    [store.budgets, store.transactions, period],
  );
  const balances = useMemo(
    () => walletBalances(store.wallets, store.transactions),
    [store.wallets, store.transactions],
  );

  const recent = store.transactions.slice(0, 5);
  const today = todayISO();
  const todayExpense = store.transactions
    .filter((t) => t.date === today && t.type === 'expense')
    .reduce((a, t) => a + t.amount, 0);

  // Insight tambahan dari AI (opsional; dashboard tetap jalan tanpa API key).
  useEffect(() => {
    if (!store.ready || store.transactions.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: buildFinancialContext(data, period) }),
        });
        const json = (await res.json()) as { insights?: Insight[] };
        if (!cancelled && json.insights?.length) setAiInsights(json.insights);
      } catch {
        /* diabaikan: insight lokal sudah cukup */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready, store.transactions.length, period]);

  if (!store.ready) return <LoadingScreen />;
  if (store.needsLogin) return <LoadingScreen label="Mengalihkan ke halaman masuk…" />;

  const savingsRate = summary.income > 0 ? (summary.savings / summary.income) * 100 : 0;

  return (
    <div className="pb-6">
      <PageHeader
        title="Keuangan Saya"
        subtitle={`${store.profile?.name ?? 'Pengguna'} · ${formatPeriod(period)}`}
        action={
          <Link
            href="/notifikasi"
            aria-label="Notifikasi"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
          >
            <Bell className="h-5 w-5" />
            {insights.some((i) => i.tone === 'danger' || i.tone === 'warning') && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            )}
          </Link>
        }
      />

      <div className="space-y-5 px-4 pt-4">
        {/* Saldo total */}
        <section className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg">
          <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10" aria-hidden />
          <div className="absolute -bottom-16 -left-6 h-36 w-36 rounded-full bg-white/5" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium opacity-90">Saldo total</p>
              <button
                onClick={() => setHideBalance((v) => !v)}
                aria-label={hideBalance ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
                className="rounded-md p-1 hover:bg-white/15"
              >
                {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="tnum mt-1 text-[30px] font-extrabold leading-none">
              {hideBalance ? 'Rp ••••••••' : formatIDR(balance)}
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11.5px]">
              <Badge className="bg-white/20 text-white">
                Hari ini {formatIDR(todayExpense, { compact: true })}
              </Badge>
              <Badge className="bg-white/20 text-white">
                Tabungan {Math.round(savingsRate)}%
              </Badge>
            </div>
          </div>
        </section>

        {/* Ringkasan bulan ini */}
        <section className="grid grid-cols-3 gap-2.5">
          <StatTile label="Pemasukan" value={summary.income} tone="income" icon="↓" />
          <StatTile label="Pengeluaran" value={summary.expense} tone="expense" icon="↑" />
          <StatTile label="Tabungan" value={summary.savings} tone="savings" icon="🐷" />
        </section>

        {/* Cash flow */}
        <section className="rounded-xl border border-border bg-card p-4">
          <SectionTitle title="Arus kas 6 bulan" href="/laporan" hrefLabel="Laporan" />
          <CashFlowChart data={trend} />
        </section>

        {/* Insight AI */}
        <section>
          <SectionTitle title="Insight AI" href="/ai" hrefLabel="Tanya AI" />
          <div className="space-y-2.5">
            {[...aiInsights, ...insights].slice(0, 4).map((i) => (
              <InsightCard key={i.id} icon={i.icon} title={i.title} body={i.body} tone={i.tone} />
            ))}
            {insights.length === 0 && aiInsights.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-[12.5px] text-muted-foreground">
                Catat beberapa transaksi dulu, insight akan muncul otomatis di sini.
              </div>
            )}
          </div>
        </section>

        {/* Kategori terbesar */}
        <section className="rounded-xl border border-border bg-card p-4">
          <SectionTitle title="Kategori pengeluaran terbesar" href="/laporan" hrefLabel="Detail" />
          {categories.length ? (
            <RankedCategoryBars
              items={categories}
              max={6}
              onSelect={(c) => router.push(`/transaksi?kategori=${encodeURIComponent(c)}`)}
            />
          ) : (
            <p className="py-4 text-center text-[12.5px] text-muted-foreground">
              Belum ada pengeluaran bulan ini.
            </p>
          )}
        </section>

        {/* Budget */}
        {budgets.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-4">
            <SectionTitle title="Budget bulan ini" href="/anggaran" hrefLabel="Atur" />
            <div className="space-y-3">
              {budgets.slice(0, 3).map((b) => (
                <div key={b.budget.id}>
                  <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                    <span className="font-semibold">
                      {b.emoji} {b.budget.category}
                    </span>
                    <span className="tnum text-muted-foreground">
                      {formatIDR(b.spent, { compact: true })} / {formatIDR(b.budget.amount, { compact: true })}
                    </span>
                  </div>
                  <Progress
                    value={b.ratio}
                    indicatorClassName={
                      b.status === 'over' ? 'bg-destructive' : b.status === 'warning' ? 'bg-warning' : 'bg-primary'
                    }
                  />
                  {b.status !== 'safe' && (
                    <p
                      className={`mt-1 text-[11.5px] font-medium ${b.status === 'over' ? 'text-destructive' : 'text-warning'}`}
                    >
                      {b.status === 'over'
                        ? `🔴 Budget ${b.budget.category.toLowerCase()} telah terlampaui.`
                        : `⚠️ Budget ${b.budget.category.toLowerCase()} sudah ${Math.round(b.ratio)}% terpakai.`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pintasan */}
        <section className="grid grid-cols-3 gap-2.5">
          <ShortcutTile href="/dompet" icon={<Wallet2 className="h-5 w-5" />} label="Dompet" />
          <ShortcutTile href="/target" icon={<Target className="h-5 w-5" />} label="Target" />
          <ShortcutTile href="/hutang" icon={<PiggyBank className="h-5 w-5" />} label="Hutang" />
        </section>

        {/* Dompet ringkas */}
        <section className="rounded-xl border border-border bg-card p-4">
          <SectionTitle title="Dompet & akun" href="/dompet" />
          <ul className="space-y-1">
            {store.wallets
              .filter((w) => !w.archived)
              .slice(0, 4)
              .map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-[17px]">{w.emoji}</span>
                  <span className="flex-1 truncate text-[13.5px] font-medium">{w.name}</span>
                  <span className="tnum text-[13.5px] font-bold">{formatIDR(balances[w.id] || 0)}</span>
                </li>
              ))}
          </ul>
        </section>

        {/* Transaksi terbaru */}
        <section>
          <SectionTitle title="Transaksi terbaru" href="/transaksi" />
          {recent.length ? (
            <div className="rounded-xl border border-border bg-card p-1.5">
              {recent.map((t) => (
                <TransactionRow key={t.id} tx={t} wallets={store.wallets} href={`/transaksi/${t.id}`} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="🧾"
              title="Belum ada transaksi"
              description="Tekan tombol + di bawah, lalu foto struk atau bukti transfer Anda."
              action={
                <Button onClick={() => router.push('/tambah?mode=scan')}>
                  <Sparkles className="h-4 w-4" /> Scan struk pertama
                </Button>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ShortcutTile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-[12px] font-semibold transition-colors hover:bg-secondary"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </Link>
  );
}
