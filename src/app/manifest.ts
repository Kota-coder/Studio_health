import type { MetadataRoute } from 'next';

// Lets staff add Seva to their phone's home screen and open it full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Seva',
    short_name: 'Seva',
    description: 'Hospital and patient care management',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
