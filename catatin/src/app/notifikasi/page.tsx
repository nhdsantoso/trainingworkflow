'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { PageHeader, LoadingScreen, InsightCard } from '@/components/common';
import { EmptyState } from '@/components/ui/misc';
import { useStore } from '@/lib/store';
import { budgetProgress, summarize } from '@/lib/analytics';
import { currentPeriod, formatIDR, todayISO, toDate, formatDateShort } from '@/lib/format';

interface Notice {
  id: string;
  icon: string;
  title: string;
  body: string;
  tone: 'info' | 'positive' | 'warning' | 'danger';
  href: string;
}

/**
 * Pusat notifikasi. Semua pesan dihitung dari data user saat halaman dibuka
 * (tidak butuh push server), sesuai contoh di spesifikasi:
 * pengeluaran harian, pemakaian budget, dan pengingat jatuh tempo.
 */
export default function NotifikasiPage() {
  const store = useStore();
  const period = currentPeriod();
  const today = todayISO();

  const notices = useMemo<Notice[]>(() => {
    if (!store.ready) return [];
    const list: Notice[] = [];

    const todayExpense = store.transactions
      .filter((t) => t.date === today && t.type === 'expense')
      .reduce((a, t) => a + t.amount, 0);
    const todayCount = store.transactions.filter((t) => t.date === today).length;

    list.push({
      id: 'today',
      icon: '📅',
      title: 'Ringkasan hari ini',
      body:
        todayCount > 0
          ? `Pengeluaran hari ini ${formatIDR(todayExpense)} dari ${todayCount} transaksi.`
          : 'Belum ada transaksi tercatat hari ini. Jangan lupa catat pengeluaran Anda.',
      tone: todayExpense > 500_000 ? 'warning' : 'info',
      href: '/transaksi',
    });

    for (const b of budgetProgress(store.budgets, store.transactions, period)) {
      if (b.status === 'over') {
        list.push({
          id: `budget-${b.budget.id}`,
          icon: '🔴',
          title: `Budget ${b.budget.category} terlampaui`,
          body: `Sudah terpakai ${Math.round(b.ratio)}% (${formatIDR(b.spent)} dari ${formatIDR(b.budget.amount)}).`,
          tone: 'danger',
          href: '/anggaran',
        });
      } else if (b.status === 'warning') {
        list.push({
          id: `budget-${b.budget.id}`,
          icon: '⚠️',
          title: `Budget ${b.budget.category} hampir habis`,
          body: `Anda sudah menggunakan ${Math.round(b.ratio)}% budget ${b.budget.category.toLowerCase()}. Sisa ${formatIDR(b.remaining)}.`,
          tone: 'warning',
          href: '/anggaran',
        });
      }
    }

    for (const d of store.debts.filter((d) => d.status === 'open')) {
      const days = Math.round((toDate(d.due_date).getTime() - toDate(today).getTime()) / 86_400_000);
      if (days > 14) continue;
      list.push({
        id: `debt-${d.id}`,
        icon: days < 0 ? '🔴' : '⏰',
        title: days < 0 ? 'Sudah lewat jatuh tempo' : days === 0 ? 'Jatuh tempo hari ini' : `Jatuh tempo ${days} hari lagi`,
        body: `${d.kind === 'debt' ? 'Hutang' : 'Piutang'} ${d.person} sebesar ${formatIDR(d.amount - d.paid_amount)} (${formatDateShort(d.due_date)}).`,
        tone: days < 0 ? 'danger' : days <= 3 ? 'warning' : 'info',
        href: '/hutang',
      });
    }

    const dayNow = new Date().getDate();
    for (const r of store.recurring.filter((r) => r.active && r.frequency === 'monthly')) {
      const diff = r.day_of_month - dayNow;
      if (diff < 0 || diff > 3) continue;
      list.push({
        id: `rec-${r.id}`,
        icon: r.type === 'income' ? '💰' : '🧾',
        title: diff === 0 ? `${r.name} jatuh tempo hari ini` : `${r.name} ${diff} hari lagi`,
        body: `${r.type === 'income' ? 'Pemasukan' : 'Pembayaran'} rutin ${formatIDR(r.amount)} setiap tanggal ${r.day_of_month}.`,
        tone: diff === 0 ? 'warning' : 'info',
        href: '/rutin',
      });
    }

    const summary = summarize(store.transactions, period);
    if (summary.income > 0 && summary.savings < 0) {
      list.push({
        id: 'deficit',
        icon: '📉',
        title: 'Pengeluaran melebihi pemasukan',
        body: `Bulan ini Anda defisit ${formatIDR(Math.abs(summary.savings))}. Cek kategori terbesar di Laporan.`,
        tone: 'danger',
        href: '/laporan',
      });
    }

    const order = { danger: 0, warning: 1, info: 2, positive: 3 } as const;
    return list.sort((a, b) => order[a.tone] - order[b.tone]);
  }, [store.ready, store.transactions, store.budgets, store.debts, store.recurring, period, today]);

  if (!store.ready) return <LoadingScreen />;

  return (
    <div className="pb-8">
      <PageHeader title="Notifikasi" subtitle={`${notices.length} hal yang perlu diperhatikan`} back="/" />
      <div className="space-y-2.5 px-4 pt-4">
        {notices.length === 0 ? (
          <EmptyState icon="🔔" title="Tidak ada notifikasi" description="Semua terkendali. Bagus!" />
        ) : (
          notices.map((n) => (
            <Link key={n.id} href={n.href} className="block">
              <InsightCard icon={n.icon} title={n.title} body={n.body} tone={n.tone} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
