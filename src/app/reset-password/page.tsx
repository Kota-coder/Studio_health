"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Password resets now arrive by email link (see /forgot-password), which opens
// /set-password. Old bookmarks to this page are sent there.
export default function ResetPasswordPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/set-password');
  }, [router]);
  return <div className="flex justify-center items-center min-h-screen"><p>Redirecting...</p></div>;
}
