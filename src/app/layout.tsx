
import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import { Suspense } from 'react';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';
import { SevaLogo } from '@/components/seva-logo';
import { AuthProviderClient, AppHeaderMenu } from '@/components/auth-provider-client'; // Import AppHeaderMenu

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Seva',
  description: 'Hospital and patient care management',
  appleWebApp: { capable: true, title: 'Seva', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Use the whole screen in the installed app; the header and page padding keep
  // content clear of the notch and home bar.
  viewportFit: 'cover',
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
        <AuthProviderClient>
          <header className="print:hidden sticky top-0 z-50 w-full border-b bg-background pt-[env(safe-area-inset-top)]">
            <div className="container mx-auto flex h-14 items-center px-4 sm:px-6 lg:px-8">
              <Link href="/dashboard" className="mr-6 flex min-h-10 items-center space-x-2">
                <SevaLogo className="h-7 w-7" />
                <span className="font-bold text-lg sm:inline-block">Seva</span>
              </Link>
              <div className="flex flex-1 items-center justify-end space-x-2">
                <AppHeaderMenu /> {/* Use the client component for the menu */}
              </div>
            </div>
          </header>
          <main className="flex-1 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] print:py-0">
            <Suspense fallback={<div className="flex justify-center items-center py-20 text-muted-foreground">Loading...</div>}>
              {children}
            </Suspense>
          </main>
          <Toaster />
          <ServiceWorkerRegistration />
        </AuthProviderClient>
      </body>
    </html>
  );
}
