"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/components/app-link';
import { Archive, Briefcase, List, Pill, PlusCircle, Receipt, Save, Trash2, Truck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { DateField, parseDMY } from '@/components/date-field';
import { ProcessedByField } from '@/components/processed-by-field';
import { useT } from '@/components/language-provider';
import { useStaff } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFeatures } from '@/hooks/use-features';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { FEE_ROLES } from '@/config/permissions';
import {
  materials as materialsRepo, medications as medicationsRepo, patients as patientsRepo, payments as paymentsRepo,
  referringDoctors as referringDoctorsRepo, staff as staffRepo, vendors as vendorsRepo,
} from '@/lib/data';
import { formatDate, formatINR, patientDisplayId, toDMY } from '@/lib/format';
import { methodChoices } from '@/types/paymentMethod';
import type { Payment, PaymentType } from '@/types/payment';
import type { AuditLogEntry, Patient } from '@/types/patient';
import type { ReferringDoctor } from '@/types/referringDoctor';
import type { StaffMember } from '@/types/staff';
import type { Vendor } from '@/types/vendor';

const PAYMENT_TYPES: PaymentType[] = ['Referral/CC', 'Material', 'Pharmacy', 'Salary', 'Doctor Fee', 'Other'];
const FEE_PAYMENT_TYPES: PaymentType[] = ['Doctor Fee', 'Referral/CC'];

// The lists each payment type needs; loaded only when that type is chosen.
interface Lists {
  doctors?: ReferringDoctor[];
  staff?: StaffMember[];
  vendors?: Vendor[];
  medications?: CatalogItem[];
  materials?: CatalogItem[];
  feeCases?: Patient[];
}
type ListKey = keyof Lists;
interface CatalogItem { id: string; name: string; listPrice?: number }

const LOADERS: Record<ListKey, (includeIds: number[]) => Promise<Lists[ListKey]>> = {
  doctors: () => referringDoctorsRepo.list(),
  staff: () => staffRepo.list(),
  vendors: () => vendorsRepo.list(),
  medications: () => medicationsRepo.list(),
  materials: () => materialsRepo.list(),
  feeCases: includeIds => patientsRepo.listFeeCases(includeIds),
};

function listsFor(type: PaymentType, isEditMode: boolean): ListKey[] {
  switch (type) {
    case 'Referral/CC': return ['doctors', 'feeCases'];
    case 'Doctor Fee': return isEditMode ? ['staff', 'feeCases'] : ['staff'];
    case 'Salary': return ['staff'];
    case 'Pharmacy': return ['vendors', 'medications'];
    case 'Material': return ['vendors', 'materials'];
    default: return [];
  }
}

// One purchased pharmacy item or material (stored as purchasedMedications / purchasedMaterials).
interface PurchaseLine { itemId: string; name: string; quantityPurchased: number; unitPriceAtPurchase?: number; listPriceSnapshot?: number }

const lineTotal = (lines: PurchaseLine[]) =>
  lines.reduce((sum, line) => sum + line.quantityPurchased * (line.unitPriceAtPurchase ?? line.listPriceSnapshot ?? 0), 0);

export default function PaymentFormPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const currentUser = useStaff();
  const { isOn } = useFeatures();
  const methodOptions = usePaymentMethods();

  const paymentIdToEdit = searchParams.get('paymentId');
  const isEditMode = Boolean(paymentIdToEdit);
  const canAssignProcessor = currentUser.role === 'Super Admin';

  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentDate, setPaymentDate] = useState(toDMY(new Date()));
  const [paymentType, setPaymentType] = useState<PaymentType>('');
  const [payeeId, setPayeeId] = useState(''); // referring doctor or staff member
  const [vendorId, setVendorId] = useState('');
  const [payeeName, setPayeeName] = useState(''); // "Other"
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  // Who processed the payment: the person recording it, unless the Super Admin picks someone else.
  const [processedById, setProcessedById] = useState(isEditMode ? '' : String(currentUser.id));
  const [processedByName, setProcessedByName] = useState<string | null>(isEditMode ? null : currentUser.name);
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [selectedPatientIds, setSelectedPatientIds] = useState<number[]>([]);
  // The patients an existing fee payment covered (shown when editing).
  const [originalPatientIds, setOriginalPatientIds] = useState<number[]>([]);
  // Doctor Fee (new payment): the doctor's cases whose fee is still unpaid.
  const [unpaidDoctorCases, setUnpaidDoctorCases] = useState<Patient[]>([]);

  const [lists, setLists] = useState<Lists>({});
  const requested = useRef(new Set<ListKey>());

  // Loads the lists the chosen payment type needs (and the staff list for the Super Admin's
  // "Processed by" choice), each once.
  useEffect(() => {
    const keys: ListKey[] = [...listsFor(paymentType, isEditMode), ...(canAssignProcessor ? ['staff' as const] : [])];
    for (const key of keys) {
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      LOADERS[key](originalPatientIds)
        .then(list => setLists(prev => ({ ...prev, [key]: list })))
        .catch(error => {
          requested.current.delete(key);
          console.error(`Could not load ${key}`, error);
          toast({ title: t('Error'), description: 'Could not load the lists for this payment type.', variant: 'destructive' });
        });
    }
  }, [paymentType, isEditMode, canAssignProcessor, originalPatientIds, toast, t]);

  useEffect(() => {
    if (!paymentIdToEdit) return;
    let cancelled = false;
    paymentsRepo.get(paymentIdToEdit).catch(() => null).then(payment => {
      if (cancelled) return;
      if (!payment) {
        toast({ title: 'Payment not found', variant: 'destructive' });
        router.push('/payments');
        return;
      }
      setPaymentDate(payment.paymentDate);
      setPaymentType(payment.paymentType);
      setDescription(payment.description);
      setAmount(String(payment.amount));
      setPaymentMethod(payment.paymentMethod);
      setProcessedById(payment.recordedByStaffId ? String(payment.recordedByStaffId) : '');
      setProcessedByName(payment.recordedByStaffName ?? null);
      setTransactionId(payment.transactionId || '');
      setNotes(payment.notes || '');
      setLines([
        ...(payment.purchasedMedications ?? []).map(({ medicationId, medicationName, ...rest }) => ({ itemId: medicationId, name: medicationName, ...rest })),
        ...(payment.purchasedMaterials ?? []).map(({ materialId, materialName, ...rest }) => ({ itemId: materialId, name: materialName, ...rest })),
      ]);
      setAuditLog(payment.auditLog || []);
      setSelectedPatientIds(payment.associatedPatientIds || []);
      setOriginalPatientIds(payment.associatedPatientIds || []);
      if (payment.payeeType === 'ReferringDoctor' || payment.payeeType === 'StaffMember') setPayeeId(String(payment.payeeId ?? ''));
      else if (payment.payeeType === 'Vendor' && payment.payeeId) setVendorId(String(payment.payeeId));
      else if (payment.payeeName) setPayeeName(payment.payeeName);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [paymentIdToEdit, router, toast]);

  // Referral fee for a patient: their own fee, else the referring doctor's default.
  const referralFeeFor = useCallback((patient: Patient) => {
    if (patient.referralFee != null) return { fee: patient.referralFee, isDefault: false };
    const doctor = lists.doctors?.find(d => d.id === patient.referredDoctorId);
    return { fee: doctor?.defaultReferralFee ?? null, isDefault: doctor?.defaultReferralFee != null };
  }, [lists.doctors]);

  // Referral/CC: new payments list referrals not yet paid; an existing payment shows the ones it paid.
  const referredPatients = useMemo(() => {
    if (paymentType !== 'Referral/CC' || !payeeId) return [];
    return (lists.feeCases ?? []).filter(p => p.referredDoctorId === Number(payeeId)
      && (isEditMode ? originalPatientIds.includes(p.id) : p.referralFeeStatus !== 'Paid'));
  }, [paymentType, payeeId, lists.feeCases, isEditMode, originalPatientIds]);

  // Doctor Fee: an existing payment shows the cases it paid for, which can't be changed.
  const doctorCases = useMemo(() => {
    if (paymentType !== 'Doctor Fee' || !payeeId) return [];
    return isEditMode ? (lists.feeCases ?? []).filter(p => originalPatientIds.includes(p.id)) : unpaidDoctorCases;
  }, [paymentType, payeeId, isEditMode, lists.feeCases, originalPatientIds, unpaidDoctorCases]);

  useEffect(() => {
    if (paymentType !== 'Doctor Fee' || !payeeId || isEditMode) { setUnpaidDoctorCases([]); return; }
    let cancelled = false;
    patientsRepo.listUnpaidDoctorCases(Number(payeeId))
      .then(cases => {
        if (cancelled) return;
        setUnpaidDoctorCases(cases);
        setSelectedPatientIds(cases.map(c => c.id));
      })
      .catch(error => console.error("Could not load the doctor's cases", error));
    return () => { cancelled = true; };
  }, [paymentType, payeeId, isEditMode]);

  // New fee payments: the amount is the total of the selected cases' fees.
  useEffect(() => {
    if (isEditMode) return;
    if (paymentType === 'Doctor Fee') {
      const total = doctorCases.filter(c => selectedPatientIds.includes(c.id)).reduce((sum, c) => sum + (c.doctorFee ?? 0), 0);
      setAmount(total > 0 ? total.toFixed(2) : '');
      const count = selectedPatientIds.length;
      setDescription(prev => (!prev.trim() || prev.startsWith('Doctor fee for ')
        ? (count > 0 ? `Doctor fee for ${count} case${count === 1 ? '' : 's'}` : '')
        : prev));
    } else if (paymentType === 'Referral/CC' && selectedPatientIds.length > 0) {
      const total = referredPatients.filter(p => selectedPatientIds.includes(p.id)).reduce((sum, p) => sum + (referralFeeFor(p).fee ?? 0), 0);
      if (total > 0) setAmount(total.toFixed(2));
    }
  }, [paymentType, isEditMode, doctorCases, referredPatients, selectedPatientIds, referralFeeFor]);

  const isPurchase = paymentType === 'Pharmacy' || paymentType === 'Material';
  const catalog = (paymentType === 'Pharmacy' ? lists.medications : paymentType === 'Material' ? lists.materials : undefined) ?? [];
  const itemsDecideAmount = isPurchase && lines.length > 0;
  const amountReadOnly = itemsDecideAmount || paymentType === 'Doctor Fee';
  const shownAmount = itemsDecideAmount ? lineTotal(lines).toFixed(2) : amount;

  const handlePaymentTypeChange = (type: PaymentType) => {
    setPaymentType(type);
    setPayeeId('');
    setPayeeName('');
    setVendorId('');
    setSelectedPatientIds([]);
    setLines([]);
  };

  const togglePatient = (patientId: number, checked: boolean | string) =>
    setSelectedPatientIds(prev => (checked ? [...prev, patientId] : prev.filter(id => id !== patientId)));

  const updateLine = (index: number, change: Partial<PurchaseLine>) =>
    setLines(prev => prev.map((line, i) => (i === index ? { ...line, ...change } : line)));

  const chooseLineItem = (index: number, itemId: string) => {
    const item = catalog.find(c => c.id === itemId);
    updateLine(index, { itemId, name: item?.name || '', listPriceSnapshot: item?.listPrice, unitPriceAtPurchase: item?.listPrice });
  };

  const invalid = (title: string, description?: string) => toast({ title, description, variant: 'destructive' });

  const handleSubmit = async () => {
    if (!parseDMY(paymentDate)) return invalid('Check the payment date', 'Use the form dd/mm/yyyy.');
    if (!paymentType) return invalid('Choose the payment type');
    if (!description.trim()) return invalid('Enter a description');
    if (isPurchase && lines.some(line => !line.itemId || line.quantityPurchased <= 0)) {
      return invalid('Check the items', 'Every item needs to be chosen and have a quantity above 0.');
    }
    // Purchases with items are worth the items' total.
    const finalAmount = itemsDecideAmount ? lineTotal(lines) : parseFloat(amount);
    if (!(finalAmount > 0)) return invalid('Check the amount', 'The amount must be more than 0.');
    if (!paymentMethod) return invalid('Choose the payment method');

    let payee: Pick<Payment, 'payeeId' | 'payeeName' | 'payeeType'> = {};
    if (paymentType === 'Referral/CC') {
      const doctor = lists.doctors?.find(d => String(d.id) === payeeId);
      if (!doctor) return invalid('Choose the referring doctor');
      payee = { payeeId: doctor.id, payeeName: doctor.name, payeeType: 'ReferringDoctor' };
    } else if (paymentType === 'Doctor Fee' || paymentType === 'Salary') {
      const member = lists.staff?.find(s => String(s.id) === payeeId);
      if (!member) return invalid(paymentType === 'Doctor Fee' ? 'Choose the doctor being paid' : 'Choose the staff member');
      if (paymentType === 'Doctor Fee' && !isEditMode && selectedPatientIds.length === 0) return invalid('Select at least one case to pay for');
      payee = { payeeId: member.id, payeeName: member.name, payeeType: 'StaffMember' };
    } else if (isPurchase) {
      const vendor = lists.vendors?.find(v => v.id === vendorId);
      if (!vendor) return invalid('Choose the vendor');
      payee = { payeeId: vendor.id, payeeName: vendor.name, payeeType: 'Vendor' };
    } else if (paymentType === 'Other') {
      if (!payeeName.trim()) return invalid('Enter the payee name');
      payee = { payeeName: payeeName.trim(), payeeType: 'Other' };
    }

    const isFee = FEE_PAYMENT_TYPES.includes(paymentType);
    const paymentData: Omit<Payment, 'id' | 'createdAt' | 'auditLog' | 'recordedByStaffId' | 'recordedByStaffName'> = {
      paymentDate,
      paymentType,
      ...payee,
      description: description.trim(),
      amount: finalAmount,
      paymentMethod,
      transactionId: transactionId.trim() || undefined,
      notes: notes.trim() || undefined,
      associatedPatientIds: isFee ? selectedPatientIds : undefined,
      purchasedMedications: paymentType === 'Pharmacy'
        ? lines.map(({ itemId, name, ...rest }) => ({ medicationId: itemId, medicationName: name, ...rest })) : undefined,
      purchasedMaterials: paymentType === 'Material'
        ? lines.map(({ itemId, name, ...rest }) => ({ materialId: itemId, materialName: name, ...rest })) : undefined,
    };

    let auditDetails = isEditMode
      ? `Payment ${paymentIdToEdit} details updated. Amount: ${formatINR(finalAmount)}.`
      : `New payment recorded for ${payee.payeeName || 'N/A'}. Amount: ${formatINR(finalAmount)}.`;
    if (paymentType === 'Referral/CC' && selectedPatientIds.length > 0) auditDetails += ` Associated patients count: ${selectedPatientIds.length}.`;
    if (isPurchase && lines.length > 0) auditDetails += ` ${paymentType === 'Pharmacy' ? 'Pharmacy' : 'Material'} items listed: ${lines.length}.`;

    setIsSaving(true);
    try {
      if (paymentIdToEdit) {
        // Only the Super Admin may change who processed it; others leave it as it was.
        await paymentsRepo.update(paymentIdToEdit,
          canAssignProcessor && processedById ? { ...paymentData, recordedByStaffId: Number(processedById) } : paymentData,
          { actionType: 'Payment Updated', details: auditDetails });
        toast({ title: 'Payment saved', description: paymentIdToEdit });
      } else {
        const created = await paymentsRepo.create(
          { ...paymentData, recordedByStaffId: processedById ? Number(processedById) : currentUser.id, recordedByStaffName: processedByName ?? currentUser.name },
          auditDetails,
        );
        // Mark the cases as paid so they aren't paid twice.
        if (paymentType === 'Doctor Fee') await patientsRepo.setDoctorFeePayment(selectedPatientIds, created.id);
        if (paymentType === 'Referral/CC' && selectedPatientIds.length > 0) {
          await patientsRepo.setReferralFeePayment(
            referredPatients.filter(p => selectedPatientIds.includes(p.id)).map(p => ({ patientId: p.id, fee: referralFeeFor(p).fee })),
            created.id,
          );
        }
        toast({ title: 'Payment saved', description: created.id });
      }
      router.push('/payments');
    } catch (e) {
      console.error('Failed to save payment', e);
      invalid('Could not save the payment', e instanceof Error ? e.message : undefined);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  const typeOptions = PAYMENT_TYPES
    .filter(type => !FEE_PAYMENT_TYPES.includes(type) || FEE_ROLES.includes(currentUser.role) || paymentType === type)
    .filter(type => paymentType === type || ((type !== 'Doctor Fee' || isOn('doctorFees')) && (type !== 'Referral/CC' || isOn('referralFees'))));

  return (
    <PageBody width="narrow">
      <PageHeader icon={Receipt} back={{ href: '/payments' }}
        title={isEditMode ? `${t('Edit Payment')} ${paymentIdToEdit}` : t('New Payment')}
        description={isEditMode ? undefined : t('Record money paid out by the hospital.')} />

      <Card>
        <CardContent className="grid gap-6 pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="paymentDate">Payment date *</Label>
              <DateField id="paymentDate" value={paymentDate} onChange={setPaymentDate} required />
            </div>
            <div>
              <Label htmlFor="paymentType">Payment type *</Label>
              <Select onValueChange={value => handlePaymentTypeChange(value as PaymentType)} value={paymentType}>
                <SelectTrigger id="paymentType"><SelectValue placeholder="Select payment type" /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map(type => <SelectItem key={type} value={type}>{t(type)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentType === 'Referral/CC' && (
            <>
              <div>
                <Label htmlFor="referringDoctorPayee">Referring doctor *</Label>
                <div className="flex items-center gap-2">
                  {/* Choosing a different referring doctor starts a fresh selection. */}
                  <Select onValueChange={id => { setPayeeId(id); if (!isEditMode) setSelectedPatientIds([]); }} value={payeeId}>
                    <SelectTrigger id="referringDoctorPayee" className="min-w-0 flex-grow"><SelectValue placeholder={lists.doctors ? 'Select referring doctor' : t('Loading...')} /></SelectTrigger>
                    <SelectContent>
                      {lists.doctors?.length ? lists.doctors.map(doc => <SelectItem key={doc.id} value={String(doc.id)}>{doc.name} - {doc.location}</SelectItem>)
                        : <div className="p-2 text-center text-sm text-muted-foreground">No referring doctors found.</div>}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" asChild aria-label="Add new referring doctor" title="Add new referring doctor">
                    <Link href="/referring-doctors/form"><UserPlus className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
              {referredPatients.length > 0 ? (
                <Card className="bg-muted/50 p-3">
                  <CardHeader className="mb-2 p-0">
                    <CardTitle className="flex items-center text-sm font-medium">
                      <List className="mr-2 h-4 w-4 text-primary" />
                      {isEditMode ? t('Referrals paid by this payment') : t('Unpaid referrals')}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {isEditMode ? '' : 'Tick the ones this payment covers. '}Referral fees are paid by the hospital to the referring doctor; they are not charged to the patient.
                    </p>
                  </CardHeader>
                  <CardContent className="max-h-48 space-y-2 overflow-y-auto p-0 text-sm">
                    {referredPatients.map(patient => {
                      const { fee, isDefault } = referralFeeFor(patient);
                      return (
                        <div key={patient.id} className="flex items-center space-x-2 border-b p-1.5 last:border-b-0">
                          <Checkbox id={`patient-${patient.id}`} checked={selectedPatientIds.includes(patient.id)}
                            onCheckedChange={checked => togglePatient(patient.id, checked)} />
                          <Label htmlFor={`patient-${patient.id}`} className="flex-grow cursor-pointer text-sm font-normal">
                            {patient.firstName} {patient.lastName} (ID: {patientDisplayId(patient.id)})
                            <span className="block text-xs text-muted-foreground">Reason: {patient.reasonForVisit || '—'}</span>
                          </Label>
                          <span className="text-right text-sm font-medium">
                            {fee != null
                              ? `${formatINR(fee)}${isDefault ? ' (default)' : ''}${patient.referralFeeBasis?.mode === 'percent' ? ' (% of procedures)' : ''}`
                              : 'No fee set — set it on the patient page'}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : payeeId && lists.feeCases && (
                <p className="mt-1 text-sm text-muted-foreground">No unpaid referrals for this doctor.</p>
              )}
            </>
          )}

          {paymentType === 'Doctor Fee' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="doctorFeePayee">Doctor *</Label>
                <Select onValueChange={setPayeeId} value={payeeId} disabled={isEditMode}>
                  <SelectTrigger id="doctorFeePayee"><SelectValue placeholder="Select the doctor being paid" /></SelectTrigger>
                  <SelectContent>
                    {(lists.staff ?? []).filter(s => s.role === 'Doctor').map(doctor => <SelectItem key={doctor.id} value={String(doctor.id)}>{doctor.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {payeeId && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{isEditMode ? t('Cases paid by this payment') : t('Unpaid cases')}</CardTitle>
                    {!isEditMode && <CardDescription>Cases where this doctor is the attending doctor and the fee is still pending. Set fees on each patient&apos;s page (Department &amp; Care Team).</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {doctorCases.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{isEditMode ? 'No cases recorded.' : 'No unpaid cases for this doctor.'}</p>
                    ) : doctorCases.map(c => (
                      <label key={c.id} htmlFor={`case-${c.id}`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-background px-3 py-2">
                        <Checkbox id={`case-${c.id}`} className="h-5 w-5" disabled={isEditMode}
                          checked={selectedPatientIds.includes(c.id)} onCheckedChange={checked => togglePatient(c.id, checked)} />
                        <span className="flex-grow text-sm">
                          {c.firstName} {c.lastName} <span className="text-muted-foreground">(ID: {patientDisplayId(c.id)}{c.admissionDate ? `, admitted ${formatDate(c.admissionDate, 'dd/MM/yyyy')}` : ''})</span>
                        </span>
                        <span className="text-sm font-medium">{formatINR(c.doctorFee)}</span>
                      </label>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {paymentType === 'Salary' && (
            <div>
              <Label htmlFor="staffMemberPayee">Staff member *</Label>
              <div className="flex items-center gap-2">
                <Select onValueChange={setPayeeId} value={payeeId}>
                  <SelectTrigger id="staffMemberPayee" className="min-w-0 flex-grow"><SelectValue placeholder={lists.staff ? 'Select staff member' : t('Loading...')} /></SelectTrigger>
                  <SelectContent>
                    {lists.staff?.length ? lists.staff.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)
                      : <div className="p-2 text-center text-sm text-muted-foreground">No staff members found.</div>}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" asChild aria-label="Add new staff member" title="Add new staff member">
                  <Link href="/staff/form"><Briefcase className="h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          )}

          {isPurchase && (
            <div>
              <Label htmlFor="vendorPayee">Vendor *</Label>
              <div className="flex items-center gap-2">
                <Select onValueChange={setVendorId} value={vendorId}>
                  <SelectTrigger id="vendorPayee" className="min-w-0 flex-grow"><SelectValue placeholder={lists.vendors ? 'Select vendor' : t('Loading...')} /></SelectTrigger>
                  <SelectContent>
                    {lists.vendors?.length ? lists.vendors.map(vendor => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)
                      : <div className="p-2 text-center text-sm text-muted-foreground">No vendors found. <Link href="/vendors/form" className="text-primary underline">Add one?</Link></div>}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" asChild aria-label="Add new vendor" title="Add new vendor">
                  <Link href="/vendors/form"><Truck className="h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          )}

          {paymentType === 'Other' && (
            <div>
              <Label htmlFor="payeeNameInputOther">Payee name *</Label>
              <Input id="payeeNameInputOther" value={payeeName} onChange={e => setPayeeName(e.target.value)} placeholder="Enter payee name" />
            </div>
          )}

          <div>
            <Label htmlFor="description">Description * (reason for payment)</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Payment for Jan referral, Office supplies purchase, Pharmacy Order #123" />
          </div>

          {isPurchase && (
            <Card className="bg-muted/50 p-4">
              <CardHeader className="mb-3 flex flex-row flex-wrap items-center justify-between gap-2 p-0">
                <CardTitle className="text-base">{paymentType === 'Pharmacy' ? t('Pharmacy Items Purchased') : t('Materials Purchased')}</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link href={paymentType === 'Pharmacy' ? '/pharmacy/form' : '/materials/form'}>
                    {paymentType === 'Pharmacy' ? <Pill className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />} Add new to catalog
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 p-0">
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-[1fr_auto_auto] items-end gap-2 border-b pb-2 last:border-b-0 md:grid-cols-[1fr_auto_auto_auto]">
                    <div className="col-span-3 md:col-span-1">
                      <Label htmlFor={`item-${index}`}>{paymentType === 'Pharmacy' ? 'Pharmacy item' : 'Material'} *</Label>
                      <Select value={line.itemId} onValueChange={value => chooseLineItem(index, value)}>
                        <SelectTrigger id={`item-${index}`}><SelectValue placeholder={line.name || 'Select item'} /></SelectTrigger>
                        <SelectContent>
                          {catalog.map(item => <SelectItem key={item.id} value={item.id}>{item.name} (list: {formatINR(item.listPrice)})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`itemQty-${index}`}>Qty *</Label>
                      <Input id={`itemQty-${index}`} type="number" min="1" value={line.quantityPurchased} className="w-20 text-center"
                        onChange={e => updateLine(index, { quantityPurchased: Math.max(0, Number(e.target.value)) })} />
                    </div>
                    <div>
                      <Label htmlFor={`itemPrice-${index}`}>Unit price paid</Label>
                      <Input id={`itemPrice-${index}`} type="number" min="0" step="0.01" value={line.unitPriceAtPurchase ?? ''} className="w-28 text-right"
                        placeholder={`List: ${(line.listPriceSnapshot || 0).toFixed(2)}`}
                        onChange={e => {
                          const price = parseFloat(e.target.value);
                          updateLine(index, { unitPriceAtPurchase: Number.isNaN(price) ? undefined : Math.max(0, price) });
                        }} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, i) => i !== index))} className="mb-1 self-end text-destructive hover:bg-destructive/10" title="Remove item">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" className="mt-2 w-full md:w-auto"
                  onClick={() => setLines([...lines, { itemId: '', name: '', quantityPurchased: 1, listPriceSnapshot: 0 }])}>
                  <PlusCircle className="mr-2 h-4 w-4" /> {t('Add Item')}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="amount">Total amount paid (₹) *</Label>
              <Input id="amount" type="number" min="0.01" step="0.01" placeholder="e.g., 5000.00"
                value={shownAmount} onChange={e => setAmount(e.target.value)}
                readOnly={amountReadOnly} className={amountReadOnly ? 'bg-muted' : ''} />
              {itemsDecideAmount && <p className="mt-1 text-xs text-muted-foreground">Total calculated from items.</p>}
              {paymentType === 'Doctor Fee' && <p className="mt-1 text-xs text-muted-foreground">Total of the selected cases&apos; doctor fees.</p>}
            </div>
            <div>
              <Label htmlFor="paymentMethod">Payment method *</Label>
              <Select onValueChange={setPaymentMethod} value={paymentMethod}>
                <SelectTrigger id="paymentMethod"><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>
                  {methodChoices(methodOptions, 'Payments', paymentMethod).map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ProcessedByField id="processedBy" value={processedById} onChange={setProcessedById}
              staff={lists.staff ?? []} canAssign={canAssignProcessor} displayName={processedByName} />
          </div>

          <div>
            <Label htmlFor="transactionId">Transaction ID / cheque no. (optional)</Label>
            <Input id="transactionId" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="e.g., CHQ12345, UPI Ref XXXXX" />
          </div>

          <div>
            <Label htmlFor="notes">Additional notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any other relevant details..." />
          </div>

          {isEditMode && auditLog.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="payment-audit-log">
                <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline">{t('Payment History')} ({auditLog.length})</AccordionTrigger>
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
          <Button variant="outline" asChild><Link href="/payments">{t('Cancel')}</Link></Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : t('Save Payment')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
