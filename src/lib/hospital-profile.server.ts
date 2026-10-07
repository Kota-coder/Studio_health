import 'server-only';
import { unstable_cache } from 'next/cache';
import { DEFAULT_PROFILE, type HospitalProfile } from '@/lib/branding';

export const HOSPITAL_PROFILE_TAG = 'hospital-profile';

// The hospital's branding for server-rendered parts (page title, icons, manifest, colours).
// Cached on the server for 5 minutes, and cleared straight away when the Super Admin saves the
// profile (see /api/hospital-profile), so page loads don't each query the database. Pages are
// rendered per request (see the root layout), so the next load after a save shows it.
export const getHospitalProfile = unstable_cache(loadHospitalProfile, [HOSPITAL_PROFILE_TAG], {
  revalidate: 300,
  tags: [HOSPITAL_PROFILE_TAG],
});

async function loadHospitalProfile(): Promise<HospitalProfile> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_PROFILE;
  try {
    const response = await fetch(`${url}/rest/v1/hospital_profile?id=eq.1&select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store', // cached by unstable_cache above
    });
    if (!response.ok) return DEFAULT_PROFILE; // e.g. the migration hasn't been run yet
    const [row] = (await response.json()) as Array<Record<string, string | null>>;
    if (!row) return DEFAULT_PROFILE;
    return {
      name: row.name || DEFAULT_PROFILE.name,
      shortName: row.short_name,
      tagline: row.tagline,
      address: row.address,
      phone: row.phone,
      email: row.email,
      website: row.website,
      registrationNumber: row.registration_number,
      brandColor: row.brand_color || DEFAULT_PROFILE.brandColor,
      logoFolder: row.logo_folder,
      configuredAt: row.configured_at,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}
