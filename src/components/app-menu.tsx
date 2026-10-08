"use client";

import { useState } from 'react';
import Link from '@/components/app-link';
import { ArrowLeftRight, Check, LogIn, LogOut, Menu as MenuIcon, PlusCircle, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/components/language-provider';
import { useBranding } from '@/components/branding-provider';
import { hospitalLinks as hospitalLinksRepo } from '@/lib/data';
import type { HospitalLink } from '@/types/hospitalLink';
import { useAuth } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { NAV_ITEMS, NAV_SECTIONS } from '@/config/navigation';

// The header menu: the pages this person's role may open, grouped by section, without the
// features the hospital has switched off.
export function AppMenu() {
  const { currentUser, logout, isLoading } = useAuth();
  const { isOn } = useFeatures();
  const { profile } = useBranding();
  const t = useT();
  // The Super Admin's other hospitals, read when the menu opens (from the in-tab cache, so
  // only the first time or after the list is edited does it reach the database).
  const [links, setLinks] = useState<HospitalLink[] | null>(null);
  const superAdmin = currentUser?.role === 'Super Admin';
  const onOpenChange = (open: boolean) => {
    if (open && superAdmin) hospitalLinksRepo.list().then(setLinks).catch(() => setLinks(prev => prev ?? []));
  };
  const here = typeof window === 'undefined' ? '' : window.location.origin;

  if (isLoading) {
    return <Button variant="ghost" size="icon" aria-label={t('Open menu')} disabled><MenuIcon className="h-5 w-5 opacity-50" /></Button>;
  }

  const sections = currentUser
    ? NAV_SECTIONS.map(section => ({
        section,
        items: NAV_ITEMS.filter(i => i.section === section && i.roles.includes(currentUser.role) && (!i.module || isOn(i.module))),
      })).filter(s => s.items.length > 0)
    : [];

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('Open menu')}><MenuIcon className="h-5 w-5" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[80vh] w-64 overflow-y-auto">
        {currentUser ? (
          <>
            <DropdownMenuLabel className="flex items-center font-normal">
              <UserCircle className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate"><span className="font-semibold">{currentUser.name}</span> · {t(currentUser.role)}</span>
            </DropdownMenuLabel>
            {sections.map(({ section, items }) => (
              <div key={section}>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">{t(section)}</DropdownMenuLabel>
                {items.map(item => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="flex w-full items-center">
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{t(item.label)}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
            {superAdmin && links !== null && (
              <div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">{t('Switch hospital')}</DropdownMenuLabel>
                <DropdownMenuItem disabled className="flex w-full items-center opacity-100">
                  <Check className="mr-2 h-4 w-4 text-primary" /><span className="truncate font-medium">{profile.name}</span>
                </DropdownMenuItem>
                {links.filter(l => !sameSite(l.url, here)).map(link => (
                  <DropdownMenuItem key={link.id} asChild>
                    <a href={link.url} className="flex w-full items-center">
                      <ArrowLeftRight className="mr-2 h-4 w-4" /><span className="truncate">{link.name}</span>
                    </a>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem asChild>
                  <Link href="/hospital-profile#hospitals" className="flex w-full items-center text-muted-foreground">
                    <PlusCircle className="mr-2 h-4 w-4" /><span>{links.length ? t('Manage hospitals') : t('Add another hospital')}</span>
                  </Link>
                </DropdownMenuItem>
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="flex w-full cursor-pointer items-center">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('Logout')}</span>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/login" className="flex w-full items-center"><LogIn className="mr-2 h-4 w-4" /><span>{t('Login')}</span></Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// True when a saved link points at the hospital this page is on.
function sameSite(url: string, origin: string) {
  try { return new URL(url).origin === origin; } catch { return false; }
}
