"use client";

import { useState } from 'react';
import { CalendarDays, FlaskConical, PlusCircle, ShoppingCart, UserCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import { AttachmentList } from '@/components/patient/attachment-picker';
import { TestForm, testDefinitionFor } from '@/components/patient/test-form';
import { loadTestCatalog, useLoadOnce } from '@/components/patient/use-load-once';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { bills as billsRepo } from '@/lib/data';
import { toDMY } from '@/lib/format';
import type { BillItem } from '@/types/billing';
import type { Patient, TestEntry } from '@/types/patient';
import type { StaffMember } from '@/types/staff';

// Tests performed: the form to add one (the test catalog loads when it opens), the list,
// and "Bill Test" to bill a test at its catalog price.
export function TestsSection({ patient, staff, onSaved, onBilled }: {
  patient: Patient;
  staff: StaffMember[];
  onSaved: () => Promise<void>;
  onBilled: () => Promise<void>;
}) {
  const t = useT();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const catalog = useLoadOnce(loadTestCatalog);
  const [showForm, setShowForm] = useState(false);
  const tests = [...(patient.tests ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const openForm = () => {
    catalog.ensure().catch(() => toast({ title: 'Could not load', description: 'Could not load the test catalog.', variant: 'destructive' }));
    setShowForm(true);
  };

  const billTest = async (test: TestEntry) => {
    try {
      const list = await catalog.ensure();
      const item = list.find(c => c.id === test.testTypeId)
        ?? list.find(c => c.name.trim().toLowerCase() === test.testTypeName.trim().toLowerCase());
      const price = item?.defaultPrice || 0;
      const billItem: BillItem = { id: `${test.id}-${Date.now()}`, description: test.testTypeName, quantity: 1, originalUnitPrice: price, unitPrice: price, total: price };
      const bill = await billsRepo.create({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        billDate: toDMY(new Date()),
        billType: 'Treatment',
        items: [billItem],
        totalAmount: billItem.total,
        paymentMethod: '',
        paymentStatus: 'Unpaid',
        notes: `Bill for test: ${test.testTypeName} performed on ${test.datePerformed}`,
      }, 'Treatment bill created for test.');
      await onBilled();
      toast({ title: 'Bill created', description: `Bill ${bill.id} created for test.` });
    } catch (e) {
      console.error('Failed to create test bill:', e);
      toast({ title: 'Could not create the bill', description: 'Could not create test bill.', variant: 'destructive' });
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center"><FlaskConical className="mr-2 h-5 w-5 text-primary" />{t('Tests Performed')}</CardTitle>
        {!showForm && <Button variant="outline" size="sm" onClick={openForm}><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Test')}</Button>}
      </CardHeader>
      <CardContent>
        {showForm && (
          <TestForm patient={patient} catalog={catalog.data} staff={staff}
            onSaved={async () => { await onSaved(); setShowForm(false); }} onCancel={() => setShowForm(false)} />
        )}
        {tests.length === 0 ? (
          <p className="mt-3 text-sm italic text-muted-foreground">No test entries added yet.</p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="tests">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">View Recorded Tests ({tests.length})</AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                  {tests.map(test => <TestCard key={test.id} test={test} onBill={isOn('billing') ? () => billTest(test) : undefined} />)}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

function TestCard({ test, onBill }: { test: TestEntry; onBill?: () => void }) {
  const t = useT();
  const { date } = useFormat();
  const fields = (testDefinitionFor(test.testTypeId, test.testTypeName)?.fields ?? [])
    .filter(field => test.testData?.[field.id] !== undefined && String(test.testData[field.id]).trim() !== '');

  return (
    <Card className="break-words bg-muted/50 p-3">
      <p className="mb-1 flex items-center font-semibold"><FlaskConical className="mr-2 h-4 w-4 shrink-0 text-accent" />{test.testTypeName}</p>
      <p className="flex items-center text-xs text-muted-foreground"><CalendarDays className="mr-1.5 h-3 w-3" />Performed on: {date(test.datePerformed)}</p>
      {test.performedByStaffName && <p className="flex items-center text-xs text-muted-foreground"><UserCircle className="mr-1.5 h-3 w-3" />Logged by: {test.performedByStaffName}</p>}
      {fields.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          <p className="text-xs font-medium">Test Specific Data:</p>
          {fields.map(field => (
            <p key={field.id} className="pl-2 text-xs"><span className="font-medium">{field.label}:</span> {String(test.testData?.[field.id])}</p>
          ))}
        </div>
      )}
      {test.overallResults && <div className="mt-1.5"><p className="text-xs font-medium">Overall Results:</p><p className="whitespace-pre-wrap text-xs">{test.overallResults}</p></div>}
      {test.notes && <div className="mt-1.5"><p className="text-xs font-medium">General Notes:</p><p className="whitespace-pre-wrap text-xs">{test.notes}</p></div>}
      {onBill && (
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
