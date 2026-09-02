'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatIDR } from '@/lib/format';

export function PageHeader({
  title,
  subtitle,
  back,
  action,
  sticky = true,
}: {
  title: string;
  subtitle?: string;
  back?: string | boolean;
  action?: React.ReactNode;
  sticky?: boolean;
}) {
  const router = useRouter();
  return (
    <header
      className={cn(
        'z-40 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3',
        sticky && 'glass sticky top-0',
      )}
    >
      {back && (
        <button
          onClick={() => (typeof back === 'string' ? router.push(back) : router.back())}
          aria-label="Kembali"
          className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({
  title,
  href,
  hrefLabel = 'Lihat semua',
  right,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {href ? (
        <Link href={href} className="text-[12px] font-semibold text-primary hover:underline">
          {hrefLabel}
        </Link>
      ) : (
        right
      )}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = 'default',
  icon,
  hint,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'income' | 'expense' | 'savings';
  icon?: string;
  hint?: string;
}) {
  const toneClass =
    tone === 'income'
      ? 'text-[color:var(--viz-income)]'
      : tone === 'expense'
        ? 'text-[color:var(--viz-expense)]'
        : tone === 'savings'
          ? value >= 0
            ? 'text-success'
            : 'text-destructive'
          : 'text-foreground';

  // Nominal panjang diringkas ("Rp 34,5 jt") supaya tetap satu baris di layar HP;
  // nilai persisnya tetap tersedia lewat tooltip.
  const exact = formatIDR(value);
  const display = exact.length > 11 ? formatIDR(value, { compact: true }) : exact;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {icon && <span>{icon}</span>}
        {label}
      </p>
      <p title={exact} className={cn('mt-1 flex items-baseline gap-0.5', toneClass)}>
        <span className="text-[10.5px] font-semibold opacity-70">Rp</span>
        <span className="tnum truncate text-[15.5px] font-extrabold leading-tight">
          {display.replace('Rp ', '')}
        </span>
      </p>
      {hint && <p className="mt-0.5 text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function InsightCard({
  icon,
  title,
  body,
  tone = 'info',
}: {
  icon: string;
  title: string;
  body: string;
  tone?: string;
}) {
  const border =
    tone === 'danger'
      ? 'border-l-destructive'
      : tone === 'warning'
        ? 'border-l-warning'
        : tone === 'positive'
          ? 'border-l-success'
          : 'border-l-primary';

  return (
    <div className={cn('rounded-xl border border-border border-l-4 bg-card p-3.5', border)}>
      <div className="flex gap-2.5">
        <span className="text-[17px] leading-none">{icon}</span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold leading-snug">{title}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}

export function LoadingScreen({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}
