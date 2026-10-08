
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Link from '@/components/app-link';
import { Suspense } from 'react';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';
import { BrandingProvider, HospitalMark, HospitalName } from '@/components/branding-provider';
import { getHospitalProfile } from '@/lib/hospital-profile.server';
import { PageGuard } from '@/components/page-guard';
import { brandingUrls, displayName, hexToHslTriplet } from '@/lib/branding';
import { AuthProvider } from '@/context/AuthContext';
import { AppMenu } from '@/components/app-menu';
import { LanguageProvider } from '@/components/language-provider';
import { LanguageToggle } from '@/components/language-toggle';

// Pages are built once and served from the CDN. They are rebuilt as soon as the Super Admin
// saves the hospital profile (see /api/hospital-profile), and otherwise once a day as a safety
// net. The browser also checks the profile once per tab (BrandingProvider), so nobody sees an
// old logo even if it was changed directly in the database.
export const revalidate = 86400;

// Title, icons and colours come from this hospital's profile (Organization Setup →
// Hospital Profile); before it is set up they are Seva's.
export async function generateMetadata(): Promise<Metadata> {
  const profile = await getHospitalProfile();
  const urls = brandingUrls(profile);
  const name = displayName(profile);
  return {
    title: profile.name,
    description: profile.tagline || 'Hospital and patient care management',
    appleWebApp: { capable: true, title: name, statusBarStyle: 'default' },
    icons: urls
      ? { icon: [{ url: urls.icon192, type: 'image/png', sizes: '192x192' }], apple: urls.apple }
      : { icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/icons/seva.svg', type: 'image/svg+xml' }], apple: '/icons/apple-icon.png' },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const profile = await getHospitalProfile();
  return {
    width: 'device-width',
    initialScale: 1,
    // Use the whole screen in the installed app; the header and page padding keep
    // content clear of the notch and home bar.
    viewportFit: 'cover',
    themeColor: profile.brandColor,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getHospitalProfile();
  // The hospital's colour for buttons, links and focus rings (validated by the database).
  const brand = /^#[0-9a-fA-F]{6}$/.test(profile.brandColor) ? profile.brandColor : '#2563eb';
  const themeCss = `:root{--primary:${hexToHslTriplet(brand)};--ring:${hexToHslTriplet(brand)}}.dark{--primary:${hexToHslTriplet(brand, 75)}}`;
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        <BrandingProvider initialProfile={profile}>
        <LanguageProvider>
        <AuthProvider>
          <header className="print:hidden sticky top-0 z-50 w-full border-b bg-background pt-[env(safe-area-inset-top)]">
            <div className="container mx-auto flex h-14 items-center px-4 sm:px-6 lg:px-8">
              <Link href="/dashboard" className="mr-2 flex min-h-10 min-w-0 items-center space-x-2 sm:mr-6">
                <HospitalMark className="h-8 w-8" />
                <HospitalName className="max-w-[42vw] truncate font-bold text-lg sm:max-w-none" />
              </Link>
              <div className="flex flex-1 items-center justify-end gap-2">
                <LanguageToggle />
                <AppMenu />
              </div>
            </div>
          </header>
          <main className="flex-1 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] print:py-0">
            <Suspense fallback={<div className="flex justify-center items-center py-20 text-muted-foreground">Loading...</div>}>
              <PageGuard>{children}</PageGuard>
            </Suspense>
          </main>
          <Toaster />
          <ServiceWorkerRegistration />
        </AuthProvider>
        </LanguageProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
