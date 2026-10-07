import type { MetadataRoute } from 'next';
import { getHospitalProfile } from '@/lib/hospital-profile.server';
import { brandingUrls, displayName } from '@/lib/branding';

export const revalidate = 300;

// Lets staff add the app to their phone's home screen and open it full-screen, with this
// hospital's name and icon (Seva's until the hospital profile is set up).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const profile = await getHospitalProfile();
  const urls = brandingUrls(profile);
  return {
    name: profile.name,
    short_name: displayName(profile).slice(0, 12),
    description: profile.tagline || 'Hospital and patient care management',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: profile.brandColor,
    icons: urls
      ? [
          { src: urls.icon192, sizes: '192x192', type: 'image/png' },
          { src: urls.icon512, sizes: '512x512', type: 'image/png' },
          { src: urls.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      : [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
  };
}
