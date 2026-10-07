"use client";

import { HospitalMark, useBranding } from '@/components/branding-provider';
import { isSevaDefault } from '@/lib/branding';

// Logo and hospital name at the top of the login and password pages, in the hospital's colour.
export function AuthBrandHeader() {
  const { profile } = useBranding();
  const subtitle = profile.tagline?.trim() || (isSevaDefault(profile) ? 'Healthcare Management' : null);
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="shrink-0 rounded-full bg-white p-2 shadow-sm">
        <HospitalMark className="h-10 w-10" />
      </div>
      <div className="min-w-0 text-left">
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{profile.name}</h1>
        {subtitle && <p className="text-sm text-primary-foreground/80">{subtitle}</p>}
      </div>
    </div>
  );
}
