'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

type Method = 'email' | 'phone';

export default function MasukPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowser()!;
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/');
    });
  }, [configured, router]);

  const signInGoogle = async () => {
    setLoading('google');
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Login Google gagal.', 'error');
      setLoading(null);
    }
  };

  const sendMagicLink = async () => {
    if (!email.trim()) return toast('Email belum diisi.', 'error');
    setLoading('email');
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      toast('Tautan masuk sudah dikirim ke email Anda.', 'success');
      setOtpSent(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengirim email.', 'error');
    } finally {
      setLoading(null);
    }
  };

  const sendPhoneOtp = async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) return toast('Nomor HP tidak valid. Contoh: 081234567890', 'error');
    setLoading('phone');
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      toast('Kode OTP dikirim via SMS.', 'success');
      setOtpSent(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengirim OTP.', 'error');
    } finally {
      setLoading(null);
    }
  };

  const verifyOtp = async () => {
    if (otp.trim().length < 4) return toast('Kode OTP belum lengkap.', 'error');
    setLoading('verify');
    try {
      const supabase = getSupabaseBrowser()!;
      const { error } =
        method === 'phone'
          ? await supabase.auth.verifyOtp({
              phone: normalizePhone(phone) as string,
              token: otp.trim(),
              type: 'sms',
            })
          : await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: 'email' });
      if (error) throw error;
      router.replace('/');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kode OTP salah atau kedaluwarsa.', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-[28px] shadow-lg">
          🧾
        </div>
        <h1 className="text-[26px] font-extrabold tracking-tight">CATATIN</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Catat pengeluaran dalam 10 detik. Foto struk, AI yang membaca.
        </p>
      </div>

      {!configured ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-warning/40 bg-warning/8 p-4">
            <p className="text-[13px] font-bold">Supabase belum dikonfigurasi</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              Aplikasi berjalan dalam mode demo — data tersimpan lokal di browser ini dan tetap bisa dipakai penuh.
              Untuk mengaktifkan login serta sinkronisasi, isi{' '}
              <code className="rounded bg-secondary px-1">NEXT_PUBLIC_SUPABASE_URL</code> dan{' '}
              <code className="rounded bg-secondary px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di{' '}
              <code className="rounded bg-secondary px-1">.env.local</code>.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={() => router.replace('/')}>
            <Sparkles className="h-4 w-4" /> Lanjut dengan mode demo
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Button size="lg" variant="outline" className="w-full" loading={loading === 'google'} onClick={signInGoogle}>
            <GoogleIcon /> Masuk dengan Google
          </Button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-foreground">atau</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-secondary p-1">
            {(['email', 'phone'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMethod(m);
                  setOtpSent(false);
                  setOtp('');
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition-colors ${
                  method === m ? 'bg-card shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {m === 'email' ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                {m === 'email' ? 'Email' : 'Nomor HP'}
              </button>
            ))}
          </div>

          {method === 'email' ? (
            <div>
              <Label htmlFor="email">Alamat email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
              />
              <Button
                size="lg"
                className="mt-3 w-full"
                loading={loading === 'email'}
                onClick={sendMagicLink}
              >
                Kirim tautan masuk <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div>
              <Label htmlFor="phone">Nomor HP</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
              />
              <Button size="lg" className="mt-3 w-full" loading={loading === 'phone'} onClick={sendPhoneOtp}>
                Kirim kode OTP <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {otpSent && (
            <div className="rounded-xl border border-border bg-card p-4">
              <Label htmlFor="otp">Kode verifikasi</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={8}
                className="tnum text-center text-[20px] font-bold tracking-[0.3em]"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
              />
              <Button className="mt-3 w-full" loading={loading === 'verify'} onClick={verifyOtp}>
                Verifikasi & masuk
              </Button>
              <p className="mt-2 text-center text-[11.5px] text-muted-foreground">
                {method === 'email'
                  ? 'Anda juga bisa langsung klik tautan di email.'
                  : 'Kode berlaku beberapa menit.'}
              </p>
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
        Data keuangan Anda hanya bisa diakses oleh akun Anda sendiri (Row Level Security).
      </p>
    </div>
  );
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  return `+${digits}`;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
