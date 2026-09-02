import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/** Menukar authorization code OAuth / magic link menjadi sesi, lalu kembali ke dashboard. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    const supabase = await getSupabaseServer();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
      return NextResponse.redirect(`${origin}/masuk?error=${encodeURIComponent(error.message)}`);
    }
  }

  return NextResponse.redirect(`${origin}/masuk`);
}
