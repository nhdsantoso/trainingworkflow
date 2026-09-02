'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles, AlertTriangle } from 'lucide-react';
import { PageHeader, LoadingScreen } from '@/components/common';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { buildFinancialContext } from '@/lib/analytics';
import { currentPeriod } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Berapa pengeluaran saya bulan ini?',
  'Kenapa pengeluaran saya naik?',
  'Berapa saya habiskan untuk makan?',
  'Apakah saya boros bulan ini?',
  'Kalau saya ingin menabung Rp10 juta per bulan, pengeluaran mana yang harus dikurangi?',
  'Buatkan rencana budget realistis untuk bulan depan.',
];

export default function AIPage() {
  const store = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const context = useMemo(
    () =>
      buildFinancialContext(
        {
          transactions: store.transactions,
          categories: store.categories,
          wallets: store.wallets,
          budgets: store.budgets,
          goals: store.goals,
          debts: store.debts,
          recurring: store.recurring,
        },
        currentPeriod(),
      ),
    [store.transactions, store.categories, store.wallets, store.budgets, store.goals, store.debts, store.recurring],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    setError(null);
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context, history }),
      });
      const json = (await res.json()) as { ok: boolean; answer?: string; error?: string };
      if (!json.ok || !json.answer) {
        setError(json.error || 'AI gagal menjawab.');
        return;
      }
      setMessages((m) => [...m, { role: 'assistant', content: json.answer as string }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Koneksi ke AI gagal.');
    } finally {
      setLoading(false);
    }
  };

  if (!store.ready) return <LoadingScreen />;

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title="AI Keuangan"
        subtitle={`Menjawab berdasarkan ${store.transactions.length} transaksi Anda`}
      />

      <div className="flex-1 space-y-3 px-4 pb-40 pt-4">
        {messages.length === 0 && (
          <>
            <div className="rounded-xl border border-primary/25 bg-accent p-4">
              <p className="flex items-center gap-2 text-[14px] font-bold text-accent-foreground">
                <Sparkles className="h-4 w-4" /> Tanya apa saja soal keuangan Anda
              </p>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                Jawaban dihitung dari data transaksi, budget, target, dan hutang Anda sendiri — bukan jawaban
                umum. Data tidak dipakai untuk apa pun selain menjawab pertanyaan ini.
              </p>
            </div>
            <div className="grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-xl border border-border bg-card p-3 text-left text-[13px] font-medium transition-colors hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                m.role === 'user'
                  ? 'rounded-br-md bg-primary text-primary-foreground'
                  : 'rounded-bl-md border border-border bg-card',
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-[12.5px] text-muted-foreground">Menganalisis data Anda…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex gap-2 rounded-xl border border-warning/40 bg-warning/8 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">{error}</p>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="glass safe-bottom fixed inset-x-0 bottom-[68px] z-40 mx-auto w-full max-w-md border-t border-border bg-card/90 p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            placeholder="Tanya soal keuangan Anda…"
            aria-label="Pertanyaan untuk AI Keuangan"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!input.trim() || loading} aria-label="Kirim">
            <Send className="h-4.5 w-4.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
