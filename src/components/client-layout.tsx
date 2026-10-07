
"use client";

import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import { AuthProviderClient, AppHeaderMenu } from '@/components/auth-provider-client';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProviderClient>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              <path d="M3.22 12H3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-.22" />
            </svg>
            <span className="font-bold sm:inline-block">CardioCare</span>
          </Link>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <AppHeaderMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 py-6">
        {children}
      </main>
      <Toaster />
    </AuthProviderClient>
  );
}
