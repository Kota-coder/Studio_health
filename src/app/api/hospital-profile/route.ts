import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getCurrentStaff } from '@/lib/supabase/server';
import { HOSPITAL_PROFILE_TAG } from '@/lib/hospital-profile.server';

// POST -> called after the Super Admin saves the hospital profile, so the new name, logo and
// colours show on the next page load instead of after the cache expires.
export async function POST() {
  const caller = await getCurrentStaff();
  if (!caller) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (caller.role !== 'Super Admin') return NextResponse.json({ error: 'Only the Super Admin can change the hospital profile.' }, { status: 403 });
  revalidateTag(HOSPITAL_PROFILE_TAG);
  return NextResponse.json({ ok: true });
}
