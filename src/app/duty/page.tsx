"use client";

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useStaff } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ATTENDANCE_VIEW_ROLES, DUTY_MANAGER_ROLES } from '@/config/permissions';
import { departments as departmentsRepo, staff as staffRepo } from '@/lib/data';
import { MyDutyCard } from '@/components/duty/my-duty-card';
import { Roster } from '@/components/duty/roster';
import { OnDutyCheck } from '@/components/duty/on-duty-check';
import { AttendanceLog } from '@/components/duty/attendance-log';
import type { Department, DepartmentMembers } from '@/types/department';
import type { StaffMember } from '@/types/staff';

// Clocking in/out, the shift roster and attendance. Access is checked by PageGuard.
export default function DutyPage() {
  const t = useT();
  const { toast } = useToast();
  const currentUser = useStaff();
  const [data, setData] = useState<{ staff: StaffMember[]; departments: Department[]; members: DepartmentMembers } | null>(null);
  // Bumped after clocking in/out or editing attendance so the other views reload.
  const [refreshKey, setRefreshKey] = useState(0);

  const canManage = DUTY_MANAGER_ROLES.includes(currentUser.role);
  const canSeeAll = ATTENDANCE_VIEW_ROLES.includes(currentUser.role);

  useEffect(() => {
    Promise.all([staffRepo.list(), departmentsRepo.list(), departmentsRepo.listMembers()])
      .then(([staff, departments, members]) => setData({ staff, departments: departments.filter(d => d.active !== false), members }))
      .catch(() => {
        toast({ title: 'Could not load staff', variant: 'destructive' });
        setData({ staff: [], departments: [], members: {} });
      });
  }, [toast]);

  if (!data) return <PageLoading />;
  const { staff, departments, members } = data;
  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <PageBody>
      <PageHeader icon={CalendarClock} title={t('Duty Roster & Attendance')} />

      <MyDutyCard currentUser={currentUser} refreshKey={refreshKey} onChange={refresh} />

      <Tabs defaultValue="roster">
        <TabsList className="grid h-auto w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="roster" className="whitespace-normal py-2">{t('Schedule')}</TabsTrigger>
          <TabsTrigger value="check" className="whitespace-normal py-2">{t('Who was on duty')}</TabsTrigger>
          <TabsTrigger value="attendance" className="whitespace-normal py-2">{canSeeAll ? t('Attendance') : t('My attendance')}</TabsTrigger>
        </TabsList>
        <Card className="mt-3">
          <CardContent className="pt-6">
            <TabsContent value="roster" className="mt-0">
              <Roster staff={staff} departments={departments} members={members} canEdit={canManage} currentUserId={currentUser.id} refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="check" className="mt-0">
              <OnDutyCheck staff={staff} departments={departments} canSeeAllAttendance={canSeeAll} refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="attendance" className="mt-0">
              <AttendanceLog staff={staff} currentUser={currentUser} canSeeAll={canSeeAll} canManage={canManage} refreshKey={refreshKey} onChange={refresh} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </PageBody>
  );
}
