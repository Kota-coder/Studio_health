"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ATTENDANCE_VIEW_ROLES, DUTY_MANAGER_ROLES, PAGE_ROLES } from '@/config/permissions';
import { departments as departmentsRepo, staff as staffRepo } from '@/lib/data';
import { MyDutyCard } from '@/components/duty/my-duty-card';
import { Roster } from '@/components/duty/roster';
import { OnDutyCheck } from '@/components/duty/on-duty-check';
import { AttendanceLog } from '@/components/duty/attendance-log';
import type { Department, DepartmentMembers } from '@/types/department';
import type { StaffMember, StaffRole } from '@/types/staff';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.duty;

export default function DutyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<DepartmentMembers>({});
  const [isLoading, setIsLoading] = useState(true);
  // Bumped after clocking in/out or editing attendance so the other views reload.
  const [refreshKey, setRefreshKey] = useState(0);

  const allowed = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);
  const canManage = !!currentUser && DUTY_MANAGER_ROLES.includes(currentUser.role);
  const canSeeAll = !!currentUser && ATTENDANCE_VIEW_ROLES.includes(currentUser.role);

  useEffect(() => {
    if (!authIsLoading && !currentUser) router.replace('/login');
    else if (!authIsLoading && currentUser && !allowed) router.replace('/dashboard');
  }, [authIsLoading, currentUser, allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    Promise.all([staffRepo.list(), departmentsRepo.list(), departmentsRepo.listMembers()])
      .then(([staffList, departmentList, memberMap]) => {
        setStaff(staffList);
        setDepartments(departmentList.filter(d => d.active !== false));
        setMembers(memberMap);
      })
      .catch(error => {
        console.error('Error loading duty roster:', error);
        toast({ title: 'Error', description: 'Could not load staff.', variant: 'destructive' });
      })
      .finally(() => setIsLoading(false));
  }, [allowed, toast]);

  if (authIsLoading || (allowed && isLoading)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading duty roster...</p></div>;
  }
  if (!allowed || !currentUser) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-8 w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Duty Roster &amp; Attendance</h1>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
        </Button>
      </header>

      <MyDutyCard currentUser={currentUser} refreshKey={refreshKey} onChange={refresh} />

      <Tabs defaultValue="roster">
        <TabsList className="grid h-auto w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="roster" className="whitespace-normal py-2">Schedule</TabsTrigger>
          <TabsTrigger value="check" className="whitespace-normal py-2">Who was on duty</TabsTrigger>
          <TabsTrigger value="attendance" className="whitespace-normal py-2">{canSeeAll ? 'Attendance' : 'My attendance'}</TabsTrigger>
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
    </div>
  );
}
