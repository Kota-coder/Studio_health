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
import { useT } from '@/components/language-provider';
import { FEE_ROLES } from '@/config/permissions';
import { useStaff } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFeatures } from '@/hooks/use-features';
import { departments as departmentsRepo, patients as patientsRepo } from '@/lib/data';
import { formatINR } from '@/lib/format';
import { billedProcedures, referralLines, referralTotal, type BilledProcedure } from '@/lib/referralFee';
import type { Bill } from '@/types/billing';
import type { ReferringDoctor } from '@/types/referringDoctor';
import type { Department, DepartmentMembers } from '@/types/department';
import type { Patient, ReferralFeeBasis } from '@/types/patient';
import type { StaffMember } from '@/types/staff';

const NONE = 'none';

interface CareTeamCardProps {
  patient: Patient;
  staff: StaffMember[];
  bills: Bill[]; // the patient's bills (for referral % per procedure)
  referringDoctor: ReferringDoctor | null; // who referred the patient, if anyone
  onSaved: () => Promise<void> | void;
}

// Department, attending doctor and nurse, and the doctor's fee for this case.
export function CareTeamCard({ patient, staff, bills, referringDoctor, onSaved }: CareTeamCardProps) {
  const t = useT();
  const { toast } = useToast();
  const currentUser = useStaff();
  const { isOn } = useFeatures();
  // Parts the hospital uses (Hospital Profile → Menus).
  const showTeam = isOn('departments');
  const showDoctorFee = isOn('doctorFees');
  const showReferral = isOn('referralFees') && !!patient.referredDoctorId;
  const percentAllowed = isOn('billing'); // a % of what was billed
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<DepartmentMembers>({});
  const [departmentId, setDepartmentId] = useState<string>(patient.departmentId ? String(patient.departmentId) : NONE);
  const [doctorId, setDoctorId] = useState<string>(patient.attendingDoctorId ? String(patient.attendingDoctorId) : NONE);
  const [nurseId, setNurseId] = useState<string>(patient.attendingNurseId ? String(patient.attendingNurseId) : NONE);
  const [fee, setFee] = useState<string>(patient.doctorFee != null ? String(patient.doctorFee) : '');
  const [referralFee, setReferralFee] = useState<string>(patient.referralFee != null ? String(patient.referralFee) : '');
  const [referralMode, setReferralMode] = useState<'fixed' | 'percent'>(patient.referralFeeBasis?.mode === 'percent' ? 'percent' : 'fixed');
  const [percents, setPercents] = useState<Record<string, string>>(() => savedPercents(patient.referralFeeBasis));
  const [isSaving, setIsSaving] = useState(false);

  const canEditTeam = currentUser.role !== 'Accounts';
  const canEditFee = FEE_ROLES.includes(currentUser.role);
  const feePaid = patient.doctorFeeStatus === 'Paid';
  const referralPaid = patient.referralFeeStatus === 'Paid';
  const mode = percentAllowed || referralPaid ? referralMode : 'fixed';

  useEffect(() => {
    if (!showTeam) return;
    Promise.all([departmentsRepo.list(), departmentsRepo.listMembers()])
      .then(([departmentList, memberMap]) => { setDepartments(departmentList); setMembers(memberMap); })
      .catch(error => console.error('Could not load departments', error));
  }, [showTeam]);

  const procedures = useMemo<BilledProcedure[]>(() => (patient.referredDoctorId ? billedProcedures(bills) : []), [bills, patient.referredDoctorId]);

  // No fee chosen yet: start in the referring doctor's usual mode.
  useEffect(() => {
    if (referringDoctor?.defaultReferralPercent != null && patient.referralFee == null && !patient.referralFeeBasis) setReferralMode('percent');
  }, [referringDoctor?.defaultReferralPercent, patient.referralFee, patient.referralFeeBasis]);

  // Keep the form in step when the patient is reloaded after a save.
  useEffect(() => {
    setDepartmentId(patient.departmentId ? String(patient.departmentId) : NONE);
    setDoctorId(patient.attendingDoctorId ? String(patient.attendingDoctorId) : NONE);
    setNurseId(patient.attendingNurseId ? String(patient.attendingNurseId) : NONE);
    setFee(patient.doctorFee != null ? String(patient.doctorFee) : '');
    setReferralFee(patient.referralFee != null ? String(patient.referralFee) : '');
    setReferralMode(patient.referralFeeBasis?.mode === 'percent' ? 'percent' : 'fixed');
    setPercents(savedPercents(patient.referralFeeBasis));
  }, [patient.departmentId, patient.attendingDoctorId, patient.attendingNurseId, patient.doctorFee, patient.referralFee, patient.referralFeeBasis]);

  // Procedures without a % yet start at the doctor's default; pharmacy items start at 0.
  const percentFor = (procedure: BilledProcedure) => percents[procedure.key]
    ?? (procedure.billType === 'Pharmacy' ? '0' : referringDoctor?.defaultReferralPercent != null ? String(referringDoctor.defaultReferralPercent) : '');
  // Once paid, show what was paid rather than recalculating from today's bills.
  const lines = referralPaid && patient.referralFeeBasis
    ? patient.referralFeeBasis.lines
    : referralLines(procedures, Object.fromEntries(procedures.map(p => [p.key, percentFor(p)])));
  const percentTotal = referralTotal(lines);
  const percentOutOfDate = !referralPaid && patient.referralFeeBasis?.mode === 'percent' && patient.referralFee != null && patient.referralFee !== percentTotal;

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
    const usePercent = mode === 'percent';
    const referralFeeValue = usePercent ? percentTotal : referralFee.trim() === '' ? null : Number(referralFee);
    for (const value of [feeValue, referralFeeValue]) {
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        toast({ title: "Check the fees", description: "Enter fees of 0 or more, or leave them empty.", variant: "destructive" });
        return;
      }
    }
    if (showReferral && usePercent && canEditFee && !referralPaid) {
      if (lines.some(line => !Number.isFinite(line.percent) || line.percent < 0 || line.percent > 100)) {
        toast({ title: "Check the percentages", description: "Referral percentages must be between 0 and 100.", variant: "destructive" });
        return;
      }
      if (lines.length === 0) {
        toast({ title: "Nothing billed yet", description: "Add a bill for this patient before working out a percentage referral fee, or use a fixed amount.", variant: "destructive" });
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

    const changes: Partial<Patient> = showTeam ? {
      departmentId: newDepartmentId,
      attendingDoctorId: newDoctorId,
      attendingNurseId: newNurseId,
      assignedStaffIds: [...assigned],
    } : {};
    if (showDoctorFee && canEditFee && !feePaid) changes.doctorFee = feeValue;
    if (showReferral && canEditFee && !referralPaid) {
      changes.referralFee = referralFeeValue;
      changes.referralFeeBasis = usePercent ? { mode: 'percent', lines } : null;
    }

    const details = [
      ...(showTeam ? [
        `Department: ${departments.find(d => d.id === newDepartmentId)?.name ?? 'none'}`,
        `Doctor: ${staffName(newDoctorId) ?? 'none'}`,
        `Nurse: ${staffName(newNurseId) ?? 'none'}`,
      ] : []),
      ...(changes.doctorFee !== undefined ? [`Doctor fee: ${feeValue != null ? formatINR(feeValue) : 'not set'}`] : []),
      ...(changes.referralFee !== undefined
        ? [`Referral fee: ${referralFeeValue != null ? formatINR(referralFeeValue) : 'not set'}${usePercent ? ` (${lines.filter(l => l.percent > 0).map(l => `${l.percent}% of ${l.description}`).join(', ') || '0%'})` : ''}`]
        : []),
    ].join('; ');

    setIsSaving(true);
    try {
      await patientsRepo.update(patient.id, changes, { actionType: 'Care Team Updated', details: `${details}.` });
      toast({ title: "Care team saved", description: details });
      await onSaved();
    } catch (error) {
      toast({ title: "Could not save the care team", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const visibleDepartments = departments.filter(d => d.active !== false || String(d.id) === departmentId);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center"><Building2 className="mr-2 h-5 w-5 text-primary" />{showTeam ? t('Department & Care Team') : t('Referral Fee')}</CardTitle>
        <CardDescription>
          {showTeam
            ? `The department treating this patient and the doctor and nurse in charge${showDoctorFee ? ", the doctor's fee for the case" : ''}${showReferral ? ' and the referral fee' : ''}.`
            : 'The fee the hospital pays the doctor who referred this patient.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showTeam ? null : departments.length === 0 ? (
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
            {showDoctorFee && <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="careFee">Doctor fee for this case (₹)</Label>
                <Badge variant={feePaid ? 'default' : 'secondary'}>{feePaid ? `${t('Paid')}${patient.doctorFeePaymentId ? ` · ${patient.doctorFeePaymentId}` : ''}` : t('Pending')}</Badge>
              </div>
              <Input id="careFee" type="number" inputMode="decimal" min={0} value={fee} onChange={e => setFee(e.target.value)}
                disabled={!canEditFee || feePaid} placeholder={department?.defaultDoctorFee != null ? `Default ${formatINR(department.defaultDoctorFee)}` : 'e.g. 1500'} />
              <p className="text-xs text-muted-foreground mt-1">
                {feePaid
                  ? 'The fee has been paid, so the doctor and fee can no longer change.'
                  : canEditFee
                    ? 'Paid to the attending doctor through Payments → Doctor Fee.'
                    : 'Only Admin or Accounts staff can set the fee.'}
              </p>
            </div>}
          </>
        )}
            {showReferral && (
              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="careReferralFee">Referral fee (paid by the hospital)</Label>
                  <Badge variant={referralPaid ? 'default' : 'secondary'} className="shrink-0 whitespace-nowrap">{referralPaid ? `${t('Paid')}${patient.referralFeePaymentId ? ` · ${patient.referralFeePaymentId}` : ''}` : t('Pending')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  The hospital pays this to {referringDoctor ? `${referringDoctor.name}${referringDoctor.location ? ` (${referringDoctor.location})` : ''}` : 'the referring doctor'}. It is not added to the patient&apos;s bill.
                </p>
                {percentAllowed && <div role="radiogroup" aria-label="Referral fee type" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                  {(['fixed', 'percent'] as const).map(option => (
                    <button key={option} type="button" role="radio" aria-checked={referralMode === option}
                      disabled={!canEditFee || referralPaid}
                      onClick={() => setReferralMode(option)}
                      className={`min-h-9 rounded px-2 text-sm transition-colors disabled:cursor-not-allowed ${referralMode === option ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {option === 'fixed' ? 'Fixed amount' : '% of procedures'}
                    </button>
                  ))}
                </div>}
                {mode === 'fixed' ? (
                  <>
                    <Input id="careReferralFee" type="number" inputMode="decimal" min={0} value={referralFee} onChange={e => setReferralFee(e.target.value)}
                      disabled={!canEditFee || referralPaid} aria-label="Referral fee (₹)"
                      placeholder={referringDoctor?.defaultReferralFee != null ? `Default ${formatINR(referringDoctor.defaultReferralFee)}` : 'Amount in ₹, e.g. 500'} />
                    <p className="text-xs text-muted-foreground">
                      {referralPaid
                        ? 'The referral fee has been paid.'
                        : referralFee.trim() === '' && referringDoctor?.defaultReferralFee != null
                          ? `If left empty, the doctor's default of ${formatINR(referringDoctor.defaultReferralFee)} is used when paying through Payments → Referral/CC.`
                          : 'Paid to the referring doctor through Payments → Referral/CC.'}
                    </p>
                  </>
                ) : lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing has been billed for this patient yet. Percentages are entered against each billed procedure once a bill is added.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{referralPaid ? 'Paid as a percentage of these procedures.' : <>Enter the % for each type of procedure billed{referringDoctor?.defaultReferralPercent != null ? ` (doctor's default ${referringDoctor.defaultReferralPercent}%)` : ''}.</>}</p>
                    <ul className="divide-y rounded-md border">
                      {lines.map(line => (
                        <li key={line.key} className="space-y-1.5 px-3 py-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="min-w-0 text-sm font-medium break-words">{line.description}</p>
                            <p className="shrink-0 text-xs text-muted-foreground">{line.billType}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 text-xs text-muted-foreground tabular-nums">Billed {formatINR(line.amount)}</span>
                            <Input type="number" inputMode="decimal" min={0} max={100} step="0.5" className="h-9 w-20 text-right"
                              aria-label={`Referral % for ${line.description}`}
                              value={referralPaid ? String(line.percent) : percents[line.key] ?? String(line.percent || '')}
                              onChange={e => setPercents(prev => ({ ...prev, [line.key]: e.target.value }))}
                              disabled={!canEditFee || referralPaid} placeholder="0" />
                            <span className="text-sm text-muted-foreground">%</span>
                            <span className="min-w-20 text-right text-sm tabular-nums">{formatINR(line.fee)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>Referral fee</span>
                      <span id="careReferralPercentTotal" className="tabular-nums">{formatINR(percentTotal)}</span>
                    </div>
                    {percentOutOfDate && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">Bills have changed since the fee of {formatINR(patient.referralFee)} was saved. Save to update it.</p>
                    )}
                    {!referralPaid && <p className="text-xs text-muted-foreground">Paid to the referring doctor through Payments → Referral/CC.</p>}
                  </div>
                )}
              </div>
            )}
            {(canEditTeam || canEditFee) && ((showTeam && departments.length > 0) || showReferral) && (
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : t('Save Care Team')}
              </Button>
            )}
      </CardContent>
    </Card>
  );
}

function savedPercents(basis?: ReferralFeeBasis | null): Record<string, string> {
  return Object.fromEntries((basis?.lines ?? []).map(line => [line.key, String(line.percent)]));
}
