/**
 * Service worker CATATIN.
 *
 * Tugas utamanya menangani Web Share Target: ketika pengguna membagikan
 * screenshot bukti transfer dari WhatsApp / m-banking / galeri ke CATATIN,
 * Android mengirim POST multipart ke /share. POST tidak bisa ditangani oleh
 * halaman biasa, jadi service worker menyimpan berkasnya sebentar di Cache
 * Storage lalu mengarahkan pengguna ke halaman /share.
 */
const SHARE_CACHE = 'catatin-share-v1';
const SHARED_IMAGE_KEY = '/__catatin_shared_image';
const SHARED_TEXT_KEY = '/__catatin_shared_text';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share') return;

  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const cache = await caches.open(SHARE_CACHE);

        const file = form.get('image');
        if (file && typeof file !== 'string' && file.size > 0) {
          await cache.put(
            SHARED_IMAGE_KEY,
            new Response(file, { headers: { 'Content-Type': file.type || 'image/jpeg' } }),
          );
        } else {
          await cache.delete(SHARED_IMAGE_KEY);
        }

        const text = [form.get('title'), form.get('text'), form.get('url')]
          .filter((v) => typeof v === 'string' && v.trim())
          .join(' ')
          .trim();
        if (text) await cache.put(SHARED_TEXT_KEY, new Response(text));
        else await cache.delete(SHARED_TEXT_KEY);
      } catch (e) {
        console.warn('[CATATIN SW] gagal memproses share target', e);
      }
      return Response.redirect('/share?siap=1', 303);
    })(),
  );
});
