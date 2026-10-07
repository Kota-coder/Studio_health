
import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import { Suspense } from 'react';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';
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
  title: 'CardioCare',
  description: 'Patient management for the clinic',
  appleWebApp: { capable: true, title: 'CardioCare', statusBarStyle: 'default' },
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
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-[env(safe-area-inset-top)]">
            <div className="container mx-auto flex h-14 items-center px-4 sm:px-6 lg:px-8">
              <Link href="/dashboard" className="mr-6 flex min-h-10 items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  <path d="M3.22 12H3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-.22" />
                </svg>
                <span className="font-bold sm:inline-block">CardioCare</span>
              </Link>
              <div className="flex flex-1 items-center justify-end space-x-2">
                <AppHeaderMenu /> {/* Use the client component for the menu */}
              </div>
            </div>
          </header>
          <main className="flex-1 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
