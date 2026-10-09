"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { useParams, useRouter } from 'next/navigation';
import { differenceInYears } from 'date-fns';
import { AlertTriangle, FileText, Microscope, PlusCircle, Receipt, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CareTeamCard } from '@/components/care-team-card';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { AssignedStaffCard } from '@/components/patient/assigned-staff-card';
import { AuditTrail } from '@/components/patient/audit-trail';
import { CareNotesSection } from '@/components/patient/care-notes-section';
import { MedicalHistoryCard, hasAllergies } from '@/components/patient/medical-history-card';
import { MedicinesCard } from '@/components/patient/medicines-card';
import { PatientOverview, type PatientTab } from '@/components/patient/patient-overview';
import { PatientTimeline } from '@/components/patient/patient-timeline';
import { ResultsTrend } from '@/components/patient/results-trend';
import { ConditionBadge } from '@/components/patient/condition-badge';
import { PatientBillsCard } from '@/components/patient/patient-bills-card';
import { PatientDataRequests } from '@/components/patient/patient-data-requests';
import { PatientDetailsCard } from '@/components/patient/patient-details-card';
import { TestsSection } from '@/components/patient/tests-section';
import { PATIENT_DATA_REQUESTS_ENABLED } from '@/config/features';
import { canOpen } from '@/config/permissions';
import { useStaff } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { useWorkflow } from '@/hooks/use-workflow';
import { bills as billsRepo, patients as patientsRepo, pharmacyOrders, referringDoctors as referringDoctorsRepo, staff as staffRepo, testRequests } from '@/lib/data';
import { parseStoredDate, patientDisplayId } from '@/lib/format';
import type { Bill } from '@/types/billing';
import type { Patient } from '@/types/patient';
import type { PharmacyOrder } from '@/types/pharmacyOrder';
import type { ReferringDoctor } from '@/types/referringDoctor';
import type { StaffMember } from '@/types/staff';
import { isOpenRequest, type TestRequest } from '@/types/testRequest';

const TABS: PatientTab[] = ['overview', 'history', 'notes', 'tests', 'medicines', 'bills'];
const isTab = (value: string | null): value is PatientTab => !!value && (TABS as string[]).includes(value);

// One patient's record, the centre of their treatment: the header (condition, allergies, quick
// actions) and tabs for the overview (what is pending, latest results, medical history, care
// team), the full history, care notes, tests and results, medicines and bills. The sections live
// in src/components/patient; this page loads everything once and keeps them in step.
// ?tab=<tab> opens a tab; ?request=<id> (from the lab queue) opens Tests with that result form.
// Access and feature switches are checked by PageGuard (src/config/navigation.ts).
export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const { labOn, canRequest, canProcessLab } = useWorkflow();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const currentUser = useStaff();
  const patientId = parseInt(String(params.patientId ?? ''), 10);
  const billingOn = isOn('billing');
  const referralsOn = isOn('referringDoctors');
  const pharmacyOn = isOn('pharmacyOrders');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [referringDoctor, setReferringDoctor] = useState<ReferringDoctor | null>(null);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [requests, setRequests] = useState<TestRequest[]>([]);
  const [tab, setTab] = useState<PatientTab>('overview');
  const [noteAction, setNoteAction] = useState(false);
  const [testAction, setTestAction] = useState<'request' | 'add' | undefined>();

  // The tab from the address (?tab=, or Tests for a lab request); kept there as it changes.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const wanted = query.get('tab');
    if (isTab(wanted)) setTab(wanted);
    else if (query.get('request')) setTab('tests');
  }, []);
  const openTab = (next: PatientTab) => {
    setTab(next);
    window.history.replaceState(null, '', next === 'overview' ? window.location.pathname : `?tab=${next}`);
    window.scrollTo({ top: 0 });
  };

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

  // The patient's pharmacy orders, for the Medicines card and the care notes.
  const reloadOrders = useCallback(async () => {
    if (pharmacyOn) setOrders(await pharmacyOrders.listForPatient(patientId));
  }, [pharmacyOn, patientId]);
  useEffect(() => {
    if (!Number.isNaN(patientId)) reloadOrders().catch(error => console.error('Could not load the pharmacy orders', error));
  }, [patientId, reloadOrders]);

  // The patient's lab requests (all of them, for the tests tab, the overview and the history).
  const reloadRequests = useCallback(async () => {
    if (labOn) setRequests(await testRequests.listForPatient(patientId));
  }, [labOn, patientId]);
  useEffect(() => {
    if (!Number.isNaN(patientId)) reloadRequests().catch(error => console.error('Could not load the lab requests', error));
  }, [patientId, reloadRequests]);

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

  const referredBy = !referralsOn ? undefined
    : patient.referredDoctorId ? (referringDoctor ? `${referringDoctor.name} (${referringDoctor.location})` : 'N/A') : null;
  const dob = parseStoredDate(patient.dateOfBirth);
  const facts = [
    `${t('ID')} ${patientDisplayId(patient.id)}`,
    dob ? t('{n} years', { n: differenceInYears(new Date(), dob) }) : null,
    patient.gender ? t(patient.gender) : null,
  ].filter(Boolean).join(' · ');
  const allergic = hasAllergies(patient.allergies);
  const canBill = billingOn && canOpen('billing', currentUser.role);
  const openTests = requests.filter(isOpenRequest).length;
  const waitingMeds = orders.filter(o => o.status === 'Requested').length;
  const unpaidBills = bills.filter(b => b.paymentStatus === 'Unpaid' || b.paymentStatus === 'Partially Paid').length;
  const count = (n: number) => (n ? ` (${n})` : '');

  const addNote = () => { setNoteAction(true); openTab('notes'); };
  const testQuickAction = labOn && canRequest ? 'request' : canProcessLab ? 'add' : null;

  return (
    <PageBody>
      <PageHeader icon={UserRound} back={{ href: '/dashboard', label: t('Patient Dashboard') }}
        title={`${patient.firstName} ${patient.lastName}`}
        description={
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <ConditionBadge condition={patient.condition} />
            <span>{facts}</span>
            {allergic ? (
              <button type="button" onClick={() => openTab('overview')}
                className="inline-flex items-center gap-1 rounded-full border border-destructive bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> {t('Allergies')}: {patient.allergies}
              </button>
            ) : !patient.allergies?.trim() ? (
              <span className="text-xs italic">{t('Allergies not recorded')}</span>
            ) : null}
          </span>
        }
        actions={<>
          <Button size="sm" onClick={addNote}><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Care Note')}</Button>
          {testQuickAction && (
            <Button size="sm" variant="outline" onClick={() => { setTestAction(testQuickAction); openTab('tests'); }}>
              <Microscope className="mr-2 h-4 w-4" /> {testQuickAction === 'request' ? t('Request Test') : t('Add Test')}
            </Button>
          )}
          {canBill && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/billing/form?patientId=${patientDisplayId(patient.id)}`}><Receipt className="mr-2 h-4 w-4" /> {t('New Bill')}</Link>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/patients/${patientDisplayId(patient.id)}/summary`}><FileText className="mr-2 h-4 w-4" /> {t('Treatment Summary')}</Link>
          </Button>
          {PATIENT_DATA_REQUESTS_ENABLED && currentUser.role === 'Super Admin' && <PatientDataRequests patient={patient} />}
        </>} />

      <Tabs value={tab} onValueChange={value => openTab(value as PatientTab)}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto print:hidden">
          <TabsTrigger value="overview" className="flex-none">{t('Overview')}</TabsTrigger>
          <TabsTrigger value="history" className="flex-none">{t('History')}</TabsTrigger>
          <TabsTrigger value="notes" className="flex-none">{t('Care Notes')}{count(patient.careNotes?.length ?? 0)}</TabsTrigger>
          <TabsTrigger value="tests" className="flex-none">{t('Tests & Results')}{count(openTests)}</TabsTrigger>
          <TabsTrigger value="medicines" className="flex-none">{t('Medicines')}{count(waitingMeds)}</TabsTrigger>
          {billingOn && <TabsTrigger value="bills" className="flex-none">{t('Bills')}{count(unpaidBills)}</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <PatientOverview patient={patient} staff={staff} requests={requests} orders={orders} bills={bills} onOpen={openTab} />
              <PatientDetailsCard patient={patient} referredBy={referredBy} />
            </div>
            <div className="min-w-0 space-y-6">
              <MedicalHistoryCard patient={patient} onSaved={reloadPatient} />
              {(isOn('departments') || (isOn('referralFees') && !!patient.referredDoctorId)) && (
                <CareTeamCard patient={patient} staff={staff} bills={bills} referringDoctor={referringDoctor} onSaved={reloadPatient} />
              )}
              <AssignedStaffCard patient={patient} staff={staff} onChange={setPatient} onSaved={reloadPatient} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6 space-y-6">
          <PatientTimeline patient={patient} requests={requests} orders={orders} bills={bills} />
          <AuditTrail patientId={patient.id} />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <CareNotesSection patient={patient} orders={orders} onOrdersChanged={reloadOrders}
            openForm={noteAction} onFormOpened={() => setNoteAction(false)} onSaved={reloadPatient} onBilled={reloadBills} />
        </TabsContent>

        <TabsContent value="tests" className="mt-6 space-y-6">
          <TestsSection patient={patient} staff={staff} bills={bills} requests={requests} onRequestsChanged={reloadRequests}
            action={testAction} onActionHandled={() => setTestAction(undefined)} onSaved={reloadPatient} onBilled={reloadBills} />
          <ResultsTrend tests={patient.tests ?? []} />
        </TabsContent>

        <TabsContent value="medicines" className="mt-6 space-y-4">
          <MedicinesCard patient={patient} orders={orders} pharmacyOn={pharmacyOn} />
          <Button variant="outline" onClick={addNote}><PlusCircle className="mr-2 h-4 w-4" /> {t('Prescribe in a care note')}</Button>
        </TabsContent>

        {billingOn && (
          <TabsContent value="bills" className="mt-6">
            <PatientBillsCard patientId={patient.id} bills={bills} />
          </TabsContent>
        )}
      </Tabs>
    </PageBody>
  );
}
