import type { AppData, Budget, Transaction, Wallet } from './types';
import { categoryMeta } from './defaults';
import { currentPeriod, daysInPeriod, periodOf, shiftPeriod, toDate, toISO } from './format';

export interface PeriodSummary {
  period: string;
  income: number;
  expense: number;
  savings: number; // income - expense
  transfer: number;
  net: number;
  txCount: number;
}

export function summarize(transactions: Transaction[], period: string): PeriodSummary {
  const rows = transactions.filter((t) => periodOf(t.date) === period);
  const income = rows.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expense = rows.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const transfer = rows.filter((t) => t.type === 'transfer').reduce((a, t) => a + t.amount, 0);
  return {
    period,
    income,
    expense,
    transfer,
    savings: income - expense,
    net: income - expense,
    txCount: rows.length,
  };
}

/** Saldo per wallet = saldo awal + income - expense + transfer masuk - transfer keluar. */
export function walletBalances(wallets: Wallet[], transactions: Transaction[]): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const w of wallets) balances[w.id] = w.initial_balance || 0;
  for (const t of transactions) {
    if (t.type === 'income') balances[t.wallet] = (balances[t.wallet] || 0) + t.amount;
    else if (t.type === 'expense') balances[t.wallet] = (balances[t.wallet] || 0) - t.amount;
    else if (t.type === 'transfer') {
      balances[t.wallet] = (balances[t.wallet] || 0) - t.amount;
      if (t.to_wallet) balances[t.to_wallet] = (balances[t.to_wallet] || 0) + t.amount;
    }
  }
  return balances;
}

export function totalBalance(wallets: Wallet[], transactions: Transaction[]): number {
  const balances = walletBalances(wallets, transactions);
  return wallets.filter((w) => !w.archived).reduce((a, w) => a + (balances[w.id] || 0), 0);
}

export interface CategorySlice {
  category: string;
  emoji: string;
  color: string;
  amount: number;
  share: number; // 0..100
  count: number;
}

export function expenseByCategory(transactions: Transaction[], period?: string): CategorySlice[] {
  const rows = transactions.filter(
    (t) => t.type === 'expense' && (!period || periodOf(t.date) === period),
  );
  const total = rows.reduce((a, t) => a + t.amount, 0);
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of rows) {
    const prev = map.get(t.category) || { amount: 0, count: 0 };
    map.set(t.category, { amount: prev.amount + t.amount, count: prev.count + 1 });
  }
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      ...categoryMeta(category),
      amount: v.amount,
      count: v.count,
      share: total > 0 ? (v.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function incomeByCategory(transactions: Transaction[], period?: string): CategorySlice[] {
  const rows = transactions.filter(
    (t) => t.type === 'income' && (!period || periodOf(t.date) === period),
  );
  const total = rows.reduce((a, t) => a + t.amount, 0);
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of rows) {
    const prev = map.get(t.category) || { amount: 0, count: 0 };
    map.set(t.category, { amount: prev.amount + t.amount, count: prev.count + 1 });
  }
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      ...categoryMeta(category),
      amount: v.amount,
      count: v.count,
      share: total > 0 ? (v.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface DailyPoint {
  day: number;
  label: string;
  income: number;
  expense: number;
  cumulative: number;
}

export function dailySeries(transactions: Transaction[], period: string): DailyPoint[] {
  // Untuk bulan berjalan, grafik berhenti di hari ini — hari yang belum terjadi
  // tidak digambar sebagai nol (itu akan terbaca seolah pengeluaran anjlok).
  const total =
    period === currentPeriod() ? Math.min(new Date().getDate(), daysInPeriod(period)) : daysInPeriod(period);
  const points: DailyPoint[] = [];
  let cumulative = 0;
  for (let day = 1; day <= total; day++) {
    const iso = `${period}-${String(day).padStart(2, '0')}`;
    const rows = transactions.filter((t) => t.date === iso);
    const income = rows.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const expense = rows.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    cumulative += expense;
    points.push({ day, label: String(day), income, expense, cumulative });
  }
  return points;
}

export interface MonthlyPoint {
  period: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function monthlySeries(transactions: Transaction[], months = 6, endPeriod = currentPeriod()): MonthlyPoint[] {
  const out: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const period = shiftPeriod(endPeriod, -i);
    const s = summarize(transactions, period);
    const m = Number(period.slice(5, 7));
    out.push({
      period,
      label: BULAN_PENDEK[m - 1],
      income: s.income,
      expense: s.expense,
      net: s.net,
    });
  }
  return out;
}

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  ratio: number; // 0..100+
  status: 'safe' | 'warning' | 'over';
  emoji: string;
  color: string;
}

export function budgetProgress(budgets: Budget[], transactions: Transaction[], period: string): BudgetProgress[] {
  return budgets
    .filter((b) => b.period === period)
    .map((b) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && periodOf(t.date) === period)
        .reduce((a, t) => a + t.amount, 0);
      const ratio = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      return {
        budget: b,
        spent,
        remaining: b.amount - spent,
        ratio,
        status: ratio >= 100 ? 'over' : ratio >= 80 ? 'warning' : 'safe',
        ...categoryMeta(b.category),
      } as BudgetProgress;
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export interface Insight {
  id: string;
  tone: 'info' | 'positive' | 'warning' | 'danger';
  icon: string;
  title: string;
  body: string;
}

/**
 * Insight deterministik yang dihitung langsung dari data user.
 * Dipakai sebagai baseline; AI assistant memakai ringkasan yang sama sebagai konteks.
 */
export function buildInsights(data: AppData, period = currentPeriod()): Insight[] {
  const prev = shiftPeriod(period, -1);
  const cur = summarize(data.transactions, period);
  const before = summarize(data.transactions, prev);
  const insights: Insight[] = [];

  const today = new Date();
  const isCurrentMonth = period === currentPeriod();
  const dayOfMonth = isCurrentMonth ? today.getDate() : daysInPeriod(period);
  const totalDays = daysInPeriod(period);

  // 1. Proyeksi pengeluaran akhir bulan
  if (isCurrentMonth && cur.expense > 0 && dayOfMonth >= 2) {
    const perDay = cur.expense / dayOfMonth;
    const projected = Math.round(perDay * totalDays);
    insights.push({
      id: 'projection',
      tone: projected > before.expense && before.expense > 0 ? 'warning' : 'info',
      icon: '📈',
      title: 'Proyeksi akhir bulan',
      body: `Dengan pola pengeluaran saat ini (rata-rata ${fmt(perDay)}/hari), Anda diperkirakan menghabiskan ${fmt(projected)} sampai akhir bulan.`,
    });
  }

  // 2. Kategori yang naik paling tajam vs bulan lalu
  const curCats = expenseByCategory(data.transactions, period);
  const prevCats = expenseByCategory(data.transactions, prev);
  const prevMap = new Map(prevCats.map((c) => [c.category, c.amount]));
  let biggest: { category: string; delta: number; pct: number; emoji: string } | null = null;
  for (const c of curCats) {
    const before2 = prevMap.get(c.category) || 0;
    if (before2 <= 0) continue;
    const pct = ((c.amount - before2) / before2) * 100;
    if (pct > 5 && (!biggest || pct > biggest.pct)) {
      biggest = { category: c.category, delta: c.amount - before2, pct, emoji: c.emoji };
    }
  }
  if (biggest) {
    insights.push({
      id: 'category-spike',
      tone: biggest.pct > 30 ? 'danger' : 'warning',
      icon: biggest.emoji,
      title: `Pengeluaran ${biggest.category} naik`,
      body: `Pengeluaran ${biggest.category.toLowerCase()} Anda bulan ini naik ${Math.round(biggest.pct)}% (${fmt(biggest.delta)}) dibanding bulan lalu.`,
    });
  }

  // 3. Kategori terbesar
  if (curCats.length > 0) {
    const top = curCats[0];
    insights.push({
      id: 'top-category',
      tone: 'info',
      icon: top.emoji,
      title: `${top.category} jadi pos terbesar`,
      body: `${fmt(top.amount)} atau ${Math.round(top.share)}% dari total pengeluaran bulan ini dari ${top.count} transaksi.`,
    });
  }

  // 4. Rasio tabungan
  if (cur.income > 0) {
    const rate = (cur.savings / cur.income) * 100;
    insights.push({
      id: 'savings-rate',
      tone: rate >= 20 ? 'positive' : rate >= 0 ? 'warning' : 'danger',
      icon: rate >= 20 ? '🎉' : rate >= 0 ? '⚖️' : '🔴',
      title: `Rasio tabungan ${Math.round(rate)}%`,
      body:
        rate >= 20
          ? `Bagus. Anda menyisihkan ${fmt(cur.savings)} dari pemasukan ${fmt(cur.income)} bulan ini.`
          : rate >= 0
            ? `Anda menyisihkan ${fmt(cur.savings)} dari pemasukan ${fmt(cur.income)}. Idealnya minimal 20% (${fmt(cur.income * 0.2)}).`
            : `Pengeluaran melebihi pemasukan sebesar ${fmt(Math.abs(cur.savings))} bulan ini.`,
    });
  }

  // 5. Budget kritis
  const budgets = budgetProgress(data.budgets, data.transactions, period);
  const over = budgets.find((b) => b.status === 'over');
  const warn = budgets.find((b) => b.status === 'warning');
  if (over) {
    insights.push({
      id: 'budget-over',
      tone: 'danger',
      icon: '🔴',
      title: 'Budget terlampaui',
      body: `Budget ${over.budget.category} telah terlampaui ${fmt(Math.abs(over.remaining))} (${Math.round(over.ratio)}% terpakai).`,
    });
  } else if (warn) {
    insights.push({
      id: 'budget-warning',
      tone: 'warning',
      icon: '⚠️',
      title: 'Budget hampir habis',
      body: `Budget ${warn.budget.category} sudah ${Math.round(warn.ratio)}% terpakai, sisa ${fmt(warn.remaining)}.`,
    });
  }

  // 6. Merchant paling sering
  const merchantMap = new Map<string, { count: number; amount: number }>();
  for (const t of data.transactions.filter((t) => t.type === 'expense' && periodOf(t.date) === period)) {
    const prev3 = merchantMap.get(t.merchant) || { count: 0, amount: 0 };
    merchantMap.set(t.merchant, { count: prev3.count + 1, amount: prev3.amount + t.amount });
  }
  const topMerchant = [...merchantMap.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (topMerchant && topMerchant[1].count >= 3) {
    insights.push({
      id: 'top-merchant',
      tone: 'info',
      icon: '🏪',
      title: `Sering belanja di ${topMerchant[0]}`,
      body: `${topMerchant[1].count} transaksi bulan ini, total ${fmt(topMerchant[1].amount)}.`,
    });
  }

  // 7. Jatuh tempo terdekat
  const soon = data.debts
    .filter((d) => d.status === 'open')
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0];
  if (soon) {
    const days = Math.ceil((toDate(soon.due_date).getTime() - new Date(toISO(today)).getTime()) / 86_400_000);
    insights.push({
      id: 'debt-due',
      tone: days < 0 ? 'danger' : days <= 7 ? 'warning' : 'info',
      icon: soon.kind === 'debt' ? '📤' : '📥',
      title: soon.kind === 'debt' ? 'Hutang jatuh tempo' : 'Piutang jatuh tempo',
      body:
        days < 0
          ? `${soon.person} — ${fmt(soon.amount - soon.paid_amount)} sudah lewat ${Math.abs(days)} hari dari jatuh tempo.`
          : `${soon.person} — ${fmt(soon.amount - soon.paid_amount)} jatuh tempo dalam ${days} hari.`,
    });
  }

  return insights;
}

function fmt(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

/** Ringkasan padat untuk dikirim sebagai konteks ke LLM (AI Keuangan). */
export function buildFinancialContext(data: AppData, period = currentPeriod()) {
  const prev = shiftPeriod(period, -1);
  const cur = summarize(data.transactions, period);
  const before = summarize(data.transactions, prev);
  const balances = walletBalances(data.wallets, data.transactions);

  const topMerchants = (() => {
    const map = new Map<string, number>();
    for (const t of data.transactions.filter((t) => t.type === 'expense' && periodOf(t.date) === period)) {
      map.set(t.merchant, (map.get(t.merchant) || 0) + t.amount);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([merchant, amount]) => ({ merchant, amount }));
  })();

  return {
    periode_berjalan: period,
    periode_sebelumnya: prev,
    mata_uang: 'IDR',
    saldo_total: totalBalance(data.wallets, data.transactions),
    saldo_per_wallet: data.wallets
      .filter((w) => !w.archived)
      .map((w) => ({ wallet: w.name, saldo: balances[w.id] || 0 })),
    bulan_ini: {
      pemasukan: cur.income,
      pengeluaran: cur.expense,
      tabungan: cur.savings,
      jumlah_transaksi: cur.txCount,
      per_kategori: expenseByCategory(data.transactions, period).map((c) => ({
        kategori: c.category,
        jumlah: c.amount,
        transaksi: c.count,
        persen: Math.round(c.share),
      })),
      merchant_terbesar: topMerchants,
    },
    bulan_lalu: {
      pemasukan: before.income,
      pengeluaran: before.expense,
      tabungan: before.savings,
      per_kategori: expenseByCategory(data.transactions, prev).map((c) => ({
        kategori: c.category,
        jumlah: c.amount,
      })),
    },
    tren_6_bulan: monthlySeries(data.transactions, 6, period),
    budget: budgetProgress(data.budgets, data.transactions, period).map((b) => ({
      kategori: b.budget.category,
      budget: b.budget.amount,
      terpakai: b.spent,
      sisa: b.remaining,
      persen: Math.round(b.ratio),
    })),
    target_keuangan: data.goals.map((g) => ({
      nama: g.name,
      target: g.target_amount,
      terkumpul: g.current_amount,
      tenggat: g.target_date,
    })),
    hutang_piutang: data.debts.map((d) => ({
      jenis: d.kind === 'debt' ? 'hutang' : 'piutang',
      pihak: d.person,
      nominal: d.amount - d.paid_amount,
      jatuh_tempo: d.due_date,
      status: d.status,
    })),
    transaksi_rutin: data.recurring.filter((r) => r.active).map((r) => ({
      nama: r.name,
      jenis: r.type,
      nominal: r.amount,
      tanggal: r.day_of_month,
    })),
  };
}
