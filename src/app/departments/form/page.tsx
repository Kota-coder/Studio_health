"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { PAGE_ROLES } from '@/config/permissions';
import { departments as departmentsRepo, staff as staffRepo } from '@/lib/data';
import type { StaffMember, StaffRole } from '@/types/staff';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.departments;

function StaffChecklist({ title, people, selected, onToggle }: {
  title: string;
  people: StaffMember[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  return (
    <div>
      <Label className="text-base">{title}</Label>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-1">No {title.toLowerCase()} in Staff Management yet.</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {people.map(person => (
            <label key={person.id} htmlFor={`staff-${person.id}`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50">
              <Checkbox id={`staff-${person.id}`} checked={selected.has(person.id)} onCheckedChange={() => onToggle(person.id)} className="h-5 w-5" />
              <span className="text-sm">{person.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function DepartmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const { isOn } = useFeatures();
  const departmentId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
  const isEditMode = departmentId !== null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultDoctorFee, setDefaultDoctorFee] = useState('');
  const [active, setActive] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());
  const [nameError, setNameError] = useState<string | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const allowed = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);

  useEffect(() => {
    if (!authIsLoading && !currentUser) router.replace('/login');
    else if (!authIsLoading && currentUser && !allowed) router.replace('/dashboard');
  }, [authIsLoading, currentUser, allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    const load = async () => {
      try {
        setStaff(await staffRepo.list());
        if (departmentId !== null) {
          const [department, members] = await Promise.all([departmentsRepo.get(departmentId), departmentsRepo.listMembers()]);
          if (!department) {
            toast({ title: "Error", description: "Department not found.", variant: "destructive" });
            router.push('/departments');
            return;
          }
          setName(department.name);
          setDescription(department.description || '');
          setDefaultDoctorFee(department.defaultDoctorFee != null ? String(department.defaultDoctorFee) : '');
          setActive(department.active !== false);
          setMemberIds(new Set(members[departmentId] ?? []));
        }
      } catch (error) {
        console.error("Error loading department:", error);
        toast({ title: "Error", description: "Could not load department details.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [allowed, departmentId, router, toast]);

  const toggleMember = (id: number) => setMemberIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleSave = async () => {
    const problems: string[] = [];
    const fee = defaultDoctorFee.trim() === '' ? null : Number(defaultDoctorFee);
    setNameError(name.trim() ? null : 'Department name is required.');
    if (!name.trim()) problems.push('Department name is required.');
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
      setFeeError('Enter a fee of 0 or more, or leave it empty.');
      problems.push('Enter a fee of 0 or more, or leave it empty.');
    } else {
      setFeeError(null);
    }
    if (problems.length > 0) {
      toast({ title: "Please fix the form", description: problems.join(' '), variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const fields = { name: name.trim(), description: description.trim(), defaultDoctorFee: fee, active };
      const id = isEditMode && departmentId !== null
        ? (await departmentsRepo.update(departmentId, fields)).id
        : (await departmentsRepo.create(fields)).id;
      await departmentsRepo.setMembers(id, [...memberIds]);
      toast({ title: "Saved", description: `Department ${fields.name} saved.` });
      router.push('/departments');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the department.';
      toast({
        title: "Save Error",
        description: message.includes('duplicate key') ? 'A department with this name already exists.' : message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (departmentId === null || !confirm(`Delete the ${name} department? Its patients stay, but without a department.`)) return;
    try {
      await departmentsRepo.remove(departmentId);
      toast({ title: "Deleted", description: `Department ${name} deleted.` });
      router.push('/departments');
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : 'Could not delete the department.', variant: "destructive" });
    }
  };

  if (authIsLoading || (allowed && isLoading)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }
  if (!allowed) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  const doctors = staff.filter(s => s.role === 'Doctor');
  const nurses = staff.filter(s => s.role === 'Nurse');

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> {isEditMode ? 'Edit Department' : 'Add Department'}</CardTitle>
          <CardDescription>Choose the doctors and nurses who work in this department. A person can belong to more than one department.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="name">Department Name *</Label>
            <Input id="name" value={name} placeholder="e.g. Cardiology" aria-invalid={!!nameError} className={nameError ? 'border-destructive' : undefined}
              onChange={e => { setName(e.target.value); setNameError(null); }} />
            {nameError && <p className="text-destructive text-sm mt-1">{nameError}</p>}
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          {isOn('doctorFees') && (
          <div>
            <Label htmlFor="defaultDoctorFee">Default doctor fee per case (₹)</Label>
            <Input id="defaultDoctorFee" type="number" inputMode="decimal" min={0} value={defaultDoctorFee} placeholder="e.g. 1500"
              aria-invalid={!!feeError} className={feeError ? 'border-destructive' : undefined}
              onChange={e => { setDefaultDoctorFee(e.target.value); setFeeError(null); }} />
            {feeError
              ? <p className="text-destructive text-sm mt-1">{feeError}</p>
              : <p className="text-xs text-muted-foreground mt-1">Suggested when a doctor is assigned to a patient in this department; it can be changed per case.</p>}
          </div>
          )}
          <div className="flex items-center gap-3">
            <Switch id="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active">Active (shown when assigning patients)</Label>
          </div>
          <StaffChecklist title="Doctors" people={doctors} selected={memberIds} onToggle={toggleMember} />
          <StaffChecklist title="Nurses" people={nurses} selected={memberIds} onToggle={toggleMember} />
        </CardContent>
        <CardFooter className="flex flex-col-reverse sm:flex-row justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/departments')}><ArrowLeft className="mr-2 h-4 w-4" /> Cancel</Button>
            {isEditMode && (
              <Button variant="ghost" className="text-destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
            )}
          </div>
          <Button onClick={handleSave} disabled={isSaving}><Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Department'}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function DepartmentFormPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>}>
      <DepartmentForm />
    </Suspense>
  );
}
