"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/app-link';
import { Building2, Edit3, HeartPulse, PlusCircle, Stethoscope, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { departments as departmentsRepo, patients as patientsRepo, staff as staffRepo } from '@/lib/data';
import { formatINR } from '@/lib/format';
import type { Department, DepartmentMembers } from '@/types/department';
import type { StaffMember } from '@/types/staff';

interface PageData {
  departments: Department[];
  members: DepartmentMembers;
  staff: StaffMember[];
  activePatients: Map<number, number>; // department id -> patients not discharged
}

// Departments with their doctors and nurses. Access is checked by PageGuard.
export default function DepartmentsPage() {
  const t = useT();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    Promise.all([departmentsRepo.list(), departmentsRepo.listMembers(), staffRepo.list(), patientsRepo.activeCountByDepartment()])
      .then(([departments, members, staff, activePatients]) => setData({ departments, members, staff, activePatients }))
      .catch(() => {
        toast({ title: 'Could not load departments', variant: 'destructive' });
        setData({ departments: [], members: {}, staff: [], activePatients: new Map() });
      });
  }, [toast]);

  const staffById = useMemo(() => new Map((data?.staff ?? []).map(s => [s.id, s])), [data]);

  if (!data) return <PageLoading />;
  const { departments, members, activePatients } = data;
  const addButton = <Button asChild><Link href="/departments/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Department')}</Link></Button>;

  return (
    <PageBody>
      <PageHeader icon={Building2} title={t('Departments')} actions={addButton}
        description={<>
          {t("Each department has its own doctors and nurses. On a patient's page, choose the department and then the attending doctor and nurse from that department.")}
          {isOn('doctorFees') && <> The default doctor fee is suggested as the doctor&apos;s compensation for each case, and is paid through <span className="font-medium">Payments → Doctor Fee</span>.</>}
        </>} />

      {departments.length === 0 ? (
        <Card className="py-10 text-center">
          <CardContent className="space-y-4">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('No departments yet. Add your first one, e.g. Cardiology or Orthopaedics.')}</p>
            {addButton}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {departments.map(department => {
            const team = (members[department.id] ?? []).map(id => staffById.get(id)).filter((s): s is StaffMember => !!s);
            const doctors = team.filter(s => s.role === 'Doctor');
            const nurses = team.filter(s => s.role === 'Nurse');
            return (
              <Card key={department.id} className={department.active === false ? 'opacity-60' : undefined}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2 break-words">
                      {department.name}
                      {department.active === false && <Badge variant="secondary">{t('Inactive')}</Badge>}
                    </CardTitle>
                    {department.description && <CardDescription className="mt-1">{department.description}</CardDescription>}
                  </div>
                  <Button variant="outline" size="icon" asChild aria-label={t('Edit {name}', { name: department.name })}>
                    <Link href={`/departments/form?id=${department.id}`}><Edit3 className="h-4 w-4" /></Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {activePatients.get(department.id) ?? 0} active patients</span>
                    {isOn('doctorFees') && <span>Default doctor fee: {department.defaultDoctorFee != null ? formatINR(department.defaultDoctorFee) : 'not set'}</span>}
                  </div>
                  <div>
                    <p className="flex items-center gap-1 font-medium"><Stethoscope className="h-4 w-4 text-primary" /> {t('Doctors')}</p>
                    <p className="text-muted-foreground">{doctors.map(d => d.name).join(', ') || 'None assigned'}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 font-medium"><HeartPulse className="h-4 w-4 text-primary" /> {t('Nurses')}</p>
                    <p className="text-muted-foreground">{nurses.map(n => n.name).join(', ') || 'None assigned'}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageBody>
  );
}
