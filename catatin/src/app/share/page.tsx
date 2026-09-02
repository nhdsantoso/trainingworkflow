'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Share2, AlertTriangle } from 'lucide-react';
import { PageHeader, LoadingScreen } from '@/components/common';
import { Button } from '@/components/ui/button';
import { blobToDataUrl } from '@/lib/repo';

const SHARE_CACHE = 'catatin-share-v1';
const SHARED_IMAGE_KEY = '/__catatin_shared_image';
const SHARED_TEXT_KEY = '/__catatin_shared_text';

/**
 * Penerima Web Share Target.
 * Service worker sudah menaruh berkas yang dibagikan di Cache Storage;
 * halaman ini mengambilnya lalu meneruskannya ke alur konfirmasi transaksi.
 */
export default function SharePage() {
  return (
    <Suspense fallback={<LoadingScreen label="Menerima bukti transaksi…" />}>
      <ShareInner />
    </Suspense>
  );
}

function ShareInner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!('caches' in window)) {
          setError('Browser ini belum mendukung Share Target.');
          return;
        }
        const cache = await caches.open(SHARE_CACHE);
        const imageRes = await cache.match(SHARED_IMAGE_KEY);
        const textRes = await cache.match(SHARED_TEXT_KEY);

        if (imageRes) {
          const blob = await imageRes.blob();
          const dataUrl = await blobToDataUrl(blob);
          sessionStorage.setItem('catatin:shared-image', dataUrl);
          await cache.delete(SHARED_IMAGE_KEY);
        }
        if (textRes) {
          sessionStorage.setItem('catatin:shared-text', await textRes.text());
          await cache.delete(SHARED_TEXT_KEY);
        }

        if (!imageRes && !textRes) {
          setError('Tidak ada gambar atau teks yang diterima.');
          return;
        }
        if (!cancelled) router.replace('/tambah?mode=scan&share=1');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal membaca data yang dibagikan.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!error) return <LoadingScreen label="Menerima bukti transaksi…" />;

  return (
    <div>
      <PageHeader title="Bagikan ke CATATIN" back="/" />
      <div className="space-y-4 px-4 pt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
          <Share2 className="h-8 w-8 text-primary" />
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/8 p-3 text-left">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-[12.5px] text-muted-foreground">{error}</p>
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          Pasang CATATIN ke layar utama (Add to Home Screen) agar muncul di menu “Bagikan” pada Android.
        </p>
        <Button className="w-full" onClick={() => router.replace('/tambah?mode=upload')}>
          Upload bukti secara manual
        </Button>
      </div>
    </div>
  );
}
