'use client';

import { useState } from 'react';
import { Plus, Zap, Bell } from 'lucide-react';
import { PageHeader, LoadingScreen } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Sheet, EmptyState, ConfirmDialog, Badge, Switch } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import { formatAmountInput, formatIDR, parseIDR } from '@/lib/format';
import type { Recurring, RecurringFrequency } from '@/lib/types';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function RutinPage() {
  const store = useStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!store.ready) return <LoadingScreen />;

  return (
    <div className="pb-8">
      <PageHeader
        title="Transaksi Rutin"
        subtitle="Gaji, tagihan, cicilan, langganan"
        back="/profil"
        action={
          <Button variant="ghost" size="icon" aria-label="Tambah" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="space-y-3 px-4 pt-4">
        <div className="rounded-xl bg-secondary p-3 text-[12px] text-muted-foreground">
          Aturan dengan <span className="font-semibold text-foreground">Buat otomatis</span> aktif akan langsung
          menjadi transaksi saat tanggalnya tiba (dicek setiap Anda membuka aplikasi). Yang tidak aktif hanya
          tampil sebagai pengingat.
        </div>

        {store.recurring.length === 0 ? (
          <EmptyState
            icon="🔁"
            title="Belum ada transaksi rutin"
            description="Tambahkan gaji, listrik, internet, cicilan, atau langganan agar tidak perlu dicatat manual tiap bulan."
            action={<Button onClick={() => { setEditing(null); setOpen(true); }}>Tambah aturan</Button>}
          />
        ) : (
          store.recurring.map((r) => (
            <article key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold">{r.name}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {scheduleLabel(r)} · {r.category}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`tnum text-[15px] font-extrabold ${
                      r.type === 'income' ? 'text-[color:var(--viz-income)]' : 'text-foreground'
                    }`}
                  >
                    {r.type === 'income' ? '+' : '−'}
                    {formatIDR(r.amount)}
                  </p>
                  <Badge tone={r.auto_create ? 'success' : 'muted'} className="mt-1">
                    {r.auto_create ? (
                      <>
                        <Zap className="h-3 w-3" /> Otomatis
                      </>
                    ) : (
                      <>
                        <Bell className="h-3 w-3" /> Pengingat
                      </>
                    )}
                  </Badge>
                </div>
              </div>

              {r.last_run && (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">Terakhir dibuat: {r.last_run}</p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <div className="flex items-center gap-2 pr-2">
                  <Switch
                    checked={r.active}
                    onCheckedChange={async (v) => {
                      await store.updateRecurring(r.id, { active: v });
                      toast(v ? 'Aturan diaktifkan.' : 'Aturan dinonaktifkan.', 'success');
                    }}
                  />
                  <span className="text-[12px] text-muted-foreground">{r.active ? 'Aktif' : 'Nonaktif'}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={async () => {
                    await store.runRecurringNow(r.id);
                    toast(`Transaksi "${r.name}" dibuat untuk hari ini.`, 'success');
                  }}
                >
                  Catat sekarang
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEditing(r); setOpen(true); }}>
                  Ubah
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(r.id)}>
                  Hapus
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <RecurringSheet open={open} onClose={() => setOpen(false)} editing={editing} />

      <ConfirmDialog
        open={!!deleteId}
        title="Hapus aturan rutin?"
        description="Transaksi yang sudah terlanjur dibuat tidak ikut terhapus."
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await store.deleteRecurring(deleteId);
          setDeleteId(null);
          toast('Aturan dihapus.', 'success');
        }}
      />
    </div>
  );
}

function scheduleLabel(r: Recurring): string {
  if (r.frequency === 'weekly') return `Setiap ${HARI[r.day_of_week] || 'Senin'}`;
  if (r.frequency === 'yearly') return `Setiap ${r.day_of_month} ${BULAN[(r.month_of_year || 1) - 1]}`;
  return `Setiap tanggal ${r.day_of_month}`;
}

function RecurringSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Recurring | null;
}) {
  const store = useStore();
  const { toast } = useToast();
  const [wasOpen, setWasOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [wallet, setWallet] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [monthOfYear, setMonthOfYear] = useState(1);
  const [auto, setAuto] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setName(editing?.name || '');
    setType(editing?.type || 'expense');
    setAmount(editing ? formatAmountInput(String(editing.amount)) : '');
    setCategory(editing?.category || store.categories.find((c) => c.name === 'Tagihan')?.name || 'Lainnya');
    setWallet(editing?.wallet || store.wallets.find((w) => !w.archived)?.id || 'cash');
    setFrequency(editing?.frequency || 'monthly');
    setDayOfMonth(editing?.day_of_month || 1);
    setDayOfWeek(editing?.day_of_week ?? 1);
    setMonthOfYear(editing?.month_of_year || 1);
    setAuto(editing?.auto_create ?? false);
    setNotes(editing?.notes || '');
  }
  if (!open && wasOpen) setWasOpen(false);

  const save = async () => {
    if (!name.trim()) return toast('Nama aturan belum diisi.', 'error');
    const value = parseIDR(amount);
    if (value <= 0) return toast('Nominal harus lebih dari 0.', 'error');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        amount: value,
        category,
        wallet,
        frequency,
        day_of_month: Math.min(31, Math.max(1, dayOfMonth)),
        day_of_week: dayOfWeek,
        month_of_year: monthOfYear,
        payment_method: null,
        auto_create: auto,
        active: editing?.active ?? true,
        last_run: editing?.last_run ?? null,
        notes: notes.trim() || null,
      };
      if (editing) await store.updateRecurring(editing.id, payload);
      else await store.addRecurring(payload);
      toast(editing ? 'Aturan diperbarui.' : 'Aturan ditambahkan.', 'success');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah Aturan Rutin' : 'Aturan Rutin Baru'}
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
          <Label htmlFor="r-name">Nama</Label>
          <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="r-type">Jenis</Label>
            <Select id="r-type" value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="r-amount">Nominal</Label>
            <Input
              id="r-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              placeholder="186.000"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="r-cat">Kategori</Label>
            <Select id="r-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {store.categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="r-wallet">Dompet</Label>
            <Select id="r-wallet" value={wallet} onChange={(e) => setWallet(e.target.value)}>
              {store.wallets.filter((w) => !w.archived).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.emoji} {w.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="r-freq">Frekuensi</Label>
          <Select
            id="r-freq"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
          >
            <option value="monthly">Setiap bulan</option>
            <option value="weekly">Setiap minggu</option>
            <option value="yearly">Setiap tahun</option>
          </Select>
        </div>

        {frequency === 'weekly' ? (
          <div>
            <Label htmlFor="r-dow">Hari</Label>
            <Select id="r-dow" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {HARI.map((h, i) => (
                <option key={h} value={i}>
                  {h}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="r-dom">Tanggal</Label>
              <Input
                id="r-dom"
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
              />
            </div>
            {frequency === 'yearly' && (
              <div>
                <Label htmlFor="r-moy">Bulan</Label>
                <Select id="r-moy" value={monthOfYear} onChange={(e) => setMonthOfYear(Number(e.target.value))}>
                  {BULAN.map((b, i) => (
                    <option key={b} value={i + 1}>
                      {b}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="pr-3">
            <p className="text-[13px] font-semibold">Buat transaksi otomatis</p>
            <p className="text-[11.5px] text-muted-foreground">
              Kalau nonaktif, aturan ini hanya jadi pengingat.
            </p>
          </div>
          <Switch checked={auto} onCheckedChange={setAuto} />
        </div>

        <div>
          <Label htmlFor="r-notes">Catatan</Label>
          <Textarea id="r-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}
