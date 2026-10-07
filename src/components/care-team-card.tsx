"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { departments as departmentsRepo, patients as patientsRepo, referringDoctors as referringDoctorsRepo } from '@/lib/data';
import type { ReferringDoctor } from '@/types/referringDoctor';
import type { Department, DepartmentMembers } from '@/types/department';
import type { Patient } from '@/types/patient';
import type { StaffMember, StaffRole } from '@/types/staff';

// Roles allowed to set a doctor's fee (the database enforces the same rule).
const FEE_ROLES: StaffRole[] = ['Super Admin', 'Admin', 'Accounts'];
const NONE = 'none';

interface CareTeamCardProps {
  patient: Patient;
  staff: StaffMember[];
  currentUser: StaffMember;
  onSaved: () => Promise<void> | void;
}

// Department, attending doctor and nurse, and the doctor's fee for this case.
export function CareTeamCard({ patient, staff, currentUser, onSaved }: CareTeamCardProps) {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<DepartmentMembers>({});
  const [departmentId, setDepartmentId] = useState<string>(patient.departmentId ? String(patient.departmentId) : NONE);
  const [doctorId, setDoctorId] = useState<string>(patient.attendingDoctorId ? String(patient.attendingDoctorId) : NONE);
  const [nurseId, setNurseId] = useState<string>(patient.attendingNurseId ? String(patient.attendingNurseId) : NONE);
  const [fee, setFee] = useState<string>(patient.doctorFee != null ? String(patient.doctorFee) : '');
  const [referralFee, setReferralFee] = useState<string>(patient.referralFee != null ? String(patient.referralFee) : '');
  const [referringDoctor, setReferringDoctor] = useState<ReferringDoctor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canEditTeam = currentUser.role !== 'Accounts';
  const canEditFee = FEE_ROLES.includes(currentUser.role);
  const feePaid = patient.doctorFeeStatus === 'Paid';
  const referralPaid = patient.referralFeeStatus === 'Paid';

  useEffect(() => {
    Promise.all([departmentsRepo.list(), departmentsRepo.listMembers()])
      .then(([departmentList, memberMap]) => { setDepartments(departmentList); setMembers(memberMap); })
      .catch(error => console.error('Could not load departments', error));
  }, []);

  useEffect(() => {
    if (!patient.referredDoctorId) { setReferringDoctor(null); return; }
    referringDoctorsRepo.get(patient.referredDoctorId)
      .then(setReferringDoctor)
      .catch(error => console.error('Could not load referring doctor', error));
  }, [patient.referredDoctorId]);

  // Keep the form in step when the patient is reloaded after a save.
  useEffect(() => {
    setDepartmentId(patient.departmentId ? String(patient.departmentId) : NONE);
    setDoctorId(patient.attendingDoctorId ? String(patient.attendingDoctorId) : NONE);
    setNurseId(patient.attendingNurseId ? String(patient.attendingNurseId) : NONE);
    setFee(patient.doctorFee != null ? String(patient.doctorFee) : '');
    setReferralFee(patient.referralFee != null ? String(patient.referralFee) : '');
  }, [patient.departmentId, patient.attendingDoctorId, patient.attendingNurseId, patient.doctorFee, patient.referralFee]);

  const department = departments.find(d => String(d.id) === departmentId);
  const team = useMemo(() => {
    const ids = new Set(department ? members[department.id] ?? [] : []);
    return staff.filter(s => ids.has(s.id));
  }, [department, members, staff]);
  const doctors = team.filter(s => s.role === 'Doctor');
  const nurses = team.filter(s => s.role === 'Nurse');
  const staffName = (id?: number | null) => staff.find(s => s.id === id)?.name;

  const handleDepartmentChange = (value: string) => {
    setDepartmentId(value);
    // A new department means a new team; clear choices that aren't in it.
    const ids = new Set(value === NONE ? [] : members[Number(value)] ?? []);
    if (!ids.has(Number(doctorId))) setDoctorId(NONE);
    if (!ids.has(Number(nurseId))) setNurseId(NONE);
  };

  const handleDoctorChange = (value: string) => {
    setDoctorId(value);
    if (canEditFee && !feePaid && fee.trim() === '' && value !== NONE && department?.defaultDoctorFee != null) {
      setFee(String(department.defaultDoctorFee));
    }
  };

  const handleSave = async () => {
    const feeValue = fee.trim() === '' ? null : Number(fee);
    const referralFeeValue = referralFee.trim() === '' ? null : Number(referralFee);
    for (const value of [feeValue, referralFeeValue]) {
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        toast({ title: "Invalid fee", description: "Enter fees of 0 or more, or leave them empty.", variant: "destructive" });
        return;
      }
    }
    const newDepartmentId = departmentId === NONE ? null : Number(departmentId);
    const newDoctorId = doctorId === NONE ? null : Number(doctorId);
    const newNurseId = nurseId === NONE ? null : Number(nurseId);

    // The attending doctor and nurse are also "assigned", so they can add care notes.
    const assigned = new Set(patient.assignedStaffIds ?? []);
    if (newDoctorId) assigned.add(newDoctorId);
    if (newNurseId) assigned.add(newNurseId);

    const changes: Partial<Patient> = {
      departmentId: newDepartmentId,
      attendingDoctorId: newDoctorId,
      attendingNurseId: newNurseId,
      assignedStaffIds: [...assigned],
    };
    if (canEditFee && !feePaid) changes.doctorFee = feeValue;
    if (canEditFee && !referralPaid && patient.referredDoctorId) changes.referralFee = referralFeeValue;

    const details = [
      `Department: ${departments.find(d => d.id === newDepartmentId)?.name ?? 'none'}`,
      `Doctor: ${staffName(newDoctorId) ?? 'none'}`,
      `Nurse: ${staffName(newNurseId) ?? 'none'}`,
      ...(changes.doctorFee !== undefined ? [`Doctor fee: ${feeValue != null ? `₹${feeValue.toFixed(2)}` : 'not set'}`] : []),
      ...(changes.referralFee !== undefined ? [`Referral fee: ${referralFeeValue != null ? `₹${referralFeeValue.toFixed(2)}` : 'not set'}`] : []),
    ].join('; ');

    setIsSaving(true);
    try {
      await patientsRepo.update(patient.id, changes, { actionType: 'Care Team Updated', details: `${details}.` });
      toast({ title: "Care team saved", description: details });
      await onSaved();
    } catch (error) {
      toast({ title: "Save Error", description: error instanceof Error ? error.message : 'Could not save the care team.', variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const visibleDepartments = departments.filter(d => d.active !== false || String(d.id) === departmentId);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center"><Building2 className="mr-2 h-5 w-5 text-primary" />Department &amp; Care Team</CardTitle>
        <CardDescription>The department treating this patient, the doctor and nurse in charge, the doctor&apos;s fee for the case and any referral fee.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No departments yet. {currentUser.role === 'Super Admin' || currentUser.role === 'Admin'
              ? <Link href="/departments/form" className="text-primary underline">Add one in Departments</Link>
              : 'Ask an admin to add departments.'}
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor="careDepartment">Department</Label>
              <Select value={departmentId} onValueChange={handleDepartmentChange} disabled={!canEditTeam}>
                <SelectTrigger id="careDepartment"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No department</SelectItem>
                  {visibleDepartments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="careDoctor">Attending doctor</Label>
              <Select value={doctorId} onValueChange={handleDoctorChange} disabled={!canEditTeam || !department || feePaid}>
                <SelectTrigger id="careDoctor"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not assigned</SelectItem>
                  {doctors.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {department && doctors.length === 0 && <p className="text-xs text-muted-foreground mt-1">No doctors in {department.name} yet.</p>}
            </div>
            <div>
              <Label htmlFor="careNurse">Nurse in charge</Label>
              <Select value={nurseId} onValueChange={setNurseId} disabled={!canEditTeam || !department}>
                <SelectTrigger id="careNurse"><SelectValue placeholder="Select nurse" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not assigned</SelectItem>
                  {nurses.map(n => <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {department && nurses.length === 0 && <p className="text-xs text-muted-foreground mt-1">No nurses in {department.name} yet.</p>}
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="careFee">Doctor fee for this case (₹)</Label>
                <Badge variant={feePaid ? 'default' : 'secondary'}>{feePaid ? `Paid${patient.doctorFeePaymentId ? ` · ${patient.doctorFeePaymentId}` : ''}` : 'Pending'}</Badge>
              </div>
              <Input id="careFee" type="number" inputMode="decimal" min={0} value={fee} onChange={e => setFee(e.target.value)}
                disabled={!canEditFee || feePaid} placeholder={department?.defaultDoctorFee != null ? `Default ₹${department.defaultDoctorFee}` : 'e.g. 1500'} />
              <p className="text-xs text-muted-foreground mt-1">
                {feePaid
                  ? 'The fee has been paid, so the doctor and fee can no longer change.'
                  : canEditFee
                    ? 'Paid to the attending doctor through Payments → Doctor Fee.'
                    : 'Only Admin or Accounts staff can set the fee.'}
              </p>
            </div>
          </>
        )}
            {patient.referredDoctorId && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="careReferralFee">Referral fee (₹)</Label>
                  <Badge variant={referralPaid ? 'default' : 'secondary'}>{referralPaid ? `Paid${patient.referralFeePaymentId ? ` · ${patient.referralFeePaymentId}` : ''}` : 'Pending'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Referred by {referringDoctor ? `${referringDoctor.name}${referringDoctor.location ? ` (${referringDoctor.location})` : ''}` : '…'}</p>
                <Input id="careReferralFee" type="number" inputMode="decimal" min={0} value={referralFee} onChange={e => setReferralFee(e.target.value)}
                  disabled={!canEditFee || referralPaid}
                  placeholder={referringDoctor?.defaultReferralFee != null ? `Default ₹${referringDoctor.defaultReferralFee}` : 'e.g. 500'} />
                <p className="text-xs text-muted-foreground">
                  {referralPaid
                    ? 'The referral fee has been paid.'
                    : referralFee.trim() === '' && referringDoctor?.defaultReferralFee != null
                      ? `If left empty, the doctor's default of ₹${referringDoctor.defaultReferralFee.toFixed(2)} is used when paying through Payments → Referral/CC.`
                      : 'Paid to the referring doctor through Payments → Referral/CC.'}
                </p>
              </div>
            )}
            {(canEditTeam || canEditFee) && (departments.length > 0 || patient.referredDoctorId) && (
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Care Team'}
              </Button>
            )}
      </CardContent>
    </Card>
  );
}
