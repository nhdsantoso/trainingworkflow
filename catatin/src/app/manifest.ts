import type { MetadataRoute } from 'next';

/**
 * PWA manifest + Web Share Target.
 * Share Target membuat CATATIN muncul di menu "Bagikan" Android sehingga screenshot
 * bukti transfer dari WhatsApp / m-banking / e-wallet bisa langsung dikirim ke aplikasi.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CATATIN — Catat Keuangan',
    short_name: 'CATATIN',
    description: 'Catat pengeluaran & pemasukan dalam 10 detik lewat foto struk dan bukti transfer.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F8FC',
    theme_color: '#4F46E5',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    share_target: {
      action: '/share',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [
          {
            name: 'image',
            accept: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/*'],
          },
        ],
      },
    },
    shortcuts: [
      { name: 'Scan Struk', short_name: 'Scan', url: '/tambah?mode=scan' },
      { name: 'Input Manual', short_name: 'Manual', url: '/tambah?mode=manual' },
      { name: 'AI Keuangan', short_name: 'AI', url: '/ai' },
    ],
  } as MetadataRoute.Manifest;
}
