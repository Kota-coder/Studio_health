"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/language-provider';
import { cn } from '@/lib/utils';

// Full-height "Loading…" placeholder while a page fetches its data.
export function PageLoading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4 text-muted-foreground" role="status">
      <p>{label ?? t('Loading...')}</p>
    </div>
  );
}

// The top of every page: icon, title, optional description, a back link for pages below
// another page (forms, details) and the page's main actions. List pages have no back link;
// the menu and the logo are always there.
export function PageHeader({ icon: Icon, title, description, back, actions, className }: {
  icon?: React.ElementType;
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label?: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <header className={cn('space-y-3', className)}>
      {back && (
        <Button variant="ghost" size="sm" asChild className="-ml-2 print:hidden">
          <Link href={back.href}><ArrowLeft className="mr-1 h-4 w-4" /> {back.label ?? t('Back')}</Link>
        </Button>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && <Icon className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
            {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
      </div>
    </header>
  );
}

// Standard page width and spacing.
export function PageBody({ children, width = 'wide', className }: { children: React.ReactNode; width?: 'narrow' | 'medium' | 'wide'; className?: string }) {
  const max = width === 'narrow' ? 'max-w-2xl' : width === 'medium' ? 'max-w-4xl' : '';
  return <div className={cn('container mx-auto space-y-6 p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0', max, className)}>{children}</div>;
}
