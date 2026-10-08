"use client";

import { forwardRef, type ComponentProps } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';

// Next.js prefetches every link that scrolls into view (about 11 KB each, plus the page's
// code, and a server call for patient pages). Here a page is fetched only when a pointer
// hovers or a finger touches the link, just before the click, so pages still open at once
// without downloading pages nobody opens.
const AppLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(function AppLink(
  { prefetch = false, href, onMouseEnter, onTouchStart, ...props }, ref,
) {
  const router = useRouter();
  const warm = () => { if (typeof href === 'string' && href.startsWith('/')) router.prefetch(href); };
  return (
    <NextLink ref={ref} href={href} prefetch={prefetch}
      onMouseEnter={e => { warm(); onMouseEnter?.(e); }}
      onTouchStart={e => { warm(); onTouchStart?.(e); }}
      {...props} />
  );
});

export default AppLink;
