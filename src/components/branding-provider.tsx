"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SevaLogo } from '@/components/seva-logo';
import { brandingUrls, displayName, hexToHslTriplet, initialsFor, isSevaDefault, monogramSvg, type HospitalProfile } from '@/lib/branding';
import { hospitalProfile as profileRepo } from '@/lib/data';
import { MINUTE, cached } from '@/lib/data/cache';
import { cn } from '@/lib/utils';

interface BrandingContextValue {
  profile: HospitalProfile;
  setProfile: (profile: HospitalProfile) => void; // after the Super Admin saves, so this tab updates at once
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

// Holds the hospital's branding, read on the server by the root layout.
export function BrandingProvider({ initialProfile, children }: { initialProfile: HospitalProfile; children: React.ReactNode }) {
  const [profile, setProfile] = useState(initialProfile);

  // The page may come from the CDN's copy built a few minutes ago; check the saved profile once
  // per tab (about 500 bytes) and switch to it if the Super Admin has changed it since.
  useEffect(() => {
    cached('branding:profile', 10 * MINUTE, () => profileRepo.get())
      .then(latest => {
        const changed = (['name', 'shortName', 'tagline', 'brandColor', 'logoFolder', 'configuredAt'] as const)
          .some(key => (latest[key] ?? null) !== (initialProfile[key] ?? null))
          || (latest.disabledModules ?? []).join() !== (initialProfile.disabledModules ?? []).join();
        if (changed) setProfile(prev => ({ ...prev, ...latest }));
      })
      .catch(() => undefined); // keep what the page was built with
  }, [initialProfile]);

  // Apply the brand colour (buttons, links, focus rings) when it differs from the page's.
  useEffect(() => {
    if (profile.brandColor === initialProfile.brandColor || !SAFE_COLOR.test(profile.brandColor)) return;
    const root = document.documentElement.style;
    root.setProperty('--primary', hexToHslTriplet(profile.brandColor));
    root.setProperty('--ring', hexToHslTriplet(profile.brandColor));
  }, [profile.brandColor, initialProfile.brandColor]);

  const value = useMemo(() => ({ profile, setProfile }), [profile]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  const value = useContext(BrandingContext);
  if (!value) throw new Error('useBranding must be used inside BrandingProvider');
  return value;
}

const SAFE_COLOR = /^#[0-9a-fA-F]{6}$/;

// The 96 px logo copy (~4 KB instead of ~20 KB). Logos saved before that copy existed fall back
// to logo.png, also when the small one failed before this code was running (checked on mount).
function LogoImage({ small, full, className }: { small: string; full: string; className: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const showFull = (img: HTMLImageElement | null) => { if (img && !img.src.endsWith('/logo.png')) img.src = full; };
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) showFull(img);
  });
  // eslint-disable-next-line @next/next/no-img-element -- small public PNG from Supabase Storage
  return <img ref={ref} src={small} alt="" className={className} onError={e => showFull(e.currentTarget)} />;
}

// The hospital's logo: the uploaded image, or a monogram from its initials until one is
// uploaded, or the Seva logo before the hospital profile has been set up.
export function HospitalMark({ className, profile: override }: { className?: string; profile?: HospitalProfile }) {
  const { profile: current } = useBranding();
  const profile = override ?? current;
  const urls = brandingUrls(profile);
  if (urls) {
    return <LogoImage small={urls.logoSmall} full={urls.logo} className={cn('h-6 w-6 shrink-0 object-contain', className)} />;
  }
  if (isSevaDefault(profile)) return <SevaLogo className={className} />;
  const color = SAFE_COLOR.test(profile.brandColor) ? profile.brandColor : '#2563eb';
  return (
    <span aria-hidden="true" className={cn('inline-block h-6 w-6 shrink-0 [&>svg]:h-full [&>svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: monogramSvg(initialsFor(profile.name), color) }} />
  );
}

export function HospitalName({ className, full = false }: { className?: string; full?: boolean }) {
  const { profile } = useBranding();
  return <span className={className}>{full ? profile.name : displayName(profile)}</span>;
}
