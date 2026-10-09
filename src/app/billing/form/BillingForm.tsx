'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/app-link';
import { CreditCard, History, Pill, PlusCircle, Printer, Save, Stethoscope, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { DateField, parseDMY } from '@/components/date-field';
import { ProcessedByField } from '@/components/processed-by-field';
import { StoredImage } from '@/components/stored-image';
import { ImageSourceButtons } from '@/components/image-source-buttons';
import { useT } from '@/components/language-provider';
import { useStaff } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFeatures } from '@/hooks/use-features';
import { useWorkflow } from '@/hooks/use-workflow';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { compressImageFiles } from '@/lib/images';
import { uploadNewImages } from '@/lib/storage';
import { formatQty } from '@/lib/inventory';
import { bills as billsRepo, inventory as inventoryRepo, medications as medicationsRepo, patients as patientsRepo, staff as staffRepo, type BillFields } from '@/lib/data';
import { formatDate, formatINR, parseStoredDate, patientDisplayId, toDMY } from '@/lib/format';
import { methodChoices } from '@/types/paymentMethod';
import type { Patient } from '@/types/patient';
import type { AuditLogEntry, BillItem, BillType, PaymentMethod, PaymentStatus } from '@/types/billing';
import type { Medication } from '@/types/medication';
import type { StaffMember } from '@/types/staff';

const PAYMENT_STATUSES: PaymentStatus[] = ['Paid', 'Unpaid', 'Partially Paid', 'Cancelled'];
const BILL_TYPES: { value: BillType; label: string; icon: React.ElementType }[] = [
  { value: 'Pharmacy', label: 'Pharmacy Bill', icon: Pill },
  { value: 'Treatment', label: 'Treatment / Consultation Bill', icon: Stethoscope },
];

const newItem = (): BillItem => ({ id: `${Date.now()}${Math.random()}`, description: '', quantity: 1, unitPrice: 0, originalUnitPrice: 0, total: 0 });

// New bill (?patientId= preselects the patient) or edit an existing one (?billId=).
export default function BillingForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const currentUser = useStaff();
  const { isOn } = useFeatures();
  const { canProcessPharmacy } = useWorkflow();
  const methodOptions = usePaymentMethods();

  const billIdToEdit = searchParams.get('billId');
  const patientIdFromQuery = searchParams.get('patientId');
  const isEditMode = Boolean(billIdToEdit);
  const canAssignProcessor = currentUser.role === 'Super Admin';

  const [billType, setBillType] = useState<BillType>('');
  const [isBillTypeSelected, setIsBillTypeSelected] = useState(false);
  // Pharmacy bills: the items the pharmacy sells, and their stock (Inventory).
  const [pharmacyItems, setPharmacyItems] = useState<Medication[]>([]);
  const [stockById, setStockById] = useState<Record<string, number>>({});

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(patientIdFromQuery && !isEditMode ? String(parseInt(patientIdFromQuery, 10)) : '');
  const [billDate, setBillDate] = useState(toDMY(new Date()));
  const [paymentDate, setPaymentDate] = useState('');
  const [billItems, setBillItems] = useState<BillItem[]>([newItem()]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>('');
  // Who processed the bill: the person creating it, unless the Super Admin picks someone else.
  const [processedById, setProcessedById] = useState(isEditMode ? '' : String(currentUser.id));
  const [processedByName, setProcessedByName] = useState<string | null>(isEditMode ? null : currentUser.name);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [notes, setNotes] = useState('');
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (canAssignProcessor) setStaffList(await staffRepo.list());
        if (!billIdToEdit) {
          // From a patient's page the patient is fixed; otherwise offer the patients in care.
          setPatients(await patientsRepo.listNames(patientIdFromQuery ? [parseInt(patientIdFromQuery, 10)] : undefined));
          return;
        }
        const bill = await billsRepo.get(billIdToEdit);
        if (bill) setPatients(await patientsRepo.listNames([bill.patientId]));
        if (cancelled) return;
        if (!bill) {
          toast({ title: 'Bill not found', variant: 'destructive' });
          router.push('/billing');
          return;
        }
        setBillType(bill.billType || 'Treatment');
        setIsBillTypeSelected(true);
        setSelectedPatientId(String(bill.patientId));
        setPaymentMethod(bill.paymentMethod);
        setProcessedById(bill.processedByStaffId ? String(bill.processedByStaffId) : '');
        setProcessedByName(bill.processedByStaffName ?? null);
        setPaymentStatus(bill.paymentStatus);
        setNotes(bill.notes || '');
        setBillItems(bill.items.map(item => ({
          ...item,
          id: item.id || `${Date.now()}${Math.random()}`,
          originalUnitPrice: item.originalUnitPrice ?? item.unitPrice,
        })));
        setAuditLog(bill.auditLog || []);
        setAttachments(bill.attachments || []);
        const parsedBillDate = parseStoredDate(bill.billDate);
        setBillDate(parsedBillDate ? toDMY(parsedBillDate) : bill.billDate);
        setPaymentDate(bill.paymentStatus === 'Paid' && bill.paymentDate ? bill.paymentDate : '');
      } catch (error) {
        console.error('Error loading bill form data:', error);
        toast({ title: t('Error'), description: 'Could not load bill details.', variant: 'destructive' });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [billIdToEdit, canAssignProcessor, router, toast, t]);

  useEffect(() => {
    if (billType !== 'Pharmacy' || !isOn('medications')) return;
    medicationsRepo.list().then(setPharmacyItems).catch(error => console.error('Could not load pharmacy items', error));
    if (isOn('inventory')) {
      inventoryRepo.summary()
        .then(list => setStockById(Object.fromEntries(list.filter(i => i.kind === 'pharmacy').map(i => [i.id, i.onHand]))))
        .catch(error => console.error('Could not load stock', error));
    }
  }, [billType, isOn]);

  const handlePaymentStatusChange = (status: PaymentStatus) => {
    setPaymentStatus(status);
    if (status !== 'Paid') setPaymentDate('');
    else if (!paymentDate) setPaymentDate(toDMY(new Date()));
  };

  const pharmacyItemNamed = (name: string) => {
    const key = name.trim().toLowerCase();
    return key ? pharmacyItems.find(m => m.name.trim().toLowerCase() === key) : undefined;
  };

  const handleItemChange = (index: number, field: 'description' | 'quantity' | 'unitPrice', value: string) => {
    const item = { ...billItems[index] };
    if (field === 'description') {
      item.description = value;
      if (billType === 'Pharmacy') {
        // Picking a pharmacy item links it (for stock) and fills in its price.
        const match = pharmacyItemNamed(value);
        item.medicationId = match?.id;
        if (match && (!item.unitPrice || item.unitPrice === item.originalUnitPrice)) {
          item.unitPrice = match.listPrice;
          item.originalUnitPrice = match.listPrice;
        }
      }
    } else {
      item[field] = Math.max(0, Number(value));
    }
    item.total = item.quantity * item.unitPrice;
    setBillItems(billItems.map((old, i) => (i === index ? item : old)));
  };

  const removeItem = (index: number) => {
    if (billItems.length > 1) setBillItems(billItems.filter((_, i) => i !== index));
    else toast({ title: 'A bill needs at least one item' });
  };

  const grandTotal = billItems.reduce((sum, item) => sum + item.total, 0);

  const addAttachments = (files: File[]) => {
    compressImageFiles(files).then(results => setAttachments(prev => [...prev, ...results]));
  };

  const invalid = (title: string, description?: string) => toast({ title, description, variant: 'destructive' });

  const handleSubmit = async () => {
    if (!billType) return invalid('Choose the bill type');
    if (!selectedPatientId) return invalid('Choose a patient');
    if (!parseDMY(billDate)) return invalid('Check the bill date', 'Use the form dd/mm/yyyy.');
    if (billItems.some(item => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0)) {
      return invalid('Check the items', 'Every item needs a description, a quantity above 0 and a price of 0 or more.');
    }
    if (!paymentMethod) return invalid('Choose the payment method');
    if (!paymentStatus) return invalid('Choose the payment status');
    let finalPaymentDate: string | undefined;
    if (paymentStatus === 'Paid') {
      if (paymentDate && !parseDMY(paymentDate)) return invalid('Check the payment date', 'Use the form dd/mm/yyyy.');
      finalPaymentDate = paymentDate || toDMY(new Date());
    }
    const patient = patients.find(p => String(p.id) === selectedPatientId);
    if (!patient) return invalid('Choose a patient', 'The selected patient was not found.');

    setIsSaving(true);
    try {
      const billData: BillFields = {
        patientId: parseInt(selectedPatientId, 10),
        patientName: `${patient.firstName} ${patient.lastName}`,
        billDate,
        billType,
        items: billItems.map(({ id, description, quantity, unitPrice, originalUnitPrice, total, medicationId }) => ({
          id, description, quantity, unitPrice, originalUnitPrice, total,
          ...(billType === 'Pharmacy' && medicationId ? { medicationId } : {}),
        })),
        totalAmount: grandTotal,
        paymentMethod,
        paymentStatus,
        paymentDate: finalPaymentDate,
        notes: notes.trim(),
        attachments: await uploadNewImages(attachments, `patients/${selectedPatientId}/bills`),
        processedByStaffId: processedById ? Number(processedById) : null,
      };

      if (billIdToEdit) {
        const previousStatus = (await billsRepo.get(billIdToEdit))?.paymentStatus;
        const justPaid = paymentStatus === 'Paid' && previousStatus !== 'Paid';
        await billsRepo.update(billIdToEdit, billData, {
          actionType: 'Bill Updated',
          details: `Bill ${billIdToEdit} details updated. Status: ${paymentStatus}.${justPaid ? ` Marked as Paid on ${finalPaymentDate}.` : ''}`,
        });
        toast({ title: 'Bill saved', description: billIdToEdit });
        // Just paid: straight to the receipt, ready to print.
        router.push(justPaid ? `/billing/print?billId=${billIdToEdit}` : '/billing');
      } else {
        const created = await billsRepo.create(billData, `Bill created with status ${paymentStatus}.${paymentStatus === 'Paid' ? ` Marked as Paid on ${finalPaymentDate}.` : ''}`);
        toast({ title: 'Bill saved', description: created.id });
        router.push(paymentStatus === 'Paid' ? `/billing/print?billId=${created.id}` : '/billing');
      }
    } catch (e) {
      console.error('Failed to save bill', e);
      invalid('Could not save the bill', e instanceof Error ? e.message : undefined);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  if (!isEditMode && !isBillTypeSelected) {
    const pharmacyNote = !canProcessPharmacy;
    return (
      <PageBody width="narrow">
        <PageHeader icon={CreditCard} title={t('New Bill')} description={t('Choose the bill type')} back={{ href: '/billing' }} />
        <Card>
          <CardContent className="pt-6">
            <RadioGroup value={billType} onValueChange={(value: BillType) => setBillType(value)}>
              {/* With Pharmacy Orders on, pharmacy bills are the pharmacy's (the database enforces it too). */}
              {BILL_TYPES.filter(type => type.value !== 'Pharmacy' || canProcessPharmacy).map(({ value, label, icon: Icon }) => (
                <Label key={value} htmlFor={`billType-${value}`}
                  className="flex cursor-pointer items-center space-x-3 rounded-md border p-4 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                  <RadioGroupItem value={value} id={`billType-${value}`} className="h-5 w-5" />
                  <Icon className="h-6 w-6 text-primary" />
                  <span className="font-medium">{t(label)}</span>
                </Label>
              ))}
            </RadioGroup>
            {pharmacyNote && <p className="mt-3 text-xs text-muted-foreground">{t('Medicines are billed by the pharmacy: send them from the patient page.')}</p>}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => setIsBillTypeSelected(true)} disabled={!billType}>{t('Continue')}</Button>
          </CardFooter>
        </Card>
      </PageBody>
    );
  }

  const isPharmacy = billType === 'Pharmacy';
  const typeLabel = BILL_TYPES.find(b => b.value === billType)?.label;

  return (
    <PageBody width="narrow">
      <PageHeader icon={CreditCard} back={{ href: '/billing' }}
        title={isEditMode ? `${t('Edit Bill')} ${billIdToEdit}` : t('New Bill')}
        description={typeLabel ? t(typeLabel) : undefined}
        actions={isEditMode && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/billing/print?billId=${billIdToEdit}`}><Printer className="mr-2 h-4 w-4" /> {paymentStatus === 'Paid' ? t('Print Receipt') : t('Print Bill')}</Link>
          </Button>
        )} />

      <Card>
        <CardContent className="grid gap-6 pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="patient">Patient *</Label>
              <Select onValueChange={setSelectedPatientId} value={selectedPatientId} disabled={isEditMode || Boolean(patientIdFromQuery)}>
                <SelectTrigger id="patient"><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patients.length > 0 ? patients.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName} (ID: {patientDisplayId(p.id)})</SelectItem>
                  )) : (
                    <div className="p-2 text-center text-sm text-muted-foreground">No patients found. <Link href="/patients/new" className="text-primary underline">Add a patient first</Link>.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="billDate">Bill date *</Label>
              <DateField id="billDate" value={billDate} onChange={setBillDate} required />
            </div>
          </div>

          <Card className="bg-muted/50 p-4">
            <CardTitle className="mb-3 text-lg">{isPharmacy ? t('Pharmacy Items') : t('Services / Treatments')}</CardTitle>
            {isPharmacy && (
              <datalist id="pharmacyItemNames">
                {pharmacyItems.map(m => <option key={m.id} value={m.name}>{`${formatINR(m.listPrice)}${m.unitOfMeasure ? ` / ${m.unitOfMeasure}` : ''}`}</option>)}
              </datalist>
            )}
            {billItems.map((item, index) => {
              const linked = isPharmacy && item.description.trim() && pharmacyItems.length > 0
                ? (item.medicationId ? pharmacyItems.find(m => m.id === item.medicationId) : pharmacyItemNamed(item.description)) ?? null
                : undefined;
              const onHand = linked ? stockById[linked.id] : undefined;
              return (
                <div key={item.id} className="mb-3 grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 border-b pb-3 last:mb-0 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_auto_auto_auto_auto]">
                  <div className="col-span-4 sm:col-span-1">
                    <Label htmlFor={`itemDesc-${index}`}>Description *</Label>
                    <Input id={`itemDesc-${index}`} value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)}
                      placeholder={isPharmacy ? 'Start typing a pharmacy item' : 'Service / item name'}
                      list={isPharmacy && pharmacyItems.length > 0 ? 'pharmacyItemNames' : undefined} autoComplete="off" />
                    {linked === null && <p className="mt-1 text-xs text-muted-foreground">Not a pharmacy item, so stock won&apos;t change.</p>}
                    {linked && onHand !== undefined && (
                      <p className={`mt-1 text-xs ${onHand < item.quantity ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                        In stock: {formatQty(onHand)}{linked.unitOfMeasure ? ` ${linked.unitOfMeasure}` : ''}{onHand < item.quantity ? ' (not enough)' : ''}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`itemQty-${index}`}>Qty *</Label>
                    <Input id={`itemQty-${index}`} type="number" min="1" value={item.quantity}
                      onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="w-full px-2 text-center sm:w-16" />
                  </div>
                  <div>
                    <Label htmlFor={`itemPrice-${index}`} className="block">
                      Unit price *
                      {isPharmacy && !!item.originalUnitPrice && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {item.originalUnitPrice !== item.unitPrice ? `(${formatINR(item.originalUnitPrice)})` : '(list)'}
                        </span>
                      )}
                    </Label>
                    <Input id={`itemPrice-${index}`} type="number" min="0" step="0.01" value={item.unitPrice}
                      onChange={e => handleItemChange(index, 'unitPrice', e.target.value)} className="w-full px-2 text-right sm:w-32" />
                  </div>
                  <div className="text-right">
                    <Label>Amount</Label>
                    <Input value={formatINR(item.total)} readOnly className="w-full bg-muted px-2 text-right sm:w-28" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="mb-1 self-end text-destructive hover:bg-destructive/10" title="Remove item">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" onClick={() => setBillItems([...billItems, newItem()])} className="mt-2 w-full md:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> {t('Add Item')}
            </Button>
          </Card>

          <p className="text-right">
            <span className="text-lg font-semibold">{t('Total')}:</span>
            <span className="ml-2 text-xl font-bold">{formatINR(grandTotal)}</span>
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="paymentMethod">Payment method *</Label>
              <Select onValueChange={setPaymentMethod} value={paymentMethod}>
                <SelectTrigger id="paymentMethod"><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>
                  {methodChoices(methodOptions, 'Bills', paymentMethod).map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="paymentStatus">Payment status *</Label>
              <Select onValueChange={value => handlePaymentStatusChange(value as PaymentStatus)} value={paymentStatus}>
                <SelectTrigger id="paymentStatus"><SelectValue placeholder="Select payment status" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map(status => <SelectItem key={status} value={status}>{t(status)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ProcessedByField id="processedBy" value={processedById} onChange={setProcessedById}
              staff={staffList} canAssign={canAssignProcessor} displayName={processedByName} />
            {paymentStatus === 'Paid' && (
              <div>
                <Label htmlFor="paymentDate">Payment date *</Label>
                <DateField id="paymentDate" value={paymentDate} onChange={setPaymentDate} required />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes / remarks</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes for this bill..." />
          </div>

          <div>
            <Label>Attachments (optional, images are resized automatically){attachments.length > 0 ? ` — ${attachments.length} added` : ''}</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ImageSourceButtons onFiles={addAttachments} className="flex-1" />
              {attachments.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAttachments([])} className="text-xs text-destructive">Clear all</Button>
              )}
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {attachments.map((attachment, index) => (
                  <div key={index} className="relative rounded-md border p-1">
                    <StoredImage path={attachment} alt={`Bill attachment ${index + 1}`} className="h-20 w-full rounded-md object-cover" />
                    <Button variant="destructive" size="icon" className="absolute -right-2 -top-2 h-5 w-5 rounded-full"
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))} aria-label="Remove attachment">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isEditMode && auditLog.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="bill-audit-log">
                <AccordionTrigger className="flex items-center text-sm hover:no-underline">
                  <span className="flex items-center"><History className="mr-2 h-4 w-4 text-muted-foreground" /> {t('Bill History')} ({auditLog.length})</span>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="max-h-60 space-y-3 overflow-y-auto pr-2">
                    {[...auditLog].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).map(log => (
                      <Card key={log.id} className="bg-muted/30 p-3 text-sm shadow-sm">
                        <p className="mb-1 text-xs text-muted-foreground">
                          {formatDate(log.timestamp, 'dd/MM/yyyy, HH:mm:ss')}
                          {log.staffName && <> by <span className="font-semibold text-foreground">{log.staffName}</span></>}
                        </p>
                        <p><span className="font-medium">{log.actionType}:</span> {log.changeDetails}</p>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" asChild><Link href="/billing">{t('Cancel')}</Link></Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : t('Save Bill')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
