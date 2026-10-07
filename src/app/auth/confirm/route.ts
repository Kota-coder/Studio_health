import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

// Landing point for links in Supabase auth emails (staff invites, password resets).
// The email templates must point here; see README "Supabase setup".
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  // Only allow redirects within this site.
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/set-password';

  const supabase = await getServerSupabase();
  let error: { message: string } | null = null;
  if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: 'Missing token' };
  }

  const url = request.nextUrl.clone();
  url.search = '';
  if (error) {
    url.pathname = '/login';
    url.searchParams.set('error', 'link_invalid');
  } else {
    url.pathname = destination;
  }
  return NextResponse.redirect(url);
}
