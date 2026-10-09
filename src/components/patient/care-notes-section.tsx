"use client";

import { useState } from 'react';
import Link from '@/components/app-link';
import { ClipboardList, IndianRupee, PackageCheck, Pill, PlusCircle, Send, ShoppingCart } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import { AttachmentList } from '@/components/patient/attachment-picker';
import { CareNoteForm } from '@/components/patient/care-note-form';
import { DispenseDialog } from '@/components/pharmacy/dispense-dialog';
import { loadMedications, loadTreatmentTemplates, useLoadOnce } from '@/components/patient/use-load-once';
import { useStaff } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { useWorkflow } from '@/hooks/use-workflow';
import { bills as billsRepo, pharmacyOrders } from '@/lib/data';
import { formatDate, formatINR, toDMY } from '@/lib/format';
import type { TreatmentTemplate } from '@/config/treatmentTemplates';
import type { BillItem } from '@/types/billing';
import type { CareNote, Patient } from '@/types/patient';
import type { PharmacyOrder } from '@/types/pharmacyOrder';

const newestFirst = (a: CareNote, b: CareNote) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

// Care notes: the form to add one (templates and medicines load when it opens) and the list.
// With Pharmacy Orders on, a note's medicines go to the pharmacy ("Send to Pharmacy"), which
// dispenses and bills them; each note shows where its order stands. Otherwise "Bill Meds"
// turns a note's medicines into a pharmacy bill directly.
export function CareNotesSection({ patient, orders, onOrdersChanged, onSaved, onBilled }: {
  patient: Patient;
  orders: PharmacyOrder[]; // this patient's pharmacy orders (loaded by the patient page)
  onOrdersChanged: () => Promise<void>;
  onSaved: () => Promise<void>;
  onBilled: () => Promise<void>;
}) {
  const t = useT();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const currentUser = useStaff();
  const templates = useLoadOnce(loadTreatmentTemplates);
  const medications = useLoadOnce(loadMedications);
  const [showForm, setShowForm] = useState(false);
  const { pharmacyOn, canSendToPharmacy, canProcessPharmacy, canCollect: canCollectFor } = useWorkflow();
  const canCollect = canCollectFor('Pharmacy');
  const [dispensing, setDispensing] = useState<PharmacyOrder | null>(null);
  const patientName = `${patient.firstName} ${patient.lastName}`;

  const loadOrders = () => onOrdersChanged().catch(() => undefined);

  const sendToPharmacy = async (note: CareNote) => {
    try {
      await pharmacyOrders.create({
        patientId: patient.id, careNoteId: note.id,
        items: (note.medicationsMentioned ?? []).map(m => ({ medicationId: m.medicationId, medicationName: m.medicationName, dosage: m.dosage })),
      });
      toast({ title: t('Sent to the pharmacy') });
    } catch (e) {
      toast({ title: t('Could not send to the pharmacy'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    }
    await loadOrders();
  };

  const notes = [...(patient.careNotes ?? [])].sort(newestFirst);
  const loadFailed = (what: string) => () => toast({ title: 'Could not load', description: `Could not load ${what}.`, variant: 'destructive' });
  const ensureTemplates = () => { templates.ensure().catch(loadFailed('care note templates')); };

  const openForm = () => { ensureTemplates(); setShowForm(true); };

  const billMedications = async (note: CareNote) => {
    const mentioned = note.medicationsMentioned ?? [];
    try {
      const priceList = await medications.ensure();
      const items: BillItem[] = mentioned.map(mention => {
        const medication = priceList.find(m => m.id === mention.medicationId);
        const price = medication?.listPrice ?? 0;
        return {
          id: `${mention.medicationId}-${Date.now()}`,
          description: mention.medicationName,
          medicationId: medication?.id,
          quantity: 1,
          originalUnitPrice: price,
          unitPrice: price,
          total: price,
        };
      });
      if (items.some(item => item.originalUnitPrice === 0)) {
        toast({ title: 'Check prices', description: 'Some medications could not be priced or have a list price of 0. Please check the medication list.' });
      }
      const bill = await billsRepo.create({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        billDate: toDMY(new Date()),
        billType: 'Pharmacy',
        items,
        totalAmount: items.reduce((sum, item) => sum + item.total, 0),
        paymentMethod: '',
        paymentStatus: 'Unpaid',
        notes: `Pharmacy items from care note dated ${formatDate(note.createdAt, 'dd/MM/yyyy')}. Dosages: ${mentioned.map(m => `${m.medicationName} - ${m.dosage || 'N/A'}`).join('; ')}`,
      }, 'Pharmacy bill created from care note.');
      await onBilled();
      toast({ title: 'Bill created', description: `Pharmacy bill ${bill.id} created.` });
    } catch (e) {
      console.error('Failed to create pharmacy bill:', e);
      toast({ title: 'Could not create the bill', description: 'Could not create pharmacy bill.', variant: 'destructive' });
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-primary" />{t('Care Notes')}</CardTitle>
          <CardDescription>Notes are attributed to you ({currentUser.name}).</CardDescription>
        </div>
        {!showForm && (
          <Button variant="outline" size="sm" onClick={openForm}><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Care Note')}</Button>
        )}
      </CardHeader>
      <CardContent>
        {showForm && (
          <CareNoteForm patient={patient} templates={templates.data} medications={medications.data}
            loadMedications={() => { medications.ensure().catch(loadFailed('medications')); }}
            onSaved={async () => { await Promise.all([onSaved(), loadOrders()]); setShowForm(false); }} onCancel={() => setShowForm(false)} />
        )}
        {notes.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No care notes added yet.</p>
        ) : (
          <Accordion type="single" collapsible className="w-full"
            onValueChange={value => { if (value && notes.some(n => n.templateId)) ensureTemplates(); }}>
            <AccordionItem value="care-notes">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">View Recorded Notes ({notes.length})</AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                  {notes.map(note => {
                    const hasMeds = !!note.medicationsMentioned?.length;
                    // The note's latest order that wasn't cancelled.
                    const order = orders.find(o => o.careNoteId === note.id && o.status !== 'Cancelled');
                    return (
                      <NoteCard key={note.id} note={note} templates={templates.data}
                        onBill={!pharmacyOn && isOn('billing') && hasMeds ? () => billMedications(note) : undefined}
                        pharmacy={pharmacyOn && hasMeds ? {
                          order,
                          onSend: !order && canSendToPharmacy ? () => sendToPharmacy(note) : undefined,
                          onDispense: order?.status === 'Requested' && canProcessPharmacy ? () => setDispensing(order) : undefined,
                          canCollect,
                        } : undefined} />
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
        {dispensing && (
          <DispenseDialog order={dispensing} patientName={patientName} open={!!dispensing}
            onOpenChange={open => { if (!open) setDispensing(null); }} onDone={() => { loadOrders(); onBilled(); }} />
        )}
      </CardContent>
    </Card>
  );
}

interface NotePharmacy {
  order?: PharmacyOrder;
  onSend?: () => void;
  onDispense?: () => void;
  canCollect: boolean;
}

function NoteCard({ note, templates, onBill, pharmacy }: { note: CareNote; templates: TreatmentTemplate[] | null; onBill?: () => void; pharmacy?: NotePharmacy }) {
  const t = useT();
  const { date } = useFormat();
  const templateFields = note.templateId && note.templateFieldsData
    ? templates?.find(tpl => tpl.id === note.templateId)?.careNoteFields.flatMap(field => {
      const value = note.templateFieldsData?.[field.fieldId];
      if (value === undefined || String(value).trim() === '') return [];
      const shown = field.fieldType === 'select' ? field.options?.find(o => o.value === value)?.label ?? String(value) : String(value);
      return [{ id: field.fieldId, label: field.label, value: shown }];
    }) ?? []
    : [];
  const medications = note.medicationsMentioned ?? [];

  return (
    <Card className="break-words bg-muted/50 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="mb-1 text-xs text-muted-foreground">
          {date(note.createdAt, 'dd MMM yyyy, HH:mm')}
          {note.staffName && <> by <span className="font-semibold text-foreground">{note.staffName}</span></>}
        </p>
        {onBill && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0"><ShoppingCart className="mr-2 h-3 w-3" /> {t('Bill Meds')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Create Pharmacy Bill?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create a new bill for the medications listed in this care note: {medications.map(m => m.medicationName).join(', ')}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onBill}>{t('Create Bill')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {note.templateName && <p className="mb-1 font-semibold">Template: {note.templateName}</p>}
      {note.text && <p className="mb-1 whitespace-pre-wrap"><span className="font-medium">General Note:</span> {note.text}</p>}
      {templateFields.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          <p className="text-xs font-medium">Template Specific Data:</p>
          {templateFields.map(field => (
            <p key={field.id} className="pl-2 text-xs"><span className="font-medium">{field.label}:</span> {field.value}</p>
          ))}
        </div>
      )}
      {medications.length > 0 && (
        <div className="mt-2">
          <p className="flex items-center text-xs font-medium"><Pill className="mr-1 h-3 w-3 text-blue-600" />Medications Mentioned:</p>
          <ul className="list-inside list-disc space-y-0.5 pl-4 text-xs">
            {medications.map((med, index) => (
              <li key={index}>
                <span className="font-semibold">{med.medicationName}</span>
                {med.dosage && <span className="text-muted-foreground"> - Dosage: {med.dosage}</span>}
                {med.notes && <span className="text-muted-foreground"> - Notes: {med.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pharmacy && <PharmacyStatus {...pharmacy} />}
      <AttachmentList paths={note.attachments} />
    </Card>
  );
}

// Where a note's medicines stand with the pharmacy, with the next step for this person.
function PharmacyStatus({ order, onSend, onDispense, canCollect }: NotePharmacy) {
  const t = useT();
  const bill = order?.bill;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2 text-xs">
      <span className="text-muted-foreground">
        {!order ? t('Not sent to the pharmacy')
          : order.status === 'Requested' ? t('Sent to the pharmacy · waiting')
            : bill ? `${t('Dispensed')} · ${t('Bill {id}', { id: bill.id })} · ${formatINR(bill.amount)} · ${t(bill.status)}` : t('Dispensed')}
      </span>
      <span className="flex gap-2">
        {onSend && <Button size="sm" variant="outline" onClick={onSend}><Send className="mr-2 h-3 w-3" /> {t('Send to Pharmacy')}</Button>}
        {onDispense && <Button size="sm" onClick={onDispense}><PackageCheck className="mr-2 h-3 w-3" /> {t('Dispense')}</Button>}
        {canCollect && bill && bill.status !== 'Paid' && bill.status !== 'Cancelled' && (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/billing/form?billId=${bill.id}`}><IndianRupee className="mr-2 h-3 w-3" /> {t('Collect payment')}</Link>
          </Button>
        )}
      </span>
    </div>
  );
}
