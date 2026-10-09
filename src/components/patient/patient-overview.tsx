"use client";

import { differenceInCalendarDays } from 'date-fns';
import { CalendarDays, ClipboardList, FlaskConical, IndianRupee, Microscope, Pill, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import { abnormalValues } from '@/components/patient/results-trend';
import { useFeatures } from '@/hooks/use-features';
import { formatINR, parseStoredDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Bill } from '@/types/billing';
import type { Patient } from '@/types/patient';
import type { PharmacyOrder } from '@/types/pharmacyOrder';
import type { StaffMember } from '@/types/staff';
import { isOpenRequest, type TestRequest } from '@/types/testRequest';

export type PatientTab = 'overview' | 'history' | 'notes' | 'tests' | 'medicines' | 'bills';

function Tile({ icon: Icon, label, value, detail, onClick, warn }: {
  icon: React.ElementType; label: string; value: string; detail?: string; onClick?: () => void; warn?: boolean;
}) {
  const body = (
    <Card className={cn('h-full', onClick && 'transition-colors hover:bg-muted/50', warn && 'border-amber-300 dark:border-amber-900')}>
      <CardContent className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:gap-3 sm:p-4">
        <Icon className={cn('h-5 w-5 shrink-0 text-primary sm:mt-0.5', warn && 'text-amber-600')} />
        <div className="min-w-0 text-left">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-semibold leading-tight break-words">{value}</p>
          {detail && <p className="text-xs text-muted-foreground break-words">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="block h-full w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</button>
    : body;
}

// The patient at a glance: how long they have been in care, who is looking after them, what
// is still pending (tests, medicines, unpaid bills), the latest results (with values outside
// the normal range) and the latest care note. Each part opens its tab.
export function PatientOverview({ patient, staff, requests, orders, bills, onOpen }: {
  patient: Patient;
  staff: StaffMember[];
  requests: TestRequest[];
  orders: PharmacyOrder[];
  bills: Bill[];
  onOpen: (tab: PatientTab) => void;
}) {
  const t = useT();
  const { date } = useFormat();
  const { isOn } = useFeatures();
  const name = (id?: number | null) => staff.find(s => s.id === id)?.name;

  const admitted = parseStoredDate(patient.admissionDate);
  const discharged = patient.condition === 'Discharged';
  const openTests = requests.filter(isOpenRequest);
  const waitingMeds = orders.filter(o => o.status === 'Requested');
  const unpaid = bills.filter(b => b.paymentStatus === 'Unpaid' || b.paymentStatus === 'Partially Paid');
  const unpaidTotal = unpaid.reduce((sum, b) => sum + b.totalAmount * (b.paymentStatus === 'Partially Paid' ? 0.5 : 1), 0);
  const recentTests = [...(patient.tests ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const latestNote = [...(patient.careNotes ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Tile icon={CalendarDays} label={discharged ? t('Discharged') : t('In care')}
          value={admitted ? (discharged ? date(admitted) : t('Day {n}', { n: differenceInCalendarDays(new Date(), admitted) + 1 })) : t('Not admitted yet')}
          detail={admitted ? t('Admitted {date}', { date: date(admitted) }) : undefined} onClick={() => onOpen('history')} />
        <Tile icon={Stethoscope} label={t('Care team')} value={name(patient.attendingDoctorId) ?? t('No doctor assigned')}
          detail={name(patient.attendingNurseId) ? `${t('Nurse')}: ${name(patient.attendingNurseId)}` : undefined} />
        {isOn('labRequests') && (
          <Tile icon={Microscope} label={t('Tests waiting')} value={String(openTests.length)} warn={openTests.some(r => r.priority === 'Urgent')}
            detail={openTests.map(r => r.testTypeName).join(', ') || undefined} onClick={() => onOpen('tests')} />
        )}
        {isOn('pharmacyOrders') && (
          <Tile icon={Pill} label={t('Medicines waiting at the pharmacy')} value={String(waitingMeds.length)}
            detail={waitingMeds.flatMap(o => o.items.map(i => i.medicationName)).join(', ') || undefined} onClick={() => onOpen('medicines')} />
        )}
        {isOn('billing') && (
          <Tile icon={IndianRupee} label={t('Unpaid bills')} value={unpaid.length ? formatINR(unpaidTotal) : t('None')} warn={unpaid.length > 0}
            detail={unpaid.length ? t('{n} bills', { n: unpaid.length }) : undefined} onClick={() => onOpen('bills')} />
        )}
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center text-lg"><FlaskConical className="mr-2 h-5 w-5 text-primary" />{t('Latest results')}</CardTitle>
          {recentTests.length > 0 && <Button variant="link" className="h-auto px-0" onClick={() => onOpen('tests')}>{t('All results')}</Button>}
        </CardHeader>
        <CardContent>
          {recentTests.length === 0 ? <p className="text-sm italic text-muted-foreground">{t('No results yet.')}</p> : (
            <ul className="divide-y rounded-md border text-sm">
              {recentTests.map(test => {
                const abnormal = abnormalValues(test, t);
                return (
                  <li key={test.id} className="p-3">
                    <p className="flex flex-wrap justify-between gap-x-2"><span className="font-semibold">{test.testTypeName}</span><span className="text-xs text-muted-foreground">{date(test.createdAt)}</span></p>
                    {abnormal.length > 0
                      ? <p className="font-medium text-destructive">{abnormal.join(' · ')}</p>
                      : test.resultFields?.length ? <p className="text-xs text-green-700 dark:text-green-400">{t('All values within the normal range')}</p> : null}
                    {test.overallResults && <p className="text-xs whitespace-pre-wrap">{test.overallResults}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center text-lg"><ClipboardList className="mr-2 h-5 w-5 text-primary" />{t('Latest care note')}</CardTitle>
          {latestNote && <Button variant="link" className="h-auto px-0" onClick={() => onOpen('notes')}>{t('All notes')}</Button>}
        </CardHeader>
        <CardContent>
          {!latestNote ? <p className="text-sm italic text-muted-foreground">{t('No care notes yet.')}</p> : (
            <div className="text-sm">
              <p className="text-xs text-muted-foreground">{date(latestNote.createdAt, 'dd MMM yyyy, HH:mm')}{latestNote.staffName ? ` · ${latestNote.staffName}` : ''}</p>
              {latestNote.templateName && latestNote.templateName !== 'General Note (No Template)' && <p className="font-semibold">{latestNote.templateName}</p>}
              {latestNote.text && <p className="whitespace-pre-wrap break-words">{latestNote.text}</p>}
              {(latestNote.medicationsMentioned ?? []).length > 0 && (
                <p className="mt-1 text-xs"><span className="font-medium">{t('Medicines')}:</span> {latestNote.medicationsMentioned!.map(m => `${m.medicationName}${m.dosage ? ` (${m.dosage})` : ''}`).join(', ')}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
