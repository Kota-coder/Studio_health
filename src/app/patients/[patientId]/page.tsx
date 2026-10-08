"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { useParams, useRouter } from 'next/navigation';
import { ClipboardList, FileText, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CareTeamCard } from '@/components/care-team-card';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useFormat, useT } from '@/components/language-provider';
import { AssignedStaffCard } from '@/components/patient/assigned-staff-card';
import { AuditTrail } from '@/components/patient/audit-trail';
import { CareNotesSection } from '@/components/patient/care-notes-section';
import { ConditionBadge } from '@/components/patient/condition-badge';
import { PatientBillsCard } from '@/components/patient/patient-bills-card';
import { PatientDataRequests } from '@/components/patient/patient-data-requests';
import { PatientDetailsCard } from '@/components/patient/patient-details-card';
import { TestsSection } from '@/components/patient/tests-section';
import { PATIENT_DATA_REQUESTS_ENABLED } from '@/config/features';
import { useStaff } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { bills as billsRepo, patients as patientsRepo, referringDoctors as referringDoctorsRepo, staff as staffRepo } from '@/lib/data';
import { patientDisplayId } from '@/lib/format';
import type { Bill } from '@/types/billing';
import type { Patient } from '@/types/patient';
import type { ReferringDoctor } from '@/types/referringDoctor';
import type { StaffMember } from '@/types/staff';

// One patient's record: details, care notes, tests, care team, assigned staff, bills and history.
// The sections live in src/components/patient; this page loads the patient and keeps them in step.
// Access and feature switches are checked by PageGuard (src/config/navigation.ts).
export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const { date } = useFormat();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const currentUser = useStaff();
  const patientId = parseInt(String(params.patientId ?? ''), 10);
  const billingOn = isOn('billing');
  const referralsOn = isOn('referringDoctors');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [referringDoctor, setReferringDoctor] = useState<ReferringDoctor | null>(null);

  useEffect(() => {
    if (Number.isNaN(patientId)) {
      toast({ title: 'Invalid patient number', variant: 'destructive' });
      router.push('/dashboard');
      return;
    }
    let cancelled = false;
    Promise.all([
      patientsRepo.get(patientId),
      staffRepo.list(),
      billingOn ? billsRepo.list({ patientId }) : Promise.resolve([]),
    ])
      .then(async ([found, staffList, billList]) => {
        if (cancelled) return;
        if (!found) {
          toast({ title: 'Patient not found', variant: 'destructive' });
          router.push('/dashboard');
          return;
        }
        setPatient(found);
        setStaff(staffList);
        setBills(billList);
        const doctor = referralsOn && found.referredDoctorId ? await referringDoctorsRepo.get(found.referredDoctorId) : null;
        if (!cancelled) setReferringDoctor(doctor);
      })
      .catch(error => {
        console.error('Error loading patient data:', error);
        toast({ title: 'Could not load the patient', variant: 'destructive' });
        if (!cancelled) setNotFound(true);
      });
    return () => { cancelled = true; };
  }, [patientId, billingOn, referralsOn, router, toast]);

  // Re-reads the patient (with notes, tests and audit trail) after a change is saved.
  const reloadPatient = useCallback(async () => {
    const fresh = await patientsRepo.get(patientId);
    if (fresh) setPatient(fresh);
  }, [patientId]);

  const reloadBills = useCallback(async () => {
    setBills(await billsRepo.list({ patientId }));
  }, [patientId]);

  if (notFound) {
    return (
      <PageBody>
        <PageHeader icon={UserRound} title={t('Patient Not Found')} back={{ href: '/dashboard', label: t('Patient Dashboard') }} />
      </PageBody>
    );
  }
  if (!patient) return <PageLoading />;

  const latest = [...(patient.careNotes ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const latestSummary = !latest ? 'No recent activity'
    : `${latest.templateName && latest.templateName !== 'General Note (No Template)' ? latest.templateName
      : latest.text ? latest.text.slice(0, 30) + (latest.text.length > 30 ? '...' : '') : 'General note entry'} (on ${date(latest.createdAt)})`;
  const referredBy = !referralsOn ? undefined
    : patient.referredDoctorId ? (referringDoctor ? `${referringDoctor.name} (${referringDoctor.location})` : 'N/A') : null;

  return (
    <PageBody>
      <PageHeader icon={UserRound} back={{ href: '/dashboard', label: t('Patient Dashboard') }}
        title={`${patient.firstName} ${patient.lastName}`}
        description={
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <ConditionBadge condition={patient.condition} />
            <span className="flex min-w-0 items-center">
              <ClipboardList className="mr-1.5 h-4 w-4 shrink-0" />
              <span className="truncate" title={latestSummary}>Latest: {latestSummary}</span>
            </span>
          </span>
        }
        actions={<>
          <Button variant="outline" asChild>
            <Link href={`/patients/${patientDisplayId(patient.id)}/summary`}><FileText className="mr-2 h-4 w-4" /> {t('Treatment Summary')}</Link>
          </Button>
          {PATIENT_DATA_REQUESTS_ENABLED && currentUser.role === 'Super Admin' && <PatientDataRequests patient={patient} />}
        </>} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <PatientDetailsCard patient={patient} referredBy={referredBy} />
          <CareNotesSection patient={patient} onSaved={reloadPatient} onBilled={reloadBills} />
          <TestsSection patient={patient} staff={staff} bills={bills} onSaved={reloadPatient} onBilled={reloadBills} />
          <AuditTrail patientId={patient.id} />
        </div>
        <div className="min-w-0 space-y-6">
          {(isOn('departments') || (isOn('referralFees') && !!patient.referredDoctorId)) && (
            <CareTeamCard patient={patient} staff={staff} bills={bills} referringDoctor={referringDoctor} onSaved={reloadPatient} />
          )}
          <AssignedStaffCard patient={patient} staff={staff} onChange={setPatient} onSaved={reloadPatient} />
          {billingOn && <PatientBillsCard patientId={patient.id} bills={bills} />}
        </div>
      </div>
    </PageBody>
  );
}
