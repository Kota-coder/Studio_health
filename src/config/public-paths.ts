// Pages that can be opened without signing in (used by middleware.ts and the page guard).
export const PUBLIC_PATHS = ['/login', '/auth/confirm', '/set-password', '/forgot-password'];
export const isPublicPath = (pathname: string) => PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
