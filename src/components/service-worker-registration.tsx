"use client";

import { useEffect } from 'react';

// Registers public/sw.js (offline page only) in production builds.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(error => console.error('Service worker registration failed', error));
  }, []);
  return null;
}
