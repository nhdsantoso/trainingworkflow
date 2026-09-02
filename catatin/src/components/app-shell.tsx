'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Home, ReceiptText, BarChart3, User, Plus, Camera, ImageUp, PencilLine, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet } from '@/components/ui/misc';
import { useStore } from '@/lib/store';

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/transaksi', label: 'Transaksi', icon: ReceiptText },
  { href: '__fab__', label: '', icon: Plus },
  { href: '/laporan', label: 'Laporan', icon: BarChart3 },
  { href: '/profil', label: 'Profil', icon: User },
];

/** Halaman yang tampil tanpa bottom navigation (fokus penuh). */
const BARE_ROUTES = ['/masuk', '/tambah', '/share'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [quickOpen, setQuickOpen] = useState(false);
  const { needsLogin, ready } = useStore();

  const bare = BARE_ROUTES.some((r) => pathname.startsWith(r));

  if (bare || (ready && needsLogin && pathname !== '/')) {
    return <main className="mx-auto min-h-dvh w-full max-w-md">{children}</main>;
  }

  const go = (href: string) => {
    setQuickOpen(false);
    router.push(href);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md">
        <div className="glass safe-bottom relative flex items-end justify-around border-t border-border bg-card/85 px-2 pt-2">
          {TABS.map((tab) => {
            if (tab.href === '__fab__') {
              return (
                <button
                  key="fab"
                  onClick={() => setQuickOpen(true)}
                  aria-label="Catat transaksi"
                  className="relative -top-5 flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_hsl(var(--primary))] ring-4 ring-background transition-transform active:scale-95"
                >
                  <Plus className="h-7 w-7" strokeWidth={2.6} />
                </button>
              );
            }
            const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex min-w-[64px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <QuickAddSheet open={quickOpen} onClose={() => setQuickOpen(false)} onGo={go} />
    </div>
  );
}

function QuickAddSheet({
  open,
  onClose,
  onGo,
}: {
  open: boolean;
  onClose: () => void;
  onGo: (href: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Catat Transaksi">
      <p className="-mt-2 mb-4 text-[13px] text-muted-foreground">
        Pilih cara tercepat. Scan struk memakai AI, cukup foto lalu konfirmasi.
      </p>

      <button
        onClick={() => onGo('/tambah?mode=scan')}
        className="mb-3 flex w-full items-center gap-4 rounded-xl bg-primary p-4 text-left text-primary-foreground shadow-lg transition-transform active:scale-[0.99]"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Camera className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold">📷 Scan Struk</p>
          <p className="text-[12px] opacity-90">Foto struk, AI baca otomatis — tercepat</p>
        </div>
      </button>

      <div className="grid gap-2">
        <QuickOption
          icon={<ImageUp className="h-5 w-5" />}
          emoji="🖼"
          title="Upload Bukti"
          subtitle="Screenshot transfer / galeri"
          onClick={() => onGo('/tambah?mode=upload')}
        />
        <QuickOption
          icon={<PencilLine className="h-5 w-5" />}
          emoji="✍️"
          title="Input Manual"
          subtitle="Isi sendiri nominal & kategori"
          onClick={() => onGo('/tambah?mode=manual')}
        />
        <QuickOption
          icon={<Mic className="h-5 w-5" />}
          emoji="🎤"
          title="Bicara / Ketik"
          subtitle='Contoh: "makan siang 75 ribu pakai qris"'
          onClick={() => onGo('/tambah?mode=voice')}
        />
      </div>
    </Sheet>
  );
}

function QuickOption({
  icon,
  emoji,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">
          {emoji} {title}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  );
}
