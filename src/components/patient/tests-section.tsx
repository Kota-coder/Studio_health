"use client";

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ClipboardCheck, FlaskConical, IndianRupee, Microscope, PlusCircle, ShoppingCart, UserCircle, X } from 'lucide-react';
import Link from '@/components/app-link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import { RequestSummary } from '@/components/lab/request-summary';
import { RequestTestDialog } from '@/components/lab/request-test-dialog';
import { AttachmentList } from '@/components/patient/attachment-picker';
import { TestForm } from '@/components/patient/test-form';
import { loadTestCatalog, useLoadOnce } from '@/components/patient/use-load-once';
import { canOpen } from '@/config/permissions';
import { useStaff } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { useWorkflow } from '@/hooks/use-workflow';
import { useToast } from '@/hooks/use-toast';
import { bills as billsRepo, testRequests } from '@/lib/data';
import { formatINR } from '@/lib/format';
import { normalRange, rangeFlag, resultParameters } from '@/lib/test-templates';
import type { Bill } from '@/types/billing';
import type { Patient, TestEntry } from '@/types/patient';
import type { StaffMember } from '@/types/staff';
import type { TestRequest } from '@/types/testRequest';

// Tests performed: the form to add one (the test catalog loads when it opens), the list,
// and "Bill Test" to bill a test at its catalog price. With Lab Requests on, tests can also be
// requested for the lab; the open requests show here until their result is recorded.
// /patients/<id>?request=<request id> (from the lab queue) opens the result form for it.
export function TestsSection({ patient, staff, bills, onSaved, onBilled }: {
  patient: Patient;
  staff: StaffMember[];
  bills: Bill[];
  onSaved: () => Promise<void>;
  onBilled: () => Promise<void>;
}) {
  const t = useT();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const currentUser = useStaff();
  // With Lab Requests on, doctors and nurses request tests and the lab records them.
  const { labOn, canRequest, canProcessLab } = useWorkflow();
  const canBill = isOn('billing') && canOpen('billing', currentUser.role);
  const catalog = useLoadOnce(loadTestCatalog);
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState<TestRequest[]>([]);
  const [resultFor, setResultFor] = useState<TestRequest | undefined>();
  const [showRequest, setShowRequest] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!labOn) return [];
    const list = await testRequests.listOpenForPatient(patient.id);
    setRequests(list);
    return list;
  }, [labOn, patient.id]);

  useEffect(() => {
    loadRequests().then(list => {
      const wanted = new URLSearchParams(window.location.search).get('request');
      const request = wanted && list.find(r => r.id === wanted);
      if (request && canProcessLab) {
        recordResult(request);
        document.getElementById('tests')?.scrollIntoView({ block: 'start' });
      }
    }).catch(() => toast({ title: t('Could not load the lab requests'), variant: 'destructive' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per patient
  }, [loadRequests]);
  const tests = [...(patient.tests ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const openForm = () => {
    catalog.ensure().catch(() => toast({ title: 'Could not load', description: 'Could not load the test catalog.', variant: 'destructive' }));
    setShowForm(true);
  };

  const recordResult = (request: TestRequest) => {
    setResultFor(request);
    openForm();
  };

  const openRequestDialog = () => {
    catalog.ensure().catch(() => toast({ title: 'Could not load', description: 'Could not load the test catalog.', variant: 'destructive' }));
    setShowRequest(true);
  };

  const cancelRequest = async (request: TestRequest) => {
    if (!confirm(t('Cancel the request for {test}?', { test: request.testTypeName }))) return;
    try {
      await testRequests.cancel(request);
    } catch (e) {
      toast({ title: t('Could not cancel the request'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    }
    await loadRequests();
  };

  const closeForm = () => {
    setShowForm(false);
    setResultFor(undefined);
  };

  const billTest = async (test: TestEntry) => {
    try {
      const list = await catalog.ensure();
      const item = list.find(c => c.id === test.testTypeId)
        ?? list.find(c => c.name.trim().toLowerCase() === test.testTypeName.trim().toLowerCase());
      const bill = await billsRepo.createForTest(patient, test, item?.defaultPrice || 0);
      await Promise.all([onBilled(), onSaved()]);
      toast({ title: 'Bill created', description: `Bill ${bill.id} created for test.` });
    } catch (e) {
      console.error('Failed to create test bill:', e);
      toast({ title: 'Could not create the bill', description: 'Could not create test bill.', variant: 'destructive' });
    }
  };

  return (
    <Card id="tests" className="scroll-mt-20 shadow-lg">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center"><FlaskConical className="mr-2 h-5 w-5 text-primary" />{t('Tests Performed')}</CardTitle>
        {!showForm && (
          <div className="flex flex-wrap gap-2">
            {labOn && canRequest && <Button size="sm" onClick={openRequestDialog}><Microscope className="mr-2 h-4 w-4" /> {t('Request Test')}</Button>}
            {canProcessLab && <Button variant="outline" size="sm" onClick={openForm}><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Test')}</Button>}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {requests.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium">{t('Requested tests ({n})', { n: requests.length })}</p>
            <ul className="divide-y rounded-md border text-sm">
              {requests.map(request => (
                <li key={request.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                  <RequestSummary request={request} />
                  <div className="flex shrink-0 gap-2">
                    {canProcessLab && (
                      <Button size="sm" onClick={() => recordResult(request)} disabled={showForm}>
                        <ClipboardCheck className="mr-2 h-4 w-4" /> {t('Record result')}
                      </Button>
                    )}
                    {(canRequest || canProcessLab) && (
                      <Button size="sm" variant="ghost" onClick={() => cancelRequest(request)} aria-label={t('Cancel request')}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {showForm && (
          <TestForm key={resultFor?.id ?? 'new'} patient={patient} catalog={catalog.data} staff={staff} request={resultFor}
            onSaved={async () => { closeForm(); await Promise.all([onSaved(), loadRequests(), canBill ? onBilled() : undefined]); }} onCancel={closeForm} />
        )}
        {labOn && (
          <RequestTestDialog patient={patient} catalog={catalog.data} open={showRequest} onOpenChange={setShowRequest}
            onRequested={() => { loadRequests().catch(() => undefined); }} />
        )}
        {tests.length === 0 ? (
          <p className="mt-3 text-sm italic text-muted-foreground">No test entries added yet.</p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="tests">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">View Recorded Tests ({tests.length})</AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                  {tests.map(test => (
                    <TestCard key={test.id} test={test} bill={test.billId ? bills.find(b => b.id === test.billId) ?? { id: test.billId } : undefined}
                      canBill={canBill} canBillTest={canBill && canProcessLab} onBill={() => billTest(test)} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

function TestCard({ test, bill, canBill, canBillTest, onBill }: {
  test: TestEntry;
  bill?: Pick<Bill, 'id'> & Partial<Bill>;
  canBill: boolean; // may collect payment
  canBillTest: boolean; // may bill an unbilled test (the lab, with Lab Requests on)
  onBill: () => void;
}) {
  const t = useT();
  const { date } = useFormat();
  const fields = resultParameters(test)
    .filter(field => test.testData?.[field.id] !== undefined && String(test.testData[field.id]).trim() !== '');

  return (
    <Card className="break-words bg-muted/50 p-3">
      <p className="mb-1 flex items-center font-semibold"><FlaskConical className="mr-2 h-4 w-4 shrink-0 text-accent" />{test.testTypeName}</p>
      <p className="flex items-center text-xs text-muted-foreground"><CalendarDays className="mr-1.5 h-3 w-3" />Performed on: {date(test.datePerformed)}</p>
      {test.performedByStaffName && <p className="flex items-center text-xs text-muted-foreground"><UserCircle className="mr-1.5 h-3 w-3" />Logged by: {test.performedByStaffName}</p>}
      {fields.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          <p className="text-xs font-medium">{t('Results')}:</p>
          {fields.map(field => {
            const value = test.testData?.[field.id];
            const flag = rangeFlag(field, value);
            const range = normalRange(field);
            return (
              <p key={field.id} className="pl-2 text-xs">
                <span className="font-medium">{field.label}:</span>{' '}
                <span className={flag ? 'font-semibold text-destructive' : undefined}>{String(value)}{field.type === 'number' && field.unit ? ` ${field.unit}` : ''}{flag ? ` (${t(flag)})` : ''}</span>
                {range && <span className="text-muted-foreground"> · {t('Normal: {range}', { range })}</span>}
              </p>
            );
          })}
        </div>
      )}
      {test.overallResults && <div className="mt-1.5"><p className="text-xs font-medium">Overall Results:</p><p className="whitespace-pre-wrap text-xs">{test.overallResults}</p></div>}
      {test.notes && <div className="mt-1.5"><p className="text-xs font-medium">General Notes:</p><p className="whitespace-pre-wrap text-xs">{test.notes}</p></div>}
      {bill && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-xs">
          <span className="text-muted-foreground">
            {t('Billed')}: {bill.id}{bill.totalAmount != null ? ` · ${formatINR(bill.totalAmount)}` : ''}{bill.paymentStatus ? ` · ${t(bill.paymentStatus)}` : ''}
          </span>
          {canBill && bill.paymentStatus !== 'Paid' && bill.paymentStatus !== 'Cancelled' && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/billing/form?billId=${bill.id}`}><IndianRupee className="mr-2 h-3 w-3" /> {t('Collect payment')}</Link>
            </Button>
          )}
        </div>
      )}
      {canBillTest && !bill && (
        <div className="mt-2 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm"><ShoppingCart className="mr-2 h-3 w-3" /> {t('Bill Test')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Create Test Bill?</AlertDialogTitle>
                <AlertDialogDescription>This will create a new bill for the test: {test.testTypeName}.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onBill}>{t('Create Bill')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      <AttachmentList paths={test.attachments} />
      <p className="mt-1.5 text-xs text-muted-foreground/70">Recorded: {date(test.createdAt, 'dd MMM yyyy, HH:mm')}</p>
    </Card>
  );
}
