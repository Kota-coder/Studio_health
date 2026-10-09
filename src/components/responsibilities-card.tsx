"use client";

import { Building } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useT } from '@/components/language-provider';
import { MODULES, effectiveDisabled } from '@/config/modules';
import { ALL_ROLES } from '@/config/permissions';
import { DEPARTMENTS, rolesFor, type Duty, type Responsibilities } from '@/config/responsibilities';
import type { StaffRole } from '@/types/staff';

const ROLES = ALL_ROLES.filter(r => r !== 'Super Admin');

// Hospital Profile: which roles carry out each department's duties. The database enforces it.
export function ResponsibilitiesCard({ value, onChange, disabledModules }: {
  value: Responsibilities;
  onChange: (value: Responsibilities) => void;
  disabledModules: string[];
}) {
  const t = useT();
  const off = effectiveDisabled(disabledModules);
  const toggle = (duty: Duty, role: StaffRole, on: boolean) => {
    const current = rolesFor(duty, value);
    onChange({ ...value, [duty]: on ? [...current, role] : current.filter(r => r !== role) });
  };

  return (
    <Card id="departments" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Building className="h-5 w-5 text-primary" /> {t('Departments and responsibilities')}</CardTitle>
        <CardDescription>
          {t('Which roles do each department\'s work. Doctors and nurses ask for tests and medicines; the laboratory and pharmacy carry them out; payments are taken by the department responsible. The Super Admin can always step in.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {DEPARTMENTS.map(dept => (
          <section key={dept.name} className="space-y-2">
            <div>
              <h3 className="font-semibold">{t(dept.name)}</h3>
              <p className="text-xs text-muted-foreground">{t(dept.description)}</p>
            </div>
            <ul className="divide-y rounded-md border">
              {dept.duties.map(duty => {
                const moduleOff = duty.module && off.has(duty.module);
                const roles = rolesFor(duty.key, value);
                return (
                  <li key={duty.key} className="space-y-2 p-3">
                    <div>
                      <p className="text-sm font-medium">{t(duty.label)}</p>
                      <p className="text-xs text-muted-foreground">{t(duty.detail)}</p>
                      {moduleOff && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          {t('{feature} is off: everyone works as before until it is on.', { feature: t(MODULES.find(m => m.key === duty.module)?.label ?? '') })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {ROLES.map(role => (
                        <label key={role} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={roles.includes(role)} onCheckedChange={v => toggle(duty.key, role, v === true)} aria-label={`${t(duty.label)}: ${t(role)}`} />
                          {t(role)}
                        </label>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
