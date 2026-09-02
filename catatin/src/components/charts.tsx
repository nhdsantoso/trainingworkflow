'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Prinsip visualisasi yang dipakai di sini:
 *  - Pemasukan vs pengeluaran adalah POLARITAS, bukan sekadar dua kategori.
 *    Dipakai pasangan diverging biru (masuk) <-> merah (keluar); aman untuk buta warna
 *    (protan ΔE 21.6 light / 19.2 dark) dan tidak memakai kombinasi merah-hijau.
 *  - Rincian per kategori memakai BAR PERINGKAT satu warna, bukan pie/donut.
 *    Kategori bisa belasan; identitasnya dibawa label + emoji, bukan belasan hue.
 *  - Setiap grafik punya tooltip; legenda hadir untuk >= 2 seri.
 */

interface VizColors {
  income: string;
  expense: string;
  neutral: string;
  grid: string;
  axis: string;
  surface: string;
  bar: string;
  barSoft: string;
}

const FALLBACK: VizColors = {
  income: '#2a78d6',
  expense: '#e34948',
  neutral: '#94a3b8',
  grid: '#e7e9f0',
  axis: '#6b7280',
  surface: '#ffffff',
  bar: '#2a78d6',
  barSoft: '#9ec5f4',
};

/** Membaca token warna dari CSS supaya light/dark cukup diatur di satu tempat. */
export function useVizColors(): VizColors {
  const [colors, setColors] = useState<VizColors>(FALLBACK);

  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const get = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
      setColors({
        income: get('--viz-income', FALLBACK.income),
        expense: get('--viz-expense', FALLBACK.expense),
        neutral: get('--viz-neutral', FALLBACK.neutral),
        grid: get('--viz-grid', FALLBACK.grid),
        axis: get('--viz-axis', FALLBACK.axis),
        surface: get('--viz-surface', FALLBACK.surface),
        bar: get('--viz-bar', FALLBACK.bar),
        barSoft: get('--viz-bar-soft', FALLBACK.barSoft),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

function ChartTooltip({
  active,
  payload,
  label,
  labelPrefix = '',
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string | number;
  labelPrefix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-lg">
      <p className="mb-1 font-semibold text-popover-foreground">
        {labelPrefix}
        {label}
      </p>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="tnum ml-auto font-semibold text-popover-foreground">
            {formatIDR(p.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const axisTick = (fill: string) => ({ fill, fontSize: 11, fontWeight: 500 });

function compactAxis(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 1_000_000)}jt`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(value);
}

/* -------------------------------------------------------------- */
/* Cash flow: pemasukan vs pengeluaran per bulan                    */
/* -------------------------------------------------------------- */

export function CashFlowChart({
  data,
  height = 190,
}: {
  data: Array<{ label: string; income: number; expense: number }>;
  height?: number;
}) {
  const c = useVizColors();
  return (
    <div>
      <Legend items={[{ label: 'Pemasukan', color: c.income }, { label: 'Pengeluaran', color: c.expense }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick(c.axis)} />
          <YAxis
            tickFormatter={compactAxis}
            tickLine={false}
            axisLine={false}
            tick={axisTick(c.axis)}
            width={46}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, fillOpacity: 0.5 }} />
          <Bar dataKey="income" name="Pemasukan" fill={c.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expense" name="Pengeluaran" fill={c.expense} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Pengeluaran harian                                               */
/* -------------------------------------------------------------- */

export function DailySpendingChart({
  data,
  height = 170,
}: {
  data: Array<{ label: string; expense: number }>;
  height?: number;
}) {
  const c = useVizColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={axisTick(c.axis)}
          interval={Math.max(0, Math.floor(data.length / 8) - 1)}
        />
        <YAxis
          tickFormatter={compactAxis}
          tickLine={false}
          axisLine={false}
          tick={axisTick(c.axis)}
          width={46}
        />
        <Tooltip content={<ChartTooltip labelPrefix="Tgl " />} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="expense"
          name="Pengeluaran"
          stroke={c.expense}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------- */
/* Arus kas bersih per bulan (diverging: positif biru / negatif merah) */
/* -------------------------------------------------------------- */

export function NetFlowChart({
  data,
  height = 170,
}: {
  data: Array<{ label: string; net: number }>;
  height?: number;
}) {
  const c = useVizColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick(c.axis)} />
        <YAxis
          tickFormatter={compactAxis}
          tickLine={false}
          axisLine={false}
          tick={axisTick(c.axis)}
          width={46}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, fillOpacity: 0.5 }} />
        <Bar dataKey="net" name="Arus kas bersih" radius={[4, 4, 0, 0]} maxBarSize={26}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.net >= 0 ? c.income : c.expense} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------- */
/* Bar peringkat kategori (label langsung, satu warna)              */
/* -------------------------------------------------------------- */

export function RankedCategoryBars({
  items,
  max,
  onSelect,
  className,
}: {
  items: Array<{ category: string; emoji: string; amount: number; share: number; count: number }>;
  max?: number;
  onSelect?: (category: string) => void;
  className?: string;
}) {
  const top = max ? items.slice(0, max) : items;
  const peak = Math.max(1, ...top.map((i) => i.amount));

  return (
    <ul className={cn('space-y-2.5', className)}>
      {top.map((item, index) => {
        const Row = (
          <>
            <div className="mb-1 flex items-baseline gap-2">
              <span className="w-4 shrink-0 text-[11px] font-bold text-muted-foreground tnum">{index + 1}</span>
              <span className="shrink-0 text-[15px] leading-none">{item.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.category}</span>
              <span className="tnum shrink-0 text-[13px] font-bold">{formatIDR(item.amount)}</span>
            </div>
            <div className="ml-6 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(3, (item.amount / peak) * 100)}%`,
                    background: 'var(--viz-bar)',
                  }}
                />
              </div>
              <span className="tnum w-12 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                {Math.round(item.share)}%
              </span>
            </div>
          </>
        );

        return (
          <li key={item.category}>
            {onSelect ? (
              <button
                onClick={() => onSelect(item.category)}
                className="w-full rounded-lg p-1 text-left transition-colors hover:bg-secondary"
              >
                {Row}
              </button>
            ) : (
              <div className="p-1">{Row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
