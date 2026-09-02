'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeftRight } from 'lucide-react';
import { PageHeader, LoadingScreen, SectionTitle } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Sheet, ConfirmDialog, Badge } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import { walletBalances } from '@/lib/analytics';
import { formatAmountInput, formatIDR, parseIDR } from '@/lib/format';
import type { Wallet, WalletKind } from '@/lib/types';

const KIND_LABEL: Record<WalletKind, string> = {
  cash: 'Tunai',
  bank: 'Rekening Bank',
  ewallet: 'E-Wallet',
  credit: 'Kartu Kredit',
  investment: 'Investasi',
};

const EMOJI_CHOICES = ['💵', '🏦', '💳', '📈', '🟢', '🟣', '🔵', '🟠', '🪙', '🏧'];

export default function DompetPage() {
  const store = useStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Wallet | null>(null);

  const balances = useMemo(
    () => walletBalances(store.wallets, store.transactions),
    [store.wallets, store.transactions],
  );

  const active = store.wallets.filter((w) => !w.archived);
  const archived = store.wallets.filter((w) => w.archived);
  const total = active.reduce((a, w) => a + (balances[w.id] || 0), 0);

  if (!store.ready) return <LoadingScreen />;

  return (
    <div className="pb-8">
      <PageHeader
        title="Dompet & Akun"
        back="/profil"
        action={
          <Button variant="ghost" size="icon" aria-label="Tambah dompet" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="text-[12px] opacity-90">Total saldo semua dompet</p>
          <p className="tnum mt-1 text-[26px] font-extrabold">{formatIDR(total)}</p>
        </div>

        <div className="rounded-xl bg-secondary p-3 text-[12px] text-muted-foreground">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <ArrowLeftRight className="h-3.5 w-3.5" /> Transfer antar dompet
          </p>
          <p className="mt-1">
            Transfer antar dompet tidak dihitung sebagai pemasukan maupun pengeluaran.{' '}
            <Link href="/tambah?mode=manual" className="font-semibold text-primary hover:underline">
              Catat transfer
            </Link>
          </p>
        </div>

        <section>
          <SectionTitle title={`Dompet aktif (${active.length})`} />
          <ul className="space-y-2">
            {active.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => { setEditing(w); setOpen(true); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-secondary"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-[19px]">
                    {w.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{w.name}</p>
                    <p className="text-[11.5px] text-muted-foreground">{KIND_LABEL[w.kind]}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`tnum text-[14.5px] font-bold ${
                        (balances[w.id] || 0) < 0 ? 'text-destructive' : ''
                      }`}
                    >
                      {formatIDR(balances[w.id] || 0)}
                    </p>
                    <Link
                      href={`/transaksi?dompet=${w.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Lihat transaksi
                    </Link>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {archived.length > 0 && (
          <section>
            <SectionTitle title={`Diarsipkan (${archived.length})`} />
            <ul className="space-y-2">
              {archived.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 opacity-70"
                >
                  <span className="text-[17px]">{w.emoji}</span>
                  <span className="flex-1 truncate text-[13.5px]">{w.name}</span>
                  <Badge tone="muted">Arsip</Badge>
                  <Button variant="ghost" size="sm" onClick={() => store.updateWallet(w.id, { archived: false })}>
                    Aktifkan
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <WalletSheet
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        onDelete={(w) => {
          setOpen(false);
          setDeleteTarget(w);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus dompet?"
        description={
          deleteTarget && store.transactions.some((t) => t.wallet === deleteTarget.id || t.to_wallet === deleteTarget.id)
            ? 'Dompet ini masih dipakai transaksi. Sebaiknya arsipkan saja agar riwayat tetap utuh.'
            : 'Dompet ini akan dihapus permanen.'
        }
        confirmLabel="Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const used = store.transactions.some(
            (t) => t.wallet === deleteTarget.id || t.to_wallet === deleteTarget.id,
          );
          if (used) {
            await store.updateWallet(deleteTarget.id, { archived: true });
            toast('Dompet diarsipkan karena masih dipakai transaksi.', 'warning');
          } else {
            await store.deleteWallet(deleteTarget.id);
            toast('Dompet dihapus.', 'success');
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function WalletSheet({
  open,
  onClose,
  editing,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  editing: Wallet | null;
  onDelete: (w: Wallet) => void;
}) {
  const store = useStore();
  const { toast } = useToast();
  const [wasOpen, setWasOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WalletKind>('bank');
  const [emoji, setEmoji] = useState('🏦');
  const [initial, setInitial] = useState('');
  const [saving, setSaving] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setName(editing?.name || '');
    setKind(editing?.kind || 'bank');
    setEmoji(editing?.emoji || '🏦');
    setInitial(editing ? formatAmountInput(String(editing.initial_balance)) : '');
  }
  if (!open && wasOpen) setWasOpen(false);

  const save = async () => {
    if (!name.trim()) return toast('Nama dompet belum diisi.', 'error');
    setSaving(true);
    try {
      const payload = { name: name.trim(), kind, emoji, initial_balance: parseIDR(initial) };
      if (editing) await store.updateWallet(editing.id, payload);
      else await store.addWallet(payload);
      toast(editing ? 'Dompet diperbarui.' : 'Dompet ditambahkan.', 'success');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan dompet.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah Dompet' : 'Dompet Baru'}
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
          <Label htmlFor="w-name">Nama dompet</Label>
          <div className="flex gap-2">
            <Select
              aria-label="Ikon dompet"
              className="w-20 shrink-0 text-center"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
            >
              {EMOJI_CHOICES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
            <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="BCA" />
          </div>
        </div>
        <div>
          <Label htmlFor="w-kind">Jenis</Label>
          <Select id="w-kind" value={kind} onChange={(e) => setKind(e.target.value as WalletKind)}>
            {(Object.keys(KIND_LABEL) as WalletKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="w-initial">Saldo awal</Label>
          <Input
            id="w-initial"
            inputMode="numeric"
            value={initial}
            onChange={(e) => setInitial(formatAmountInput(e.target.value))}
            placeholder="0"
          />
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Saldo sebelum transaksi dicatat di CATATIN. Saldo berjalan dihitung otomatis dari transaksi.
          </p>
        </div>

        {editing && (
          <div className="flex gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={async () => {
                await store.updateWallet(editing.id, { archived: !editing.archived });
                toast(editing.archived ? 'Dompet diaktifkan.' : 'Dompet diarsipkan.', 'success');
                onClose();
              }}
            >
              {editing.archived ? 'Aktifkan' : 'Arsipkan'}
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => onDelete(editing)}>
              Hapus
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
