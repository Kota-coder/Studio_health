"use client";

import { HospitalMark, useBranding } from '@/components/branding-provider';

// The hospital's logo, name and contact details, at the top of printed pages.
export function HospitalLetterhead() {
  const { profile: hospital } = useBranding();
  return (
    <div className="flex items-start gap-3 border-b-2 border-primary pb-3">
      <HospitalMark className="h-14 w-14" />
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight">{hospital.name}</p>
        {hospital.tagline && <p className="text-sm text-muted-foreground">{hospital.tagline}</p>}
        <p className="text-xs text-muted-foreground">
          {[hospital.address, hospital.phone && `Phone ${hospital.phone}`, hospital.email, hospital.website].filter(Boolean).join(' · ')}
        </p>
        {hospital.registrationNumber && <p className="text-xs text-muted-foreground">Registration no. {hospital.registrationNumber}</p>}
      </div>
    </div>
  );
}
