
import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import { Suspense } from 'react';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';
import { BrandingProvider, HospitalMark, HospitalName } from '@/components/branding-provider';
import { getHospitalProfile } from '@/lib/hospital-profile.server';
import { ModuleGuard } from '@/components/module-guard';
import { brandingUrls, displayName, hexToHslTriplet } from '@/lib/branding';
import { AuthProviderClient, AppHeaderMenu } from '@/components/auth-provider-client'; // Import AppHeaderMenu

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Pages are built once and served from the CDN, rebuilt at most every 5 minutes or as soon
// as the Super Admin saves the hospital profile (see lib/hospital-profile.server.ts). The
// browser also checks the profile once per tab (BrandingProvider), so nobody sees an old logo.
export const revalidate = 300;

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
        <BrandingProvider initialProfile={profile}>
        <AuthProviderClient>
          <header className="print:hidden sticky top-0 z-50 w-full border-b bg-background pt-[env(safe-area-inset-top)]">
            <div className="container mx-auto flex h-14 items-center px-4 sm:px-6 lg:px-8">
              <Link href="/dashboard" className="mr-6 flex min-h-10 items-center space-x-2">
                <HospitalMark className="h-8 w-8" />
                <HospitalName className="max-w-[55vw] truncate font-bold text-lg sm:max-w-none" />
              </Link>
              <div className="flex flex-1 items-center justify-end space-x-2">
                <AppHeaderMenu /> {/* Use the client component for the menu */}
              </div>
            </div>
          </header>
          <main className="flex-1 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] print:py-0">
            <Suspense fallback={<div className="flex justify-center items-center py-20 text-muted-foreground">Loading...</div>}>
              <ModuleGuard>{children}</ModuleGuard>
            </Suspense>
          </main>
          <Toaster />
          <ServiceWorkerRegistration />
        </AuthProviderClient>
        </BrandingProvider>
      </body>
    </html>
  );
}
