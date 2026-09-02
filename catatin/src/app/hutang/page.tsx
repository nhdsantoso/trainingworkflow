'use client';

import { useMemo, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { PageHeader, LoadingScreen } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Sheet, EmptyState, ConfirmDialog, Badge, Progress } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import { formatAmountInput, formatDateShort, formatIDR, parseIDR, todayISO, toDate } from '@/lib/format';
import type { Debt, DebtKind } from '@/lib/types';

export default function HutangPage() {
  const store = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<DebtKind>('debt');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      store.debts
        .filter((d) => d.kind === tab)
        .sort((a, b) => (a.status === b.status ? (a.due_date < b.due_date ? -1 : 1) : a.status === 'open' ? -1 : 1)),
    [store.debts, tab],
  );

  const openTotal = rows.filter((d) => d.status === 'open').reduce((a, d) => a + (d.amount - d.paid_amount), 0);

  if (!store.ready) return <LoadingScreen />;

  return (
    <div className="pb-8">
      <PageHeader
        title="Hutang & Piutang"
        back="/profil"
        action={
          <Button variant="ghost" size="icon" aria-label="Tambah" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-secondary p-1">
          {(['debt', 'receivable'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg py-2 text-[13px] font-semibold transition-colors ${
                tab === k ? 'bg-card shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {k === 'debt' ? '📤 Hutang saya' : '📥 Piutang saya'}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[12px] text-muted-foreground">
            {tab === 'debt' ? 'Total hutang belum lunas' : 'Total piutang belum tertagih'}
          </p>
          <p className={`tnum mt-0.5 text-[22px] font-extrabold ${tab === 'debt' ? 'text-destructive' : 'text-success'}`}>
            {formatIDR(openTotal)}
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={tab === 'debt' ? '📤' : '📥'}
            title={tab === 'debt' ? 'Tidak ada hutang' : 'Tidak ada piutang'}
            description="Catat pinjaman agar tidak lupa jatuh temponya."
            action={<Button onClick={() => { setEditing(null); setOpen(true); }}>Tambah catatan</Button>}
          />
        ) : (
          <ul className="space-y-2.5">
            {rows.map((d) => {
              const remaining = d.amount - d.paid_amount;
              const days = daysUntil(d.due_date);
              const overdue = d.status === 'open' && days < 0;
              const soon = d.status === 'open' && days >= 0 && days <= 7;
              return (
                <li key={d.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold">{d.person}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Dicatat {formatDateShort(d.date)} · Jatuh tempo {formatDateShort(d.due_date)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-[15px] font-extrabold">{formatIDR(remaining)}</p>
                      {d.status === 'paid' ? (
                        <Badge tone="success">Lunas</Badge>
                      ) : overdue ? (
                        <Badge tone="danger">Lewat {Math.abs(days)} hari</Badge>
                      ) : soon ? (
                        <Badge tone="warning">{days} hari lagi</Badge>
                      ) : (
                        <Badge tone="muted">{days} hari lagi</Badge>
                      )}
                    </div>
                  </div>

                  {d.paid_amount > 0 && d.status === 'open' && (
                    <div className="mt-2.5">
                      <Progress value={(d.paid_amount / d.amount) * 100} />
                      <p className="mt-1 text-[11.5px] text-muted-foreground">
                        Sudah dibayar {formatIDR(d.paid_amount)} dari {formatIDR(d.amount)}
                      </p>
                    </div>
                  )}

                  {d.notes && <p className="mt-2 text-[12px] text-muted-foreground">{d.notes}</p>}

                  <div className="mt-3 flex gap-2">
                    {d.status === 'open' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={async () => {
                          await store.updateDebt(d.id, { status: 'paid', paid_amount: d.amount });
                          toast('Ditandai lunas.', 'success');
                        }}
                      >
                        <Check className="h-4 w-4" /> Tandai lunas
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(d); setOpen(true); }}>
                      Ubah
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(d.id)}>
                      Hapus
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DebtSheet open={open} onClose={() => setOpen(false)} editing={editing} defaultKind={tab} />

      <ConfirmDialog
        open={!!deleteId}
        title="Hapus catatan?"
        description="Catatan hutang/piutang ini akan dihapus permanen."
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await store.deleteDebt(deleteId);
          setDeleteId(null);
          toast('Catatan dihapus.', 'success');
        }}
      />
    </div>
  );
}

function DebtSheet({
  open,
  onClose,
  editing,
  defaultKind,
}: {
  open: boolean;
  onClose: () => void;
  editing: Debt | null;
  defaultKind: DebtKind;
}) {
  const store = useStore();
  const { toast } = useToast();
  const [wasOpen, setWasOpen] = useState(false);
  const [kind, setKind] = useState<DebtKind>(defaultKind);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState('');
  const [date, setDate] = useState(todayISO());
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setKind(editing?.kind || defaultKind);
    setPerson(editing?.person || '');
    setAmount(editing ? formatAmountInput(String(editing.amount)) : '');
    setPaid(editing ? formatAmountInput(String(editing.paid_amount)) : '');
    setDate(editing?.date || todayISO());
    setDue(editing?.due_date || todayISO());
    setNotes(editing?.notes || '');
  }
  if (!open && wasOpen) setWasOpen(false);

  const save = async () => {
    if (!person.trim()) return toast('Nama pihak belum diisi.', 'error');
    const value = parseIDR(amount);
    if (value <= 0) return toast('Nominal harus lebih dari 0.', 'error');
    setSaving(true);
    try {
      const paidValue = Math.min(parseIDR(paid), value);
      const payload = {
        kind,
        person: person.trim(),
        amount: value,
        paid_amount: paidValue,
        date,
        due_date: due || date,
        status: (paidValue >= value ? 'paid' : 'open') as Debt['status'],
        notes: notes.trim() || null,
      };
      if (editing) await store.updateDebt(editing.id, payload);
      else await store.addDebt(payload);
      toast(editing ? 'Catatan diperbarui.' : 'Catatan ditambahkan.', 'success');
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
      title={editing ? 'Ubah Catatan' : 'Catatan Baru'}
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
          <Label htmlFor="d-kind">Jenis</Label>
          <Select id="d-kind" value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
            <option value="debt">📤 Hutang (saya meminjam)</option>
            <option value="receivable">📥 Piutang (saya meminjamkan)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="d-person">Nama pihak</Label>
          <Input id="d-person" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Contoh: Rizky" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="d-amount">Nominal</Label>
            <Input
              id="d-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              placeholder="1.500.000"
            />
          </div>
          <div>
            <Label htmlFor="d-paid">Sudah dibayar</Label>
            <Input
              id="d-paid"
              inputMode="numeric"
              value={paid}
              onChange={(e) => setPaid(formatAmountInput(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="d-date">Tanggal</Label>
            <Input id="d-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="d-due">Jatuh tempo</Label>
            <Input id="d-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="d-notes">Catatan</Label>
          <Textarea id="d-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}

function daysUntil(dateStr: string): number {
  const target = toDate(dateStr).getTime();
  const now = toDate(todayISO()).getTime();
  return Math.round((target - now) / 86_400_000);
}
