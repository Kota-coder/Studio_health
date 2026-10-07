import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CardioCare App',
  description: 'Patient Management System by Firebase Studio',
  keywords: ['healthcare', 'patient management', 'medical', 'cardiology'],
  authors: [{ name: 'Firebase Studio' }],
  robots: 'index, follow',
  openGraph: {
    title: 'CardioCare App',
    description: 'Patient Management System by Firebase Studio',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const ClientLayout = dynamic(() => import('@/components/client-layout'));

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased flex flex-col min-h-screen`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}