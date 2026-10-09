"use client";

import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useT } from '@/components/language-provider';
import { NAV_ITEMS, NAV_SECTIONS } from '@/config/navigation';
import { ALL_ROLES, rolesForPage, type PageAccess, type PageKey } from '@/config/permissions';
import type { StaffRole } from '@/types/staff';

const ROLES = ALL_ROLES.filter(r => r !== 'Super Admin');
// The pages that hold billing and payment information.
const MONEY_PAGES: PageKey[] = ['billing', 'payments', 'financialDashboard'];
// Pages the Super Admin alone may open, and always can.
const FIXED: PageKey[] = ['hospitalProfile', 'paymentMethods', 'admin'];

// Hospital Profile → Who can see what: which roles may open each page. The Super Admin can
// always open everything. Billing, payments, the financial dashboard and inventory are also
// enforced by the database, so hidden people can't read that data any other way.
export function PageAccessCard({ value, onChange }: { value: PageAccess; onChange: (value: PageAccess) => void }) {
  const t = useT();
  const pages = NAV_ITEMS.filter((item, i, all) => !FIXED.includes(item.page) && all.findIndex(x => x.page === item.page) === i);

  const toggle = (page: PageKey, role: StaffRole, on: boolean) => {
    const current = rolesForPage(page, value);
    onChange({ ...value, [page]: on ? [...current, role] : current.filter(r => r !== role) });
  };
  // Doctors and nurses (the clinical staff) can't see billing, payments or the financial dashboard.
  const hideMoneyFromClinical = () =>
    onChange({ ...value, ...Object.fromEntries(MONEY_PAGES.map(p => [p, rolesForPage(p, value).filter(r => r !== 'Doctor' && r !== 'Nurse')])) });
  const showMoneyToClinical = () => {
    const next = { ...value };
    for (const p of MONEY_PAGES) delete next[p];
    onChange(next);
  };
  const clinicalHidden = MONEY_PAGES.every(p => !rolesForPage(p, value).some(r => r === 'Doctor' || r === 'Nurse'));

  return (
    <Card id="access" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" /> {t('Who can see what')}</CardTitle>
        <CardDescription>
          {t('Tick the roles that may open each page. People without access do not see the page in their menu, and for billing, payments, the financial dashboard and inventory the database also stops them reading that information. The Super Admin can always open everything.')}
        </CardDescription>
        <div className="pt-1">
          {clinicalHidden ? (
            <Button type="button" variant="outline" size="sm" onClick={showMoneyToClinical}><Eye className="mr-2 h-4 w-4" /> {t('Show billing and payments to doctors and nurses again')}</Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={hideMoneyFromClinical}><EyeOff className="mr-2 h-4 w-4" /> {t('Hide billing and payments from doctors and nurses')}</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {NAV_SECTIONS.map(section => {
          const items = pages.filter(p => p.section === section);
          if (items.length === 0) return null;
          return (
            <section key={section} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{t(section)}</h3>
              <ul className="divide-y rounded-md border">
                {items.map(item => {
                  const roles = rolesForPage(item.page, value);
                  return (
                    <li key={item.page} className="space-y-2 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium"><item.icon className="h-4 w-4 text-primary" />{t(item.label)}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {ROLES.map(role => (
                          <label key={role} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={roles.includes(role)} onCheckedChange={v => toggle(item.page, role, v === true)}
                              aria-label={`${t(item.label)}: ${t(role)}`} />
                            {t(role)}
                          </label>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
