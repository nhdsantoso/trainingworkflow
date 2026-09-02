'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet2, Tags, Target, PiggyBank, Repeat, PieChart, Sparkles, Download,
  Moon, Sun, LogOut, RefreshCw, Database, ShieldCheck, ChevronRight, Trash2,
} from 'lucide-react';
import { PageHeader, LoadingScreen, SectionTitle } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Badge, ConfirmDialog, Switch } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import { totalBalance } from '@/lib/analytics';
import { formatIDR } from '@/lib/format';
import { exportCSV, exportExcel, toExportRows } from '@/lib/export';

const MENU = [
  { href: '/dompet', icon: Wallet2, label: 'Dompet & Akun', desc: 'Cash, bank, e-wallet, investasi' },
  { href: '/kategori', icon: Tags, label: 'Kategori', desc: 'Kategori bawaan & kustom' },
  { href: '/anggaran', icon: PieChart, label: 'Budget', desc: 'Batas pengeluaran per kategori' },
  { href: '/target', icon: Target, label: 'Target Keuangan', desc: 'Tabungan & rencana besar' },
  { href: '/hutang', icon: PiggyBank, label: 'Hutang & Piutang', desc: 'Pengingat jatuh tempo' },
  { href: '/rutin', icon: Repeat, label: 'Transaksi Rutin', desc: 'Gaji, tagihan, langganan' },
  { href: '/ai', icon: Sparkles, label: 'AI Keuangan', desc: 'Tanya jawab berbasis data Anda' },
  { href: '/notifikasi', icon: ShieldCheck, label: 'Notifikasi & Pengingat', desc: 'Ringkasan yang perlu perhatian' },
];

export default function ProfilPage() {
  const store = useStore();
  const router = useRouter();
  const { toast } = useToast();
  const [dark, setDark] = useState(false);
  const [confirmReset, setConfirmReset] = useState<'demo' | 'clear' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('catatin:theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = (next: boolean) => {
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('catatin:theme', next ? 'dark' : 'light');
  };

  if (!store.ready) return <LoadingScreen />;

  const balance = totalBalance(store.wallets, store.transactions);

  return (
    <div className="pb-8">
      <PageHeader title="Profil" />

      <div className="space-y-5 px-4 pt-4">
        <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-[22px] font-bold text-primary-foreground">
            {(store.profile?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">{store.profile?.name}</p>
            <p className="truncate text-[12px] text-muted-foreground">
              {store.profile?.email || 'Mode demo lokal (data tersimpan di browser ini)'}
            </p>
            <Badge tone={store.mode === 'supabase' ? 'success' : 'warning'} className="mt-1.5">
              {store.mode === 'supabase' ? 'Tersinkron Supabase' : 'Mode Demo'}
            </Badge>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2.5">
          <SummaryTile label="Saldo" value={formatIDR(balance, { compact: true })} />
          <SummaryTile label="Transaksi" value={String(store.transactions.length)} />
          <SummaryTile label="Dompet" value={String(store.wallets.filter((w) => !w.archived).length)} />
        </section>

        <section>
          <SectionTitle title="Pengaturan keuangan" />
          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {MENU.map((m, i) => (
              <li key={m.href} className={i > 0 ? 'border-t border-border' : ''}>
                <Link href={m.href} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-secondary">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <m.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold">{m.label}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{m.desc}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle title="Tampilan" />
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
              {dark ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold">Mode gelap</p>
              <p className="text-[11.5px] text-muted-foreground">Nyaman dipakai malam hari</p>
            </div>
            <Switch checked={dark} onCheckedChange={toggleTheme} />
          </div>
        </section>

        <section>
          <SectionTitle title="Data" />
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={async () => {
                try {
                  await exportExcel(toExportRows(store.transactions, store.wallets), 'catatin-semua-transaksi');
                  toast('Semua transaksi diekspor ke Excel.', 'success');
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Ekspor gagal.', 'error');
                }
              }}
            >
              <Download className="h-4 w-4" /> Ekspor semua transaksi (Excel)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                try {
                  exportCSV(toExportRows(store.transactions, store.wallets), 'catatin-semua-transaksi');
                  toast('Semua transaksi diekspor ke CSV.', 'success');
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Ekspor gagal.', 'error');
                }
              }}
            >
              <Download className="h-4 w-4" /> Ekspor semua transaksi (CSV)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              loading={busy}
              onClick={() => setConfirmReset('demo')}
            >
              <RefreshCw className="h-4 w-4" /> Muat ulang data demo
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-destructive"
              onClick={() => setConfirmReset('clear')}
            >
              <Trash2 className="h-4 w-4" /> Hapus semua transaksi
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold">
            <Database className="h-4 w-4 text-primary" /> Status koneksi
          </p>
          <dl className="mt-2 space-y-1.5 text-[12.5px]">
            <StatusRow
              label="Database"
              value={store.mode === 'supabase' ? 'Supabase PostgreSQL (RLS aktif)' : 'Penyimpanan lokal browser'}
              ok={store.mode === 'supabase'}
            />
            <StatusRow
              label="Autentikasi"
              value={store.mode === 'supabase' ? 'Supabase Auth' : 'Belum dikonfigurasi'}
              ok={store.mode === 'supabase'}
            />
          </dl>
          {store.mode === 'demo' && (
            <p className="mt-2.5 text-[11.5px] text-muted-foreground">
              Isi <code className="rounded bg-secondary px-1">NEXT_PUBLIC_SUPABASE_URL</code> dan{' '}
              <code className="rounded bg-secondary px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di{' '}
              <code className="rounded bg-secondary px-1">.env.local</code> untuk mengaktifkan login & sinkronisasi.
            </p>
          )}
        </section>

        <Button
          variant="ghost"
          className="w-full text-destructive"
          onClick={async () => {
            await store.signOut();
            if (store.mode === 'supabase') router.replace('/masuk');
          }}
        >
          <LogOut className="h-4 w-4" /> {store.mode === 'supabase' ? 'Keluar' : 'Reset sesi demo'}
        </Button>

        <p className="pb-4 text-center text-[11px] text-muted-foreground">CATATIN v1.0 · Dibuat untuk Indonesia 🇮🇩</p>
      </div>

      <ConfirmDialog
        open={!!confirmReset}
        title={confirmReset === 'demo' ? 'Muat ulang data demo?' : 'Hapus semua transaksi?'}
        description={
          confirmReset === 'demo'
            ? 'Semua transaksi, budget, target, hutang, dan aturan rutin saat ini akan diganti dengan data demo.'
            : 'Semua transaksi, budget, target, hutang, dan aturan rutin akan dihapus. Dompet & kategori tetap ada.'
        }
        confirmLabel={confirmReset === 'demo' ? 'Muat ulang' : 'Hapus'}
        onCancel={() => setConfirmReset(null)}
        onConfirm={async () => {
          const mode = confirmReset;
          setConfirmReset(null);
          setBusy(true);
          try {
            await store.resetData(mode === 'demo');
            toast(mode === 'demo' ? 'Data demo dimuat ulang.' : 'Semua transaksi dihapus.', 'success');
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Gagal memproses.', 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="tnum text-[15px] font-extrabold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right font-medium">
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-warning'}`} />
        {value}
      </dd>
    </div>
  );
}
