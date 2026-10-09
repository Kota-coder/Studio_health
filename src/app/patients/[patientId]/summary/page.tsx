"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { differenceInYears } from 'date-fns';
import { ClipboardList, FileText, FlaskConical, Pill, Printer, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HospitalLetterhead } from '@/components/hospital-letterhead';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useFormat, useT } from '@/components/language-provider';
import { useFeatures } from '@/hooks/use-features';
import {
  bills as billsRepo, departments as departmentsRepo, patients as patientsRepo,
  referringDoctors as referringDoctorsRepo, staff as staffRepo,
} from '@/lib/data';
import { formatINR, parseStoredDate as toDate, patientDisplayId } from '@/lib/format';
import { resultParameters } from '@/lib/test-templates';
import type { Bill } from '@/types/billing';
import type { Department } from '@/types/department';
import type { Patient } from '@/types/patient';
import type { ReferringDoctor } from '@/types/referringDoctor';
import type { StaffMember } from '@/types/staff';

interface ProcedureRow { date: Date | null; name: string; detail: string; by?: string; kind: 'Test' | 'Procedure' }
interface MedicationRow { name: string; dosage: string; prescribedOn: Date[]; prescribedBy: Set<string>; dispensed: number }

// One-page treatment summary for a patient: key procedures, tests and medications.
// Prints cleanly (Print / Save as PDF) to hand to the patient or another doctor.
// Access is checked by PageGuard (src/config/navigation.ts).
export default function PatientSummaryPage() {
  const params = useParams();
  const t = useT();
  const { date: show } = useFormat();
  const { isOn } = useFeatures();
  const billingOn = isOn('billing');
  const referralsOn = isOn('referringDoctors');
  const patientId = Number(params.patientId);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [referringDoctor, setReferringDoctor] = useState<ReferringDoctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(patientId)) { setNotFound(true); return; }
    const load = async () => {
      try {
        // Pharmacy and treatment bills also list what was dispensed and done.
        const [found, billList, staffList] = await Promise.all([
          patientsRepo.get(patientId), billsRepo.list({ patientId }), staffRepo.list(),
        ]);
        if (!found) { setNotFound(true); return; }
        setPatient(found);
        setBills(billList.filter(b => b.paymentStatus !== 'Cancelled'));
        setStaff(staffList);
        const [dept, referrer] = await Promise.all([
          found.departmentId ? departmentsRepo.get(found.departmentId) : Promise.resolve(null),
          referralsOn && found.referredDoctorId ? referringDoctorsRepo.get(found.referredDoctorId) : Promise.resolve(null),
        ]);
        setDepartment(dept);
        setReferringDoctor(referrer);
      } catch (error) {
        console.error('Could not load the patient summary', error);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [patientId, referralsOn]);

  const staffName = (id?: number | null) => staff.find(s => s.id === id)?.name;

  // Tests from the patient record plus procedures billed on treatment bills.
  const procedures = useMemo<ProcedureRow[]>(() => {
    if (!patient) return [];
    const rows: ProcedureRow[] = (patient.tests ?? []).map(test => ({
      kind: 'Test',
      date: toDate(test.datePerformed) ?? toDate(test.createdAt),
      name: test.testTypeName,
      detail: test.overallResults || Object.entries(test.testData ?? {}).map(([k, v]) => {
        const field = resultParameters(test).find(f => f.id === k);
        return `${field?.label ?? k.replace(/_/g, ' ')}: ${v}${field?.unit ? ` ${field.unit}` : ''}`;
      }).join(', '),
      by: test.performedByStaffName,
    }));
    for (const bill of bills.filter(b => b.billType === 'Treatment')) {
      for (const item of bill.items) {
        // Tests are already listed above with their results.
        if (rows.some(r => r.kind === 'Test' && r.name.toLowerCase() === item.description.toLowerCase())) continue;
        rows.push({ kind: 'Procedure', date: toDate(bill.billDate), name: item.description, detail: item.quantity > 1 ? `× ${item.quantity}` : '' });
      }
    }
    return rows.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
  }, [patient, bills]);

  // Medications prescribed in care notes, with quantities dispensed on pharmacy bills.
  const medications = useMemo<MedicationRow[]>(() => {
    if (!patient) return [];
    const byName = new Map<string, MedicationRow>();
    const row = (name: string) => {
      const key = name.trim().toLowerCase();
      let existing = byName.get(key);
      if (!existing) {
        existing = { name: name.trim(), dosage: '', prescribedOn: [], prescribedBy: new Set(), dispensed: 0 };
        byName.set(key, existing);
      }
      return existing;
    };
    for (const note of patient.careNotes ?? []) {
      for (const med of note.medicationsMentioned ?? []) {
        const r = row(med.medicationName);
        if (med.dosage) r.dosage = med.dosage; // latest instruction wins (notes are oldest first)
        const date = toDate(note.createdAt);
        if (date) r.prescribedOn.push(date);
        if (note.staffName) r.prescribedBy.add(note.staffName);
      }
    }
    for (const bill of bills.filter(b => b.billType === 'Pharmacy')) {
      for (const item of bill.items) row(item.description).dispensed += item.quantity;
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [patient, bills]);

  if (notFound) {
    return (
      <PageBody width="medium">
        <PageHeader icon={FileText} title={t('Patient Not Found')} back={{ href: '/dashboard', label: t('Patient Dashboard') }} />
      </PageBody>
    );
  }
  if (isLoading || !patient) return <PageLoading />;

  const displayId = patientDisplayId(patient.id);
  const dob = toDate(patient.dateOfBirth);
  const age = dob ? differenceInYears(new Date(), dob) : null;
  const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPaid = bills.filter(b => b.paymentStatus === 'Paid').reduce((sum, b) => sum + b.totalAmount, 0);
  const notes = [...(patient.careNotes ?? [])].reverse().slice(0, 8);

  const Detail = ({ label, value }: { label: string; value?: string | null }) => (
    <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value || '—'}</dd></div>
  );

  return (
    <PageBody width="medium" className="print:space-y-4">
      <PageHeader icon={FileText} title={t('Treatment Summary')} className="print:hidden"
        back={{ href: `/patients/${displayId}`, label: `${patient.firstName} ${patient.lastName}` }}
        actions={<Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> {t('Print / Save as PDF')}</Button>} />

      <HospitalLetterhead />

      <header className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-sm text-muted-foreground">{t('Treatment Summary')}</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{patient.firstName} {patient.lastName}</h1>
          <p className="text-sm text-muted-foreground">
            Patient ID {displayId}{age !== null ? ` · ${age} years` : ''}{patient.gender ? ` · ${patient.gender}` : ''} · Generated {show(new Date())}
          </p>
        </div>
      </header>

      <Card className="print:shadow-none print:border-0">
        <CardHeader className="print:px-0"><CardTitle className="flex items-center gap-2 text-lg"><Stethoscope className="h-5 w-5 text-primary" /> {t('Admission & Care Team')}</CardTitle></CardHeader>
        <CardContent className="print:px-0">
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Detail label="Admitted" value={show(patient.admissionDate)} />
            <Detail label="Reason for visit" value={patient.reasonForVisit} />
            <Detail label="Current condition" value={patient.condition && t(patient.condition)} />
            <Detail label="Department" value={department?.name} />
            <Detail label="Attending doctor" value={staffName(patient.attendingDoctorId)} />
            <Detail label="Nurse in charge" value={staffName(patient.attendingNurseId)} />
            {referralsOn && <Detail label="Referred by" value={referringDoctor ? `${referringDoctor.name}${referringDoctor.location ? `, ${referringDoctor.location}` : ''}` : null} />}
            <Detail label="Date of birth" value={dob ? show(dob) : null} />
            <Detail label="Emergency contact" value={patient.emergencyContactName ? `${patient.emergencyContactName} (${patient.emergencyContactNumber})` : null} />
          </dl>
          {patient.initialObservationsText && (
            <p className="mt-4 text-sm"><span className="font-medium">Observations at admission: </span>{patient.initialObservationsText}</p>
          )}
        </CardContent>
      </Card>

      <Card className="print:shadow-none print:border-0 print:break-inside-avoid">
        <CardHeader className="print:px-0">
          <CardTitle className="flex items-center gap-2 text-lg"><FlaskConical className="h-5 w-5 text-primary" /> {t('Key Procedures & Tests')}</CardTitle>
          <CardDescription>Tests recorded on the patient&apos;s file and procedures billed.</CardDescription>
        </CardHeader>
        <CardContent className="print:px-0">
          {procedures.length === 0 ? <p className="text-sm text-muted-foreground">No procedures or tests recorded.</p> : (
            <Table className="[&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-4 sm:[&_th]:px-4">
              <TableHeader>
                <TableRow><TableHead>Date</TableHead><TableHead>Procedure / Test</TableHead><TableHead className="hidden sm:table-cell print:table-cell">Result / Notes</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {procedures.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="whitespace-nowrap">{show(row.date)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">{row.kind}{row.by ? ` · ${row.by}` : ''}</span>
                      {row.detail && <span className="block text-xs sm:hidden print:hidden">{row.detail}</span>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell print:table-cell text-sm">{row.detail || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="print:shadow-none print:border-0 print:break-inside-avoid">
        <CardHeader className="print:px-0">
          <CardTitle className="flex items-center gap-2 text-lg"><Pill className="h-5 w-5 text-primary" /> {t('Medications')}</CardTitle>
          <CardDescription>Prescribed in care notes, with quantities dispensed by the pharmacy.</CardDescription>
        </CardHeader>
        <CardContent className="print:px-0">
          {medications.length === 0 ? <p className="text-sm text-muted-foreground">No medications recorded.</p> : (
            <Table className="[&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-4 sm:[&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Medication</TableHead>
                  <TableHead>Dosage</TableHead>
                  <TableHead className="hidden sm:table-cell print:table-cell">Prescribed</TableHead>
                  <TableHead className="text-right">Dispensed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medications.map(med => (
                  <TableRow key={med.name}>
                    <TableCell className="font-medium">{med.name}</TableCell>
                    <TableCell>{med.dosage || '—'}</TableCell>
                    <TableCell className="hidden sm:table-cell print:table-cell text-sm">
                      {med.prescribedOn.length > 0 ? `${show(med.prescribedOn[0])}${med.prescribedOn.length > 1 ? ` (+${med.prescribedOn.length - 1} more)` : ''}` : 'Pharmacy only'}
                      {med.prescribedBy.size > 0 && <span className="block text-xs text-muted-foreground">{[...med.prescribedBy].join(', ')}</span>}
                    </TableCell>
                    <TableCell className="text-right">{med.dispensed > 0 ? med.dispensed : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {notes.length > 0 && (
        <Card className="print:shadow-none print:border-0">
          <CardHeader className="print:px-0">
            <CardTitle className="flex items-center gap-2 text-lg"><ClipboardList className="h-5 w-5 text-primary" /> {t('Recent Care Notes')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 print:px-0">
            {notes.map(note => (
              <div key={note.id} className="border-l-2 border-primary/40 pl-3 print:break-inside-avoid">
                <p className="text-xs text-muted-foreground">{show(note.createdAt)}{note.staffName ? ` · ${note.staffName}` : ''}{note.templateName ? ` · ${note.templateName}` : ''}</p>
                {note.text && <p className="text-sm whitespace-pre-wrap">{note.text}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {billingOn && (
      <Card className="print:shadow-none print:border-0 print:break-inside-avoid">
        <CardHeader className="print:px-0"><CardTitle className="text-lg">{t('Billing')}</CardTitle></CardHeader>
        <CardContent className="print:px-0">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label="Bills" value={String(bills.length)} />
            <Detail label="Total billed" value={formatINR(totalBilled)} />
            <Detail label="Paid in full" value={formatINR(totalPaid)} />
          </dl>
        </CardContent>
      </Card>
      )}
      <p className="text-center text-[11px] text-muted-foreground">Generated with Seva</p>
    </PageBody>
  );
}
