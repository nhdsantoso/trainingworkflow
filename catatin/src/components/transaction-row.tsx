'use client';

import Link from 'next/link';
import { Paperclip, ArrowLeftRight } from 'lucide-react';
import type { Transaction, Wallet } from '@/lib/types';
import { categoryMeta } from '@/lib/defaults';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';

export function TransactionRow({
  tx,
  wallets,
  href,
  onClick,
}: {
  tx: Transaction;
  wallets: Wallet[];
  href?: string;
  onClick?: () => void;
}) {
  const meta = categoryMeta(tx.category);
  const wallet = wallets.find((w) => w.id === tx.wallet);
  const toWallet = wallets.find((w) => w.id === tx.to_wallet);

  const amountClass =
    tx.type === 'income'
      ? 'text-[color:var(--viz-income)]'
      : tx.type === 'transfer'
        ? 'text-muted-foreground'
        : 'text-foreground';

  const prefix = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '';

  const inner = (
    <div className="flex w-full items-center gap-3 px-1 py-2.5">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[19px]"
        style={{ background: `${meta.color}1F` }}
        aria-hidden
      >
        {tx.type === 'transfer' ? <ArrowLeftRight className="h-5 w-5 text-muted-foreground" /> : meta.emoji}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-tight">{tx.merchant}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
          <span className="truncate">
            {tx.type === 'transfer' && toWallet
              ? `${wallet?.name ?? '—'} → ${toWallet.name}`
              : tx.category}
          </span>
          {tx.payment_method && tx.type !== 'transfer' && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{tx.payment_method}</span>
            </>
          )}
          {tx.time && (
            <>
              <span aria-hidden>·</span>
              <span className="tnum shrink-0">{tx.time}</span>
            </>
          )}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn('tnum text-[14px] font-bold leading-tight', amountClass)}>
          {prefix}
          {formatIDR(tx.amount)}
        </p>
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
          {tx.receipt_image && <Paperclip className="h-3 w-3" aria-label="Ada struk" />}
          {wallet?.name ?? '—'}
        </p>
      </div>
    </div>
  );

  const className = 'block w-full rounded-xl text-left transition-colors hover:bg-secondary';

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
