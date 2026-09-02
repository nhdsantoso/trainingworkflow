'use client';

import { useEffect } from 'react';

/** Mendaftarkan service worker supaya Share Target & mode standalone aktif. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.warn('[CATATIN] Service worker gagal didaftarkan', e);
    });
  }, []);
  return null;
}
