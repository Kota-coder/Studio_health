"use client";

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ClipboardList, FlaskConical, History, IndianRupee, Microscope, Pill, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import { abnormalValues } from '@/components/patient/results-trend';
import { patients as patientsRepo } from '@/lib/data';
import { formatINR, parseStoredDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Bill } from '@/types/billing';
import type { AuditLogEntry, Patient } from '@/types/patient';
import type { PharmacyOrder } from '@/types/pharmacyOrder';
import type { TestRequest } from '@/types/testRequest';

type Kind = 'notes' | 'tests' | 'medicines' | 'bills' | 'changes';
interface TimelineEvent { at: string; kind: Kind; title: string; detail?: string; by?: string; alert?: boolean; icon?: React.ElementType }

const ICONS: Record<Kind, React.ElementType> = { notes: ClipboardList, tests: FlaskConical, medicines: Pill, bills: IndianRupee, changes: UserCog };
const FILTERS: Array<{ key: Kind | 'all'; label: string }> = [
  { key: 'all', label: 'All' }, { key: 'notes', label: 'Care notes' }, { key: 'tests', label: 'Tests' },
  { key: 'medicines', label: 'Medicines' }, { key: 'bills', label: 'Bills' }, { key: 'changes', label: 'Record changes' },
];
// Audit entries already shown from their own records.
const SHOWN_ELSEWHERE = new Set(['Care Note Added', 'Test Added', 'Test Requested', 'Sent to Pharmacy']);

const iso = (value?: string | null) => {
  const d = value ? parseStoredDate(value) : null;
  return d ? d.toISOString() : null;
};

// Everything that happened to the patient, newest first, grouped by day: care notes, tests
// requested and their results, medicines sent and given, bills and payments, and changes to
// the record (admission, condition, care team, history). Filter by kind.
export function PatientTimeline({ patient, requests, orders, bills }: {
  patient: Patient;
  requests: TestRequest[];
  orders: PharmacyOrder[];
  bills: Bill[];
}) {
  const t = useT();
  const { date } = useFormat();
  const [audit, setAudit] = useState<AuditLogEntry[] | null>(null);
  const [filter, setFilter] = useState<Kind | 'all'>('all');

  useEffect(() => {
    patientsRepo.auditLog(patient.id).then(setAudit).catch(() => setAudit([]));
  }, [patient.id, patient.careNotes?.length, patient.tests?.length, patient.condition]);

  const events = useMemo(() => {
    const list: TimelineEvent[] = [];
    const admitted = iso(patient.admissionDate);
    if (admitted) list.push({ at: admitted, kind: 'changes', title: t('Admitted'), detail: [patient.reasonForVisit, patient.initialObservationsText].filter(Boolean).join(' · ') || undefined });
    for (const note of patient.careNotes ?? []) {
      const meds = (note.medicationsMentioned ?? []).map(m => `${m.medicationName}${m.dosage ? ` (${m.dosage})` : ''}`);
      list.push({
        at: note.createdAt, kind: 'notes', by: note.staffName,
        title: note.templateName && note.templateName !== 'General Note (No Template)' ? note.templateName : t('Care note'),
        detail: [note.text, meds.length ? `${t('Medicines')}: ${meds.join(', ')}` : ''].filter(Boolean).join('\n') || undefined,
      });
    }
    for (const r of requests) {
      list.push({ at: r.createdAt, kind: 'tests', icon: Microscope, by: r.requestedByStaffName, title: t('Test requested: {test}', { test: r.testTypeName }) + (r.priority === 'Urgent' ? ` (${t('Urgent')})` : ''), detail: r.notes });
      if (r.status === 'Cancelled') list.push({ at: r.updatedAt, kind: 'tests', title: t('Test request cancelled: {test}', { test: r.testTypeName }) });
    }
    for (const test of patient.tests ?? []) {
      const abnormal = abnormalValues(test, t);
      list.push({
        at: test.createdAt, kind: 'tests', by: test.performedByStaffName, alert: abnormal.length > 0,
        title: t('Result: {test}', { test: test.testTypeName }),
        detail: [abnormal.length ? `${t('Outside normal range')}: ${abnormal.join(', ')}` : '', test.overallResults].filter(Boolean).join('\n') || undefined,
      });
    }
    for (const o of orders) {
      const names = o.items.map(i => i.medicationName).join(', ');
      list.push({ at: o.createdAt, kind: 'medicines', by: o.requestedByStaffName, title: t('Sent to the pharmacy'), detail: names });
      if (o.status === 'Dispensed' && o.dispensedAt) {
        list.push({ at: o.dispensedAt, kind: 'medicines', by: o.dispensedByStaffName, title: t('Medicines given'),
          detail: o.items.filter(i => i.quantity).map(i => `${i.medicationName} × ${i.quantity}`).join(', ') });
      }
    }
    for (const bill of bills) {
      list.push({ at: bill.createdAt, kind: 'bills', by: bill.processedByStaffName ?? undefined, title: t('Bill {id}', { id: bill.id }) + ` · ${formatINR(bill.totalAmount)}`, detail: `${t(bill.billType || 'Treatment')} · ${t(bill.paymentStatus)}` });
      const paid = bill.paymentStatus === 'Paid' ? iso(bill.paymentDate) : null;
      if (paid) list.push({ at: paid, kind: 'bills', title: t('Paid: bill {id}', { id: bill.id }), detail: `${formatINR(bill.totalAmount)}${bill.paymentMethod ? ` · ${bill.paymentMethod}` : ''}` });
    }
    for (const entry of audit ?? []) {
      if (SHOWN_ELSEWHERE.has(entry.actionType)) continue;
      list.push({ at: entry.timestamp, kind: 'changes', by: entry.staffName, title: entry.actionType, detail: entry.changeDetails });
    }
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [patient, requests, orders, bills, audit, t]);

  const shown = filter === 'all' ? events : events.filter(e => e.kind === filter);
  const days: Array<{ day: string; items: TimelineEvent[] }> = [];
  for (const event of shown) {
    const day = format(parseISO(event.at), 'yyyy-MM-dd'); // the local day
    if (days.at(-1)?.day === day) days.at(-1)!.items.push(event);
    else days.push({ day, items: [event] });
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5 text-primary" />{t('Patient History')}</CardTitle>
        <CardDescription>{t('Everything that happened, newest first.')}</CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          {FILTERS.map(f => (
            <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>{t(f.label)}</Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {audit === null && events.length === 0 ? <p className="text-sm text-muted-foreground">{t('Loading…')}</p>
          : days.length === 0 ? <p className="text-sm italic text-muted-foreground">{t('Nothing yet.')}</p> : (
            <div className="space-y-5">
              {days.map(({ day, items }) => (
                <section key={day}>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{date(items[0].at, 'EEEE, d MMM yyyy')}</h3>
                  <ol className="space-y-3 border-l pl-4">
                    {items.map((e, i) => {
                      const Icon = e.icon ?? ICONS[e.kind];
                      return (
                        <li key={i} className="relative">
                          <span className={cn('absolute -left-[1.4rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background', e.alert && 'border-destructive')}>
                            <Icon className={cn('h-3 w-3 text-primary', e.alert && 'text-destructive')} />
                          </span>
                          <p className={cn('text-sm font-medium break-words', e.alert && 'text-destructive')}>{e.title}</p>
                          {e.detail && <p className="whitespace-pre-wrap text-xs break-words">{e.detail}</p>}
                          <p className="text-xs text-muted-foreground">{date(e.at, 'HH:mm')}{e.by ? ` · ${e.by}` : ''}</p>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
