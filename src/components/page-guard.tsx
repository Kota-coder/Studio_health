"use client";

import Link from '@/components/app-link';
import { usePathname } from 'next/navigation';
import { EyeOff, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoading } from '@/components/page';
import { useBranding } from '@/components/branding-provider';
import { useT } from '@/components/language-provider';
import { useAuth } from '@/context/AuthContext';
import { isModuleEnabled, moduleByKey } from '@/config/modules';
import { navItemForPath, rolesForPath } from '@/config/navigation';
import { isPublicPath } from '@/config/public-paths';

function Notice({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-lg p-4 sm:p-6">
      <Card>
        <CardContent className="space-y-3 pt-6 text-center">
          <Icon className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">{title}</p>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

// Every signed-in page goes through here: it waits for the login, then checks the person's
// role (src/config/navigation.ts) and whether the hospital uses that feature
// (src/config/modules.ts). Pages inside can rely on useStaff() having a signed-in user.
// Signed-out visitors are sent to /login by middleware.ts before the page loads.
export function PageGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const { currentUser, isLoading } = useAuth();
  const { profile } = useBranding();
  const t = useT();

  if (isPublicPath(pathname)) return <>{children}</>;
  if (isLoading) return <PageLoading />;
  if (!currentUser) return <PageLoading />; // the session ended; middleware redirects on the next navigation

  const page = navItemForPath(pathname);
  const pageName = t(page?.label ?? 'this page');
  const roles = rolesForPath(pathname);
  if (roles && !roles.includes(currentUser.role)) {
    return (
      <Notice icon={ShieldAlert} title={t("You don't have access to this page")}>
        <p className="text-sm text-muted-foreground">{t('Your role ({role}) cannot open {page}.', { role: t(currentUser.role), page: pageName })}</p>
        <Button asChild variant="outline"><Link href="/dashboard">{t('Go to the Patient Dashboard')}</Link></Button>
      </Notice>
    );
  }

  const feature = moduleByKey(page?.module);
  if (feature && !isModuleEnabled(profile.disabledModules, feature.key)) {
    const superAdmin = currentUser.role === 'Super Admin';
    return (
      <Notice icon={EyeOff} title={t('{page} is turned off', { page: t(feature.label) })}>
        <p className="text-sm text-muted-foreground">
          {t("{hospital} doesn't use this section.", { hospital: profile.name })}{' '}
          {superAdmin ? t('You can turn it on under Hospital Profile → Menus.') : t('Ask your Super Admin if you need it.')}
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline"><Link href="/dashboard">{t('Patient Dashboard')}</Link></Button>
          {superAdmin && <Button asChild><Link href="/hospital-profile#menus">{t('Hospital Profile')}</Link></Button>}
        </div>
      </Notice>
    );
  }

  return <>{children}</>;
}
