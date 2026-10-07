import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Pages reachable without a session.
const PUBLIC_PATHS = ['/login', '/auth/confirm', '/set-password', '/forgot-password', '/reset-password', '/signup'];

const SETUP_MESSAGE = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CardioCare setup needed</title>
<body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1>CardioCare isn't connected to its database yet</h1>
<p>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your
<code>.env</code> file (see <code>.env.example</code> and the README's "Supabase setup"), then restart the app.</p>
</body>`;

export async function middleware(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new NextResponse(SETUP_MESSAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  let response = NextResponse.next({ request });

  // Refresh the Supabase session cookie on every request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && !PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    response = redirect;
  }

  // Security headers for production
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // CSP for security
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: ${supabaseOrigin}; connect-src 'self' ${supabaseOrigin};`
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, apple-icon.png, manifest.webmanifest, /icons, sw.js and offline.html (installed-app files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|apple-icon.png|manifest.webmanifest|icons/|sw.js|offline.html).*)',
  ],
};
