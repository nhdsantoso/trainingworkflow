import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { ToastProvider } from '@/components/ui/toast';
import { AppShell } from '@/components/app-shell';
import { ServiceWorkerRegister } from '@/components/sw-register';

export const metadata: Metadata = {
  title: 'CATATIN — Catat Keuangan dalam 10 Detik',
  description:
    'Aplikasi pencatatan keuangan pribadi berbasis AI. Foto struk atau bukti transfer, AI membaca datanya, Anda tinggal konfirmasi.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'CATATIN' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/*
          Menerapkan tema sebelum halaman dilukis supaya tidak ada kedipan putih
          saat mode gelap aktif, dan pilihan tema tetap konsisten di semua halaman.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('catatin:theme');" +
              "var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;" +
              "document.documentElement.classList.toggle('dark',d);}catch(e){}})();",
          }}
        />
        {/* Font modern; kalau offline otomatis jatuh ke system font stack. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Aturan no-page-custom-font berlaku untuk Pages Router; di App Router
            tag ini berada di root layout sehingga dimuat sekali untuk semua halaman. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`:root{--font-sans:'Plus Jakarta Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}`}</style>
      </head>
      <body className="min-h-dvh bg-background font-sans">
        <ToastProvider>
          <StoreProvider>
            <AppShell>{children}</AppShell>
            <ServiceWorkerRegister />
          </StoreProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
