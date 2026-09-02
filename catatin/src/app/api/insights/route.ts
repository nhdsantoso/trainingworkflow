import { NextResponse } from 'next/server';
import { askJSON, isAIConfigured } from '@/lib/server/ai';

export const runtime = 'nodejs';

const SYSTEM = `Anda analis keuangan pribadi berbahasa Indonesia di aplikasi CATATIN.
Dari DATA_KEUANGAN yang diberikan, buat 2-3 insight paling berguna dan spesifik.
Jawab HANYA JSON: {"insights":[{"icon":"emoji","title":"judul singkat","body":"1-2 kalimat dengan angka Rupiah yang benar","tone":"info|positive|warning|danger"}]}
Aturan: pakai angka nyata dari data (jangan mengarang), sebut kategori/merchant spesifik, dan beri satu insight yang bisa langsung ditindaklanjuti.`;

export async function POST(request: Request) {
  try {
    if (!isAIConfigured()) {
      return NextResponse.json({ ok: false, insights: [] }, { status: 200 });
    }
    const body = (await request.json()) as { context?: unknown };
    const result = await askJSON<{ insights?: unknown[] }>({
      system: SYSTEM,
      prompt: `DATA_KEUANGAN:\n${JSON.stringify(body.context ?? {})}\n\nKeluarkan JSON sesuai format.`,
      maxTokens: 900,
    });

    const insights = (Array.isArray(result.insights) ? result.insights : [])
      .slice(0, 3)
      .map((raw, i) => {
        const o = (raw ?? {}) as Record<string, unknown>;
        return {
          id: `ai-${i}`,
          icon: String(o.icon || '💡').slice(0, 4),
          title: String(o.title || 'Insight').slice(0, 80),
          body: String(o.body || '').slice(0, 320),
          tone: ['info', 'positive', 'warning', 'danger'].includes(String(o.tone))
            ? String(o.tone)
            : 'info',
        };
      })
      .filter((i) => i.body);

    return NextResponse.json({ ok: true, insights });
  } catch (e) {
    // Insight AI bersifat pelengkap — kegagalan tidak boleh merusak dashboard.
    return NextResponse.json(
      { ok: false, insights: [], error: e instanceof Error ? e.message : 'gagal' },
      { status: 200 },
    );
  }
}
