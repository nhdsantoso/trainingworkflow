'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Copy, Trash2, Paperclip, ImageUp, ExternalLink } from 'lucide-react';
import { PageHeader, LoadingScreen } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Badge, ConfirmDialog, EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import { categoryMeta } from '@/lib/defaults';
import { formatDateLong, formatIDR } from '@/lib/format';
import { preprocessImage } from '@/lib/image';

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const store = useStore();
  const router = useRouter();
  const { toast } = useToast();
  const [receipt, setReceipt] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);

  const tx = store.transactions.find((t) => t.id === id);

  useEffect(() => {
    if (!tx?.receipt_image) {
      setReceipt(null);
      return;
    }
    let cancelled = false;
    void store.receiptUrl(tx.receipt_image).then((url) => {
      if (!cancelled) setReceipt(url);
    });
    return () => {
      cancelled = true;
    };
  }, [tx?.receipt_image, store]);

  if (!store.ready) return <LoadingScreen />;

  if (!tx) {
    return (
      <div>
        <PageHeader title="Transaksi" back="/transaksi" />
        <div className="px-4 pt-8">
          <EmptyState
            icon="🧾"
            title="Transaksi tidak ditemukan"
            description="Mungkin sudah dihapus."
            action={<Button onClick={() => router.push('/transaksi')}>Kembali ke daftar</Button>}
          />
        </div>
      </div>
    );
  }

  const meta = categoryMeta(tx.category);
  const wallet = store.wallets.find((w) => w.id === tx.wallet);
  const toWallet = store.wallets.find((w) => w.id === tx.to_wallet);
  const itemsTotal = tx.items.reduce((a, i) => a + (i.price || 0) * (i.qty || 1), 0);

  const attachReceipt = async (file: File) => {
    setUploading(true);
    try {
      const processed = await preprocessImage(file, { maxDimension: 1600, quality: 0.86 });
      const ref = await store.uploadReceipt(processed.blob, file.name);
      await store.updateTransaction(tx.id, { receipt_image: ref });
      toast('Struk berhasil dilampirkan.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal melampirkan struk.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pb-8">
      <PageHeader title="Detail Transaksi" back="/transaksi" />

      <div className="space-y-4 px-4 pt-4">
        <section className="rounded-2xl border border-border bg-card p-5 text-center">
          <div
            className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl text-[30px]"
            style={{ background: `${meta.color}1F` }}
            aria-hidden
          >
            {meta.emoji}
          </div>
          <p className="text-[15px] font-bold">{tx.merchant}</p>
          <p
            className={`tnum mt-1 text-[28px] font-extrabold ${
              tx.type === 'income' ? 'text-[color:var(--viz-income)]' : 'text-foreground'
            }`}
          >
            {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}
            {formatIDR(tx.amount)}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Badge tone="primary">{tx.category}</Badge>
            <Badge>
              {tx.type === 'income' ? 'Pemasukan' : tx.type === 'transfer' ? 'Transfer' : 'Pengeluaran'}
            </Badge>
            {tx.payment_method && <Badge tone="muted">{tx.payment_method}</Badge>}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <dl className="divide-y divide-border text-[13.5px]">
            <Row label="Tanggal" value={`${formatDateLong(tx.date)}${tx.time ? ` · ${tx.time}` : ''}`} />
            <Row label="Kategori" value={`${meta.emoji} ${tx.category}`} />
            <Row
              label={tx.type === 'transfer' ? 'Dari dompet' : 'Dompet'}
              value={wallet ? `${wallet.emoji} ${wallet.name}` : '—'}
            />
            {tx.type === 'transfer' && (
              <Row label="Ke dompet" value={toWallet ? `${toWallet.emoji} ${toWallet.name}` : '—'} />
            )}
            {tx.payment_method && <Row label="Metode bayar" value={String(tx.payment_method)} />}
            {tx.reference_number && <Row label="No. referensi" value={tx.reference_number} mono />}
            {tx.notes && <Row label="Catatan" value={tx.notes} />}
          </dl>
        </section>

        {tx.items.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-[14px] font-bold">Item pembelian</h2>
            <ul className="divide-y divide-border text-[13px]">
              {tx.items.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">
                    {item.qty && item.qty > 1 && <span className="text-muted-foreground">{item.qty}× </span>}
                    {item.name}
                  </span>
                  <span className="tnum shrink-0 font-semibold">{formatIDR((item.price || 0) * (item.qty || 1))}</span>
                </li>
              ))}
            </ul>
            {itemsTotal > 0 && (
              <p className="mt-2 flex justify-between text-[13px] font-bold">
                <span>Total item</span>
                <span className="tnum">{formatIDR(itemsTotal)}</span>
              </p>
            )}
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-bold">
            <Paperclip className="h-4 w-4" /> Bukti transaksi
          </h2>
          {receipt ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receipt}
                alt={`Struk ${tx.merchant}`}
                className="max-h-80 w-full rounded-lg border border-border bg-secondary object-contain"
              />
              <a
                href={receipt}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Buka ukuran penuh
              </a>
            </div>
          ) : (
            <div>
              <p className="mb-2.5 text-[12.5px] text-muted-foreground">
                {tx.receipt_image ? 'Memuat struk…' : 'Belum ada bukti untuk transaksi ini.'}
              </p>
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void attachReceipt(f);
                    e.target.value = '';
                  }}
                />
                <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-[13px] font-semibold hover:bg-secondary">
                  <ImageUp className="h-4 w-4" /> {uploading ? 'Mengunggah…' : 'Lampirkan struk'}
                </span>
              </label>
            </div>
          )}
        </section>

        <section className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => router.push(`/tambah?id=${tx.id}`)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const copy = await store.duplicateTransaction(tx.id);
              if (copy) {
                toast('Transaksi diduplikasi ke hari ini.', 'success');
                router.replace(`/transaksi/${copy.id}`);
              }
            }}
          >
            <Copy className="h-4 w-4" /> Duplikat
          </Button>
          <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Hapus
          </Button>
        </section>

        <p className="text-center text-[11px] text-muted-foreground">
          Dibuat {new Date(tx.created_at).toLocaleString('id-ID')}
        </p>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus transaksi?"
        description={`${tx.merchant} · ${formatIDR(tx.amount)} akan dihapus permanen.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await store.deleteTransaction(tx.id);
          setConfirmDelete(false);
          toast('Transaksi dihapus.', 'success');
          router.replace('/transaksi');
        }}
      />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`text-right font-semibold ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</dd>
    </div>
  );
}
