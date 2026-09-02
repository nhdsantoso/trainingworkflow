'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Camera, ImageUp, Mic, MicOff, PencilLine, Sparkles, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { PageHeader, LoadingScreen } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useStore } from '@/lib/store';
import { preprocessImage, dataUrlToBlob } from '@/lib/image';
import {
  TransactionForm,
  emptyFormValue,
  fromTransaction,
  validateForm,
  type TransactionFormValue,
} from '@/components/transaction-form';
import type { ParseResponse, ParsedTransaction } from '@/lib/types';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';

type Mode = 'scan' | 'upload' | 'manual' | 'voice';
type Step = 'capture' | 'processing' | 'confirm';

export default function TambahPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <TambahInner />
    </Suspense>
  );
}

function TambahInner() {
  const router = useRouter();
  const params = useSearchParams();
  const store = useStore();
  const { toast } = useToast();

  const mode = (params.get('mode') || 'manual') as Mode;
  const editId = params.get('id');
  const fromShare = params.get('share') === '1';

  const [step, setStep] = useState<Step>(mode === 'manual' ? 'confirm' : 'capture');
  const [form, setForm] = useState<TransactionFormValue | null>(null);
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [engine, setEngine] = useState<string>('');
  const [warning, setWarning] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [progressLabel, setProgressLabel] = useState('Menyiapkan gambar…');

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const sharedHandled = useRef(false);

  // Dompet default = yang paling sering dipakai belakangan, bukan sekadar yang pertama
  // di daftar — supaya user jarang perlu mengubahnya.
  const defaultWallet = useMemo(() => {
    const active = store.wallets.filter((w) => !w.archived);
    if (active.length === 0) return 'cash';
    const tally = new Map<string, number>();
    for (const t of store.transactions.slice(0, 40)) {
      if (active.some((w) => w.id === t.wallet)) tally.set(t.wallet, (tally.get(t.wallet) || 0) + 1);
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return top || active.find((w) => w.id === 'cash')?.id || active[0].id;
  }, [store.wallets, store.transactions]);

  const defaultCategory = store.categories.find((c) => c.type !== 'income')?.name || 'Lainnya';

  /* ---- Inisialisasi form (mode manual / edit) ---- */
  useEffect(() => {
    if (form || !store.ready) return;
    if (editId) {
      const tx = store.transactions.find((t) => t.id === editId);
      if (tx) {
        setForm(fromTransaction(tx));
        setPreview(null);
        setStep('confirm');
        return;
      }
    }
    if (mode === 'manual') setForm(emptyFormValue(defaultWallet, defaultCategory));
  }, [store.ready, store.transactions, editId, mode, form, defaultWallet, defaultCategory]);

  /* ---- Pipeline OCR + AI ---- */
  const processImage = useCallback(
    async (file: File | Blob, filename = 'struk.jpg') => {
      setStep('processing');
      setErrorMsg(null);
      setWarning(null);
      try {
        setProgressLabel('Memproses gambar…');
        const processed = await preprocessImage(file, { maxDimension: 1600, quality: 0.86, enhance: true });
        setPreview(processed.dataUrl);
        setReceiptBlob(processed.blob);

        setProgressLabel('Membaca teks (OCR)…');
        const body = new FormData();
        body.append('image', processed.blob, filename);
        body.append('categories', JSON.stringify(store.categories.map((c) => c.name)));

        setProgressLabel('AI menyusun data transaksi…');
        const res = await fetch('/api/parse-receipt', { method: 'POST', body });
        const json = (await res.json()) as ParseResponse;

        if (!json.ok || !json.data) {
          setErrorMsg(json.error || 'Gagal membaca bukti transaksi.');
          setForm(emptyFormValue(defaultWallet, defaultCategory));
          setStep('confirm');
          return;
        }

        setParsed(json.data);
        setEngine(json.engine || '');
        setWarning(json.warning || null);
        setForm(parsedToForm(json.data, defaultWallet, store.wallets.map((w) => w.id)));
        setStep('confirm');
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Gagal memproses gambar.');
        setForm(emptyFormValue(defaultWallet, defaultCategory));
        setStep('confirm');
      }
    },
    [store.categories, store.wallets, defaultWallet, defaultCategory],
  );

  /* ---- Gambar dari Share Target (WhatsApp / m-banking / galeri) ---- */
  useEffect(() => {
    if (!fromShare || sharedHandled.current || !store.ready) return;
    sharedHandled.current = true;
    try {
      const dataUrl = sessionStorage.getItem('catatin:shared-image');
      const sharedText = sessionStorage.getItem('catatin:shared-text');
      sessionStorage.removeItem('catatin:shared-image');
      sessionStorage.removeItem('catatin:shared-text');
      if (dataUrl) {
        void processImage(dataUrlToBlob(dataUrl), 'bukti-transfer.jpg');
      } else if (sharedText) {
        void processText(sharedText);
      }
    } catch {
      /* diabaikan */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromShare, store.ready]);

  /* ---- Buka kamera / galeri otomatis ---- */
  useEffect(() => {
    if (fromShare || step !== 'capture' || !store.ready) return;
    const timer = setTimeout(() => {
      if (mode === 'scan') cameraRef.current?.click();
      if (mode === 'upload') galleryRef.current?.click();
    }, 350);
    return () => clearTimeout(timer);
  }, [mode, step, store.ready, fromShare]);

  /* ---- Input teks / suara ---- */
  const processText = useCallback(
    async (text: string) => {
      setStep('processing');
      setProgressLabel('AI membaca kalimat Anda…');
      setErrorMsg(null);
      try {
        const res = await fetch('/api/parse-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, categories: store.categories.map((c) => c.name) }),
        });
        const json = (await res.json()) as ParseResponse;
        if (!json.ok || !json.data) {
          setErrorMsg(json.error || 'Gagal membaca kalimat.');
          setForm(emptyFormValue(defaultWallet, defaultCategory));
          setStep('confirm');
          return;
        }
        setParsed(json.data);
        setEngine(json.engine || '');
        setWarning(json.warning || null);
        setForm(parsedToForm(json.data, defaultWallet, store.wallets.map((w) => w.id)));
        setStep('confirm');
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Gagal memproses teks.');
        setForm(emptyFormValue(defaultWallet, defaultCategory));
        setStep('confirm');
      }
    },
    [store.categories, store.wallets, defaultWallet, defaultCategory],
  );

  /* ---- Simpan ---- */
  const handleSave = async () => {
    if (!form) return;
    const problem = validateForm(form);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    setSaving(true);
    try {
      let receiptRef: string | null = null;
      if (receiptBlob) {
        try {
          receiptRef = await store.uploadReceipt(receiptBlob, 'struk.jpg');
        } catch (e) {
          toast(`Struk gagal diunggah: ${e instanceof Error ? e.message : 'error'}`, 'warning');
        }
      }

      if (editId) {
        await store.updateTransaction(editId, {
          type: form.type,
          date: form.date,
          time: form.time,
          merchant: form.merchant.trim(),
          category: form.category,
          amount: form.amount,
          payment_method: form.payment_method,
          wallet: form.wallet,
          to_wallet: form.type === 'transfer' ? form.to_wallet : null,
          notes: form.notes || null,
          reference_number: form.reference_number || null,
          items: form.items.filter((i) => i.name.trim()),
          ...(receiptRef ? { receipt_image: receiptRef } : {}),
        });
        toast('Transaksi diperbarui.', 'success');
        router.replace(`/transaksi/${editId}`);
      } else {
        const saved = await store.addTransaction({
          type: form.type,
          date: form.date,
          time: form.time,
          merchant: form.merchant.trim(),
          category: form.category,
          amount: form.amount,
          payment_method: form.payment_method,
          wallet: form.wallet,
          to_wallet: form.type === 'transfer' ? form.to_wallet : null,
          notes: form.notes || null,
          receipt_image: receiptRef,
          reference_number: form.reference_number || null,
          items: form.items.filter((i) => i.name.trim()),
        });
        toast(`Tersimpan: ${formatIDR(saved.amount)} · ${saved.merchant}`, 'success');
        router.replace(`/transaksi/${saved.id}`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan transaksi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!store.ready) return <LoadingScreen />;

  /* ---------------- Render ---------------- */

  return (
    <div className="min-h-dvh pb-32">
      <PageHeader
        title={editId ? 'Edit Transaksi' : step === 'confirm' ? 'Konfirmasi Transaksi' : titleFor(mode)}
        subtitle={
          step === 'confirm' && !editId
            ? 'Periksa dulu, baru simpan. Data tidak disimpan otomatis.'
            : undefined
        }
        back
      />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void processImage(f, f.name);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void processImage(f, f.name);
          e.target.value = '';
        }}
      />

      {step === 'capture' && (
        <CaptureStep
          mode={mode}
          onCamera={() => cameraRef.current?.click()}
          onGallery={() => galleryRef.current?.click()}
          onText={processText}
        />
      )}

      {step === 'processing' && <ProcessingStep label={progressLabel} preview={preview} />}

      {step === 'confirm' && form && (
        <div className="space-y-4 px-4 pt-4">
          {errorMsg && (
            <div className="flex gap-2.5 rounded-xl border border-destructive/30 bg-destructive/8 p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-[13px] font-bold text-destructive">Gagal membaca otomatis</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{errorMsg}</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Anda tetap bisa mengisi transaksi ini secara manual di bawah.
                </p>
              </div>
            </div>
          )}

          {parsed && <AiResultBanner parsed={parsed} engine={engine} warning={warning} />}

          {preview && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-[12px] font-semibold">Bukti transaksi</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => cameraRef.current?.click()}>
                    <RefreshCw className="h-3.5 w-3.5" /> Foto ulang
                  </Button>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Pratinjau bukti transaksi" className="max-h-64 w-full object-contain bg-secondary" />
            </div>
          )}

          <TransactionForm value={form} onChange={setForm} />
        </div>
      )}

      {step === 'confirm' && form && (
        <div className="glass safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md border-t border-border bg-card/90 p-3">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <span className="text-[12px] text-muted-foreground">Total disimpan</span>
            <span className="tnum text-[17px] font-extrabold">{formatIDR(form.amount)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => router.back()} disabled={saving}>
              Batal
            </Button>
            <Button className="flex-[2]" onClick={handleSave} loading={saving}>
              <Check className="h-4 w-4" /> {editId ? 'Simpan Perubahan' : 'Simpan Transaksi'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function titleFor(mode: Mode): string {
  if (mode === 'scan') return 'Scan Struk';
  if (mode === 'upload') return 'Upload Bukti';
  if (mode === 'voice') return 'Bicara / Ketik';
  return 'Input Manual';
}

function parsedToForm(p: ParsedTransaction, defaultWallet: string, walletIds: string[]): TransactionFormValue {
  // Tebak dompet dari metode pembayaran supaya user tidak perlu mengubahnya.
  const guess = (): string => {
    const m = (p.payment_method || '').toLowerCase();
    const pick = (id: string) => (walletIds.includes(id) ? id : null);
    if (m.includes('cash') || m.includes('tunai')) return pick('cash') || defaultWallet;
    if (m.includes('kredit')) return pick('credit-card') || defaultWallet;
    return defaultWallet;
  };

  return {
    type: p.transaction_type,
    date: p.date,
    time: p.time || '',
    merchant: p.merchant,
    category: p.category,
    amount: p.amount,
    payment_method: p.payment_method || 'Lainnya',
    wallet: guess(),
    to_wallet: null,
    notes: p.notes || '',
    reference_number: p.reference_number || '',
    items: p.items || [],
  };
}

function AiResultBanner({
  parsed,
  engine,
  warning,
}: {
  parsed: ParsedTransaction;
  engine: string;
  warning: string | null;
}) {
  const lowConfidence = parsed.confidence < 0.8;
  return (
    <div
      className={cn(
        'rounded-xl border p-3.5',
        lowConfidence ? 'border-warning/40 bg-warning/8' : 'border-primary/30 bg-accent',
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className={cn('h-4 w-4', lowConfidence ? 'text-warning' : 'text-primary')} />
        <p className="text-[13px] font-bold">
          {lowConfidence ? 'AI kurang yakin dengan hasil ini' : 'AI berhasil membaca bukti transaksi'}
        </p>
        <Badge tone={lowConfidence ? 'warning' : 'primary'} className="ml-auto">
          {Math.round(parsed.confidence * 100)}%
        </Badge>
      </div>

      {warning && <p className="mt-2 text-[12.5px] font-medium text-warning">⚠️ {warning}</p>}

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
        <Field label="Merchant" value={parsed.merchant} />
        <Field label="Nominal" value={formatIDR(parsed.amount)} />
        <Field label="Tanggal" value={`${parsed.date}${parsed.time ? ` ${parsed.time}` : ''}`} />
        <Field label="Kategori" value={parsed.category} />
        <Field label="Metode" value={parsed.payment_method} />
        <Field label="Jenis" value={typeLabel(parsed.transaction_type)} />
        {parsed.reference_number && <Field label="Referensi" value={parsed.reference_number} />}
        {parsed.items.length > 0 && <Field label="Item terbaca" value={`${parsed.items.length} item`} />}
      </dl>

      <p className="mt-2.5 text-[11px] text-muted-foreground">
        Sumber: {engine || 'AI'} · Periksa lalu tekan Simpan. Tidak ada data yang tersimpan sebelum Anda konfirmasi.
      </p>
    </div>
  );
}

function typeLabel(t: string) {
  return t === 'income' ? 'Pemasukan' : t === 'transfer' ? 'Transfer' : 'Pengeluaran';
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold">{value || '—'}</dd>
    </div>
  );
}

function ProcessingStep({ label, preview }: { label: string; preview: string | null }) {
  const steps = ['Memproses gambar…', 'Membaca teks (OCR)…', 'AI menyusun data transaksi…'];
  const activeIndex = Math.max(0, steps.indexOf(label));
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-8">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Bukti transaksi sedang diproses"
          className="max-h-52 rounded-xl border border-border object-contain shadow-sm"
        />
      ) : (
        <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      )}
      <ul className="w-full max-w-xs space-y-2.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                i < activeIndex && 'bg-success text-success-foreground',
                i === activeIndex && 'bg-primary text-primary-foreground',
                i > activeIndex && 'bg-secondary text-muted-foreground',
              )}
            >
              {i < activeIndex ? '✓' : i + 1}
            </span>
            <span className={i <= activeIndex ? 'font-medium' : 'text-muted-foreground'}>{s}</span>
            {i === activeIndex && (
              <span className="ml-auto h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CaptureStep({
  mode,
  onCamera,
  onGallery,
  onText,
}: {
  mode: Mode;
  onCamera: () => void;
  onGallery: () => void;
  onText: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    setSpeechSupported(true);
    const recognition = new Ctor();
    recognition.lang = 'id-ID';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setText(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    return () => recognition.abort?.();
  }, []);

  const toggleListen = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      setText('');
      try {
        recognition.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  };

  if (mode === 'voice') {
    return (
      <div className="space-y-5 px-4 pt-6">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <button
            onClick={toggleListen}
            disabled={!speechSupported}
            aria-label={listening ? 'Berhenti merekam' : 'Mulai bicara'}
            className={cn(
              'mx-auto flex h-24 w-24 items-center justify-center rounded-full transition-all disabled:opacity-40',
              listening
                ? 'animate-pulse bg-destructive text-destructive-foreground'
                : 'bg-primary text-primary-foreground',
            )}
          >
            {listening ? <MicOff className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
          </button>
          <p className="mt-3 text-[13px] font-semibold">
            {listening ? 'Mendengarkan…' : speechSupported ? 'Tekan lalu bicara' : 'Browser ini belum mendukung suara'}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {speechSupported
              ? 'Contoh: “makan siang 75 ribu pakai QRIS di Padang Sederhana”'
              : 'Silakan ketik transaksinya di kotak di bawah.'}
          </p>
        </div>

        <div>
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Contoh: bensin 300 ribu di Pertamina pakai kartu kredit"
          />
          <Button className="mt-3 w-full" size="lg" disabled={!text.trim()} onClick={() => onText(text.trim())}>
            <Sparkles className="h-4 w-4" /> Proses dengan AI
          </Button>
        </div>

        <div className="rounded-xl bg-secondary p-3 text-[12px] text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Contoh kalimat yang dipahami</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>“grab ke kantor 32 ribu”</li>
            <li>“gaji masuk 30 juta dari Telkomsel”</li>
            <li>“belanja bulanan 1,2 juta di Superindo pakai debit”</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-8">
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          {mode === 'scan' ? <Camera className="h-8 w-8" /> : <ImageUp className="h-8 w-8" />}
        </div>
        <p className="text-[15px] font-bold">
          {mode === 'scan' ? 'Foto struk Anda' : 'Pilih bukti transaksi'}
        </p>
        <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] text-muted-foreground">
          Pastikan seluruh struk terlihat dan pencahayaan cukup. AI akan membaca merchant, tanggal, nominal,
          dan metode pembayaran.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" onClick={onCamera}>
            <Camera className="h-5 w-5" /> Buka Kamera
          </Button>
          <Button size="lg" variant="outline" onClick={onGallery}>
            <ImageUp className="h-5 w-5" /> Pilih dari Galeri
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-secondary p-3.5 text-[12px] text-muted-foreground">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
          <PencilLine className="h-3.5 w-3.5" /> Tips agar akurat
        </p>
        <ul className="list-inside list-disc space-y-0.5">
          <li>Letakkan struk di permukaan datar, hindari bayangan.</li>
          <li>Screenshot bukti transfer bisa langsung diupload apa adanya.</li>
          <li>Hasil AI selalu bisa Anda edit sebelum disimpan.</li>
        </ul>
      </div>
    </div>
  );
}

/* Tipe minimal Web Speech API (belum ada di lib.dom bawaan TypeScript). */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort?(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
