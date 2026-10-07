"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Edit3, PlusCircle, Stethoscope, HeartPulse, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PAGE_ROLES } from '@/config/permissions';
import { departments as departmentsRepo, patients as patientsRepo, staff as staffRepo } from '@/lib/data';
import type { Department, DepartmentMembers } from '@/types/department';
import type { StaffMember, StaffRole } from '@/types/staff';
import type { Patient } from '@/types/patient';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.departments;

export default function DepartmentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<DepartmentMembers>({});
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const allowed = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);

  useEffect(() => {
    if (!authIsLoading && !currentUser) router.replace('/login');
    else if (!authIsLoading && currentUser && !allowed) {
      toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
      router.replace('/dashboard');
    }
  }, [authIsLoading, currentUser, allowed, router, toast]);

  useEffect(() => {
    if (!allowed) return;
    Promise.all([departmentsRepo.list(), departmentsRepo.listMembers(), staffRepo.list(), patientsRepo.listBasic()])
      .then(([departmentList, memberMap, staffList, patientList]) => {
        setDepartments(departmentList);
        setMembers(memberMap);
        setStaff(staffList);
        setPatients(patientList);
      })
      .catch(error => {
        console.error("Error loading departments:", error);
        toast({ title: "Error", description: "Could not load departments.", variant: "destructive" });
      })
      .finally(() => setIsLoading(false));
  }, [allowed, toast]);

  const staffById = useMemo(() => new Map(staff.map(s => [s.id, s])), [staff]);
  const activePatientCount = (departmentId: number) =>
    patients.filter(p => p.departmentId === departmentId && p.condition !== 'Discharged').length;

  if (authIsLoading || (allowed && isLoading)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading departments...</p></div>;
  }
  if (!allowed) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Departments</h1>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-end gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <Button asChild>
            <Link href="/departments/form"><PlusCircle className="mr-2 h-4 w-4" /> Add Department</Link>
          </Button>
        </div>
      </header>

      <p className="text-sm text-muted-foreground mb-6 max-w-3xl">
        Each department has its own doctors and nurses. On a patient&apos;s page, choose the department and then the
        attending doctor and nurse from that department. The default doctor fee is suggested as the doctor&apos;s
        compensation for each case, and is paid through <span className="font-medium">Payments → Doctor Fee</span>.
      </p>

      {departments.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent>
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No departments yet. Add your first one, e.g. Cardiology or Orthopaedics.</p>
            <Button asChild><Link href="/departments/form"><PlusCircle className="mr-2 h-4 w-4" /> Add Department</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {departments.map(department => {
            const team = (members[department.id] ?? []).map(id => staffById.get(id)).filter((s): s is StaffMember => !!s);
            const doctors = team.filter(s => s.role === 'Doctor');
            const nurses = team.filter(s => s.role === 'Nurse');
            return (
              <Card key={department.id} className={department.active === false ? 'opacity-60' : undefined}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {department.name}
                      {department.active === false && <Badge variant="secondary">Inactive</Badge>}
                    </CardTitle>
                    {department.description && <CardDescription className="mt-1">{department.description}</CardDescription>}
                  </div>
                  <Button variant="outline" size="icon" asChild aria-label={`Edit ${department.name}`}>
                    <Link href={`/departments/form?id=${department.id}`}><Edit3 className="h-4 w-4" /></Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {activePatientCount(department.id)} active patients</span>
                    <span>Default doctor fee: {department.defaultDoctorFee != null ? `₹${department.defaultDoctorFee.toFixed(2)}` : 'not set'}</span>
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-1"><Stethoscope className="h-4 w-4 text-primary" /> Doctors</p>
                    <p className="text-muted-foreground">{doctors.map(d => d.name).join(', ') || 'None assigned'}</p>
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-1"><HeartPulse className="h-4 w-4 text-primary" /> Nurses</p>
                    <p className="text-muted-foreground">{nurses.map(n => n.name).join(', ') || 'None assigned'}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
