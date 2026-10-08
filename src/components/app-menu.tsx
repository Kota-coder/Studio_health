"use client";

import Link from 'next/link';
import { LogIn, LogOut, Menu as MenuIcon, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/components/language-provider';
import { useAuth } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { NAV_ITEMS, NAV_SECTIONS } from '@/config/navigation';

// The header menu: the pages this person's role may open, grouped by section, without the
// features the hospital has switched off.
export function AppMenu() {
  const { currentUser, logout, isLoading } = useAuth();
  const { isOn } = useFeatures();
  const t = useT();

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
    <DropdownMenu>
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
