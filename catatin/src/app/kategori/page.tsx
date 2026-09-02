'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, LoadingScreen, SectionTitle } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Sheet, ConfirmDialog, Badge } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import { CATEGORY_EMOJI_CHOICES } from '@/lib/defaults';
import { formatIDR, currentPeriod, periodOf } from '@/lib/format';
import type { Category } from '@/lib/types';

const COLORS = ['#F97316', '#0EA5E9', '#EC4899', '#8B5CF6', '#14B8A6', '#EF4444', '#3B82F6', '#A855F7', '#06B6D4', '#F59E0B', '#10B981', '#22C55E', '#16A34A', '#0D9488', '#64748B'];

export default function KategoriPage() {
  const store = useStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const period = currentPeriod();
  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of store.transactions.filter((t) => periodOf(t.date) === period)) {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    }
    return map;
  }, [store.transactions, period]);

  const expense = store.categories.filter((c) => c.type !== 'income');
  const income = store.categories.filter((c) => c.type !== 'expense');

  if (!store.ready) return <LoadingScreen />;

  const renderList = (list: Category[]) => (
    <ul className="space-y-2">
      {list.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => { setEditing(c); setOpen(true); }}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[18px]"
              style={{ background: `${c.color}1F` }}
            >
              {c.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold">{c.name}</p>
              <p className="text-[11.5px] text-muted-foreground">
                {usage.get(c.name) ? `${formatIDR(usage.get(c.name)!)} bulan ini` : 'Belum terpakai bulan ini'}
              </p>
            </div>
            {!c.is_default && <Badge tone="primary">Kustom</Badge>}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="pb-8">
      <PageHeader
        title="Kategori"
        subtitle={`${store.categories.length} kategori`}
        back="/profil"
        action={
          <Button variant="ghost" size="icon" aria-label="Tambah kategori" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="space-y-5 px-4 pt-4">
        <div className="rounded-xl bg-secondary p-3 text-[12px] text-muted-foreground">
          AI merekomendasikan kategori otomatis berdasarkan nama merchant dan riwayat transaksi Anda. Kategori
          kustom yang Anda buat ikut dipakai AI saat memindai struk.
        </div>
        <section>
          <SectionTitle title="Kategori pengeluaran" />
          {renderList(expense)}
        </section>
        <section>
          <SectionTitle title="Kategori pemasukan" />
          {renderList(income)}
        </section>
      </div>

      <CategorySheet
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        onDelete={(c) => {
          setOpen(false);
          setDeleteTarget(c);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus kategori?"
        description={
          deleteTarget && store.transactions.some((t) => t.category === deleteTarget.name)
            ? 'Kategori ini masih dipakai transaksi. Transaksi lama tetap menyimpan nama kategorinya.'
            : 'Kategori ini akan dihapus.'
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await store.deleteCategory(deleteTarget.id);
          setDeleteTarget(null);
          toast('Kategori dihapus.', 'success');
        }}
      />
    </div>
  );
}

function CategorySheet({
  open,
  onClose,
  editing,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  editing: Category | null;
  onDelete: (c: Category) => void;
}) {
  const store = useStore();
  const { toast } = useToast();
  const [wasOpen, setWasOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📦');
  const [type, setType] = useState<Category['type']>('expense');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setName(editing?.name || '');
    setEmoji(editing?.emoji || '📦');
    setType(editing?.type || 'expense');
    setColor(editing?.color || COLORS[0]);
  }
  if (!open && wasOpen) setWasOpen(false);

  const save = async () => {
    if (!name.trim()) return toast('Nama kategori belum diisi.', 'error');
    const duplicate = store.categories.some(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase() && c.id !== editing?.id,
    );
    if (duplicate) return toast('Nama kategori sudah dipakai.', 'error');
    setSaving(true);
    try {
      const payload = { name: name.trim(), emoji, type, color };
      if (editing) await store.updateCategory(editing.id, payload);
      else await store.addCategory(payload);
      toast(editing ? 'Kategori diperbarui.' : 'Kategori ditambahkan.', 'success');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan kategori.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah Kategori' : 'Kategori Baru'}
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
          <Label htmlFor="c-name">Nama kategori</Label>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Kopi" />
        </div>

        <div>
          <Label>Ikon</Label>
          <div className="grid grid-cols-8 gap-1.5">
            {CATEGORY_EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-label={`Pilih ikon ${e}`}
                className={`flex h-10 items-center justify-center rounded-lg text-[18px] transition-colors ${
                  emoji === e ? 'bg-primary/15 ring-2 ring-primary' : 'bg-secondary hover:bg-muted'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Warna</Label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Pilih warna ${c}`}
                className={`h-8 w-8 rounded-full transition-transform ${color === c ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="c-type">Berlaku untuk</Label>
          <Select id="c-type" value={type} onChange={(e) => setType(e.target.value as Category['type'])}>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
            <option value="both">Keduanya</option>
          </Select>
        </div>

        {editing && (
          <div className="border-t border-border pt-3">
            <Button variant="ghost" className="w-full text-destructive" onClick={() => onDelete(editing)}>
              Hapus kategori
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
