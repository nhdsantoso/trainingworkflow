'use client';

import { useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { PageHeader, LoadingScreen } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Progress, Sheet, EmptyState, ConfirmDialog, Badge } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import { formatAmountInput, formatDateLong, formatIDR, parseIDR, todayISO, toDate } from '@/lib/format';
import { CATEGORY_EMOJI_CHOICES } from '@/lib/defaults';
import type { Goal } from '@/lib/types';

export default function TargetPage() {
  const store = useStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!store.ready) return <LoadingScreen />;

  return (
    <div className="pb-8">
      <PageHeader
        title="Target Keuangan"
        subtitle={`${store.goals.length} target aktif`}
        back="/profil"
        action={
          <Button variant="ghost" size="icon" aria-label="Tambah target" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <div className="space-y-3 px-4 pt-4">
        {store.goals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="Belum ada target"
            description="Buat target seperti liburan, dana darurat, atau DP rumah. AI akan menghitung setoran bulanan yang dibutuhkan."
            action={<Button onClick={() => { setEditing(null); setOpen(true); }}>Buat target</Button>}
          />
        ) : (
          store.goals.map((g) => {
            const ratio = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
            const monthsLeft = monthsUntil(g.target_date);
            const remaining = Math.max(0, g.target_amount - g.current_amount);
            const perMonth = monthsLeft > 0 ? remaining / monthsLeft : remaining;
            const done = ratio >= 100;

            return (
              <article key={g.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-[20px]">
                    {g.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14.5px] font-bold leading-tight">{g.name}</p>
                      {done && <Badge tone="success">Tercapai 🎉</Badge>}
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Target {formatDateLong(g.target_date)}
                      {monthsLeft > 0 && ` · ${monthsLeft} bulan lagi`}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-baseline justify-between text-[13px]">
                    <span className="tnum font-bold">{formatIDR(g.current_amount)}</span>
                    <span className="tnum text-muted-foreground">dari {formatIDR(g.target_amount)}</span>
                  </div>
                  <Progress value={ratio} indicatorClassName={done ? 'bg-success' : 'bg-primary'} />
                  <p className="mt-1 text-[12px] font-semibold text-primary">
                    Progress {ratio.toFixed(1).replace('.', ',')}%
                  </p>
                </div>

                {!done && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-accent p-2.5">
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                    <p className="text-[12px] text-accent-foreground">
                      Perlu menabung <span className="font-bold">{formatIDR(perMonth)}</span> per bulan
                      {monthsLeft > 0 ? ` selama ${monthsLeft} bulan` : ' (target sudah lewat)'} untuk mencapai
                      target ini.
                    </p>
                  </div>
                )}

                {g.notes && <p className="mt-2 text-[12px] text-muted-foreground">{g.notes}</p>}

                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(g); setOpen(true); }}>
                    Ubah / Tambah dana
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(g.id)}>
                    Hapus
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <GoalSheet open={open} onClose={() => setOpen(false)} editing={editing} />

      <ConfirmDialog
        open={!!deleteId}
        title="Hapus target?"
        description="Target ini akan dihapus permanen."
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await store.deleteGoal(deleteId);
          setDeleteId(null);
          toast('Target dihapus.', 'success');
        }}
      />
    </div>
  );
}

function GoalSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Goal | null }) {
  const store = useStore();
  const { toast } = useToast();
  const [wasOpen, setWasOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setName(editing?.name || '');
    setEmoji(editing?.emoji || '🎯');
    setTarget(editing ? formatAmountInput(String(editing.target_amount)) : '');
    setCurrent(editing ? formatAmountInput(String(editing.current_amount)) : '');
    setDate(editing?.target_date || `${new Date().getFullYear()}-12-31`);
    setNotes(editing?.notes || '');
  }
  if (!open && wasOpen) setWasOpen(false);

  const save = async () => {
    if (!name.trim()) return toast('Nama target belum diisi.', 'error');
    const targetAmount = parseIDR(target);
    if (targetAmount <= 0) return toast('Nominal target harus lebih dari 0.', 'error');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        emoji,
        target_amount: targetAmount,
        current_amount: parseIDR(current),
        target_date: date || todayISO(),
        notes: notes.trim() || null,
      };
      if (editing) await store.updateGoal(editing.id, payload);
      else await store.addGoal(payload);
      toast(editing ? 'Target diperbarui.' : 'Target dibuat.', 'success');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan target.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah Target' : 'Target Baru'}
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
          <Label htmlFor="g-name">Nama target</Label>
          <div className="flex gap-2">
            <Select
              aria-label="Emoji target"
              className="w-20 shrink-0 text-center"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
            >
              {['🎯', '🗾', '🛟', '🏠', '🚗', '💍', '🎓', '💻', '🏝', '👶'].concat(CATEGORY_EMOJI_CHOICES).map((e, i) => (
                <option key={`${e}-${i}`} value={e}>
                  {e}
                </option>
              ))}
            </Select>
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Liburan Jepang" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="g-target">Target</Label>
            <Input
              id="g-target"
              inputMode="numeric"
              placeholder="30.000.000"
              value={target}
              onChange={(e) => setTarget(formatAmountInput(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="g-current">Sudah terkumpul</Label>
            <Input
              id="g-current"
              inputMode="numeric"
              placeholder="0"
              value={current}
              onChange={(e) => setCurrent(formatAmountInput(e.target.value))}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="g-date">Tanggal target</Label>
          <Input id="g-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="g-notes">Catatan</Label>
          <Textarea id="g-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}

function monthsUntil(dateStr: string): number {
  const target = toDate(dateStr);
  const now = new Date();
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(0, months);
}
