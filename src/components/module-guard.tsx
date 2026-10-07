"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBranding } from '@/components/branding-provider';
import { moduleForPath } from '@/config/modules';
import { useAuth } from '@/context/AuthContext';

// Shows a short notice instead of a page whose section the hospital has switched off
// (e.g. an old bookmark), so switched-off sections can't be opened from the address bar.
export function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useBranding();
  const { currentUser } = useAuth();
  const section = moduleForPath(pathname ?? '');
  if (!section || !(profile.disabledModules ?? []).includes(section.key)) return <>{children}</>;
  return (
    <div className="container mx-auto max-w-lg p-4 sm:p-6">
      <Card>
        <CardContent className="space-y-3 pt-6 text-center">
          <EyeOff className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">{section.label} is turned off</p>
          <p className="text-sm text-muted-foreground">
            {profile.name} doesn&apos;t use this section.
            {currentUser?.role === 'Super Admin' ? ' You can turn it on under Hospital Profile → Menus.' : ' Ask your Super Admin if you need it.'}
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline"><Link href="/dashboard">Patient Dashboard</Link></Button>
            {currentUser?.role === 'Super Admin' && <Button asChild><Link href="/hospital-profile#menus">Hospital Profile</Link></Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
