"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/app-link';
import { Download, Eye, PlusCircle, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { MethodTotals } from '@/components/method-totals';
import { DEFAULT_DATE_FILTER, DateRangeFilter, dateFilterRange, describeDateFilter, type DateFilterValue } from '@/components/date-range-filter';
import { useFormat, useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { useFeatures } from '@/hooks/use-features';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { patients as patientsRepo, payments as paymentsRepo, staff as staffRepo } from '@/lib/data';
import { csvFilename, downloadCsv } from '@/lib/csv';
import { DMY, formatDate, formatINR } from '@/lib/format';
import type { Payment, PurchasedMaterialItem, PurchasedMedicationItem } from '@/types/payment';
import type { StaffMember } from '@/types/staff';

const PAYMENT_TYPES = ['Salary', 'Material', 'Pharmacy', 'Doctor Fee', 'Referral/CC', 'Other'];

const newestFirst = (a: Payment, b: Payment) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);

function PurchaseTable({ title, items }: { title: string; items: Array<PurchasedMedicationItem | PurchasedMaterialItem> }) {
  const price = (n?: number) => (n !== undefined ? formatINR(n) : '—');
  return (
    <div className="mt-3">
      <h4 className="mb-1 text-sm font-semibold">{title}</h4>
      <Table className="rounded-md bg-background text-xs [&_td]:py-1 [&_th]:h-8">
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price paid</TableHead>
            <TableHead className="text-right">List price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
              <TableCell>{'medicationName' in item ? item.medicationName : item.materialName}</TableCell>
              <TableCell className="text-right">{item.quantityPurchased}</TableCell>
              <TableCell className="text-right">{price(item.unitPriceAtPurchase)}</TableCell>
              <TableCell className="text-right">{price(item.listPriceSnapshot)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Outgoing payments for a period (the filters run in the database).
export default function PaymentsPage() {
  const t = useT();
  const { date } = useFormat();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const methodOptions = usePaymentMethods();

  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [patientNames, setPatientNames] = useState<Map<number, string> | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const [filterMethod, setFilterMethod] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterProcessedBy, setFilterProcessedBy] = useState('All');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  useEffect(() => { staffRepo.list().then(setStaffList).catch(() => setStaffList([])); }, []);

  useEffect(() => {
    let live = true;
    setIsFiltering(true);
    paymentsRepo.list({
      ...dateFilterRange(dateFilter),
      method: filterMethod === 'All' ? undefined : filterMethod,
      type: filterType === 'All' ? undefined : filterType,
      recordedBy: filterProcessedBy === 'All' ? undefined : Number(filterProcessedBy),
    })
      .then(list => { if (live) setPayments(list.sort(newestFirst)); })
      .catch(error => {
        console.error('Error loading payments:', error);
        if (!live) return;
        toast({ title: t('Error'), description: 'Could not load payments.', variant: 'destructive' });
        setPayments([]);
      })
      .finally(() => { if (live) setIsFiltering(false); });
    return () => { live = false; };
  }, [toast, t, dateFilter, filterMethod, filterType, filterProcessedBy]);

  // Names of the patients the listed fee payments cover (only those patients).
  const coveredIds = useMemo(() => (payments ?? []).flatMap(p => p.associatedPatientIds ?? []).sort((a, b) => a - b).join(','), [payments]);
  useEffect(() => {
    if (!coveredIds) return;
    patientsRepo.namesByIds(coveredIds.split(',').map(Number))
      .then(setPatientNames)
      .catch(() => setPatientNames(new Map()));
  }, [coveredIds]);

  const handleDownloadCSV = () => {
    if (!payments?.length) {
      toast({ title: 'Nothing to download', description: 'No payments match these filters.' });
      return;
    }
    downloadCsv([
      ['Payment ID', 'Payment Date', 'Payment Type', 'Payee Name', 'Payee Type', 'Description', 'Amount', 'Payment Method', 'Transaction ID', 'Notes', 'Processed By', 'Created At'],
      ...payments.map(p => [
        p.id, formatDate(p.paymentDate, DMY), p.paymentType || 'N/A', p.payeeName || 'N/A', p.payeeType || 'N/A',
        p.description, p.amount.toFixed(2), p.paymentMethod || 'N/A', p.transactionId || '', p.notes || '',
        p.recordedByStaffName || 'N/A', formatDate(p.createdAt, DMY),
      ]),
    ], csvFilename('payments', dateFilterRange(dateFilter)));
  };

  if (!payments) return <PageLoading />;

  const anyFilter = dateFilter.preset !== 'all' || filterMethod !== 'All' || filterType !== 'All' || filterProcessedBy !== 'All';
  const typeOptions = PAYMENT_TYPES.filter(type => (type !== 'Doctor Fee' || isOn('doctorFees')) && (type !== 'Referral/CC' || isOn('referralFees')));

  return (
    <PageBody>
      <PageHeader icon={Receipt} title={t('Payments')} description={t('Money paid out: salaries, purchases, doctor and referral fees.')}
        actions={<>
          <Button variant="outline" onClick={handleDownloadCSV}><Download className="mr-2 h-4 w-4" /> {t('Download CSV')}</Button>
          <Button asChild><Link href="/payments/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('New Payment')}</Link></Button>
        </>} />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap sm:items-end">
          <DateRangeFilter value={dateFilter} onChange={setDateFilter} idPrefix="paymentsDate" />
          <div className="sm:w-44">
            <Label htmlFor="filterPaymentType">Payment type</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger id="filterPaymentType"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">{t('All')}</SelectItem>
                {typeOptions.map(type => <SelectItem key={type} value={type}>{t(type)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-44">
            <Label htmlFor="filterPaymentMethod">Payment method</Label>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger id="filterPaymentMethod"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">{t('All')}</SelectItem>
                {methodOptions.filter(m => m.usedFor !== 'Bills').map(m => <SelectItem key={m.id} value={m.name}>{m.name}{m.active ? '' : ' (off)'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-48">
            <Label htmlFor="filterPaymentProcessedBy">Processed by</Label>
            <Select value={filterProcessedBy} onValueChange={setFilterProcessedBy}>
              <SelectTrigger id="filterPaymentProcessedBy"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Anyone</SelectItem>
                {staffList.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!isFiltering && <MethodTotals label="Paid out" rows={payments.map(p => ({ method: p.paymentMethod, amount: p.amount }))} />}
          <p className="w-full text-sm text-muted-foreground" role="status">
            {isFiltering ? t('Loading...') : `${payments.length} payment${payments.length === 1 ? '' : 's'} · ${formatINR(payments.reduce((sum, p) => sum + p.amount, 0))} · ${describeDateFilter(dateFilter, t)}`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Recorded Payments')}</CardTitle>
          <CardDescription>{dateFilter.preset === 'all' ? 'All outgoing payments' : `Outgoing payments dated ${describeDateFilter(dateFilter)}`}, newest first.</CardDescription>
          {payments.length > 0 && (
            <div className="mt-2 flex w-full border-b pb-2 text-sm font-semibold text-muted-foreground">
              <span className="w-[25%] truncate sm:w-[20%]">Payment ID</span>
              <span className="w-[40%] truncate pl-2 sm:w-[30%]">Payee</span>
              <span className="hidden w-[15%] truncate text-center sm:inline">Date</span>
              <span className="w-[35%] truncate text-right sm:w-[20%]">Amount</span>
              <span className="hidden w-[15%] truncate text-right sm:inline">Type</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {anyFilter ? 'No payments match these filters. Choose a longer period, "All time" or other filters.' : 'No payments yet. Use "New Payment" to record one.'}
            </p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {payments.map(payment => (
                <AccordionItem value={payment.id} key={payment.id}>
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex w-full items-center text-sm">
                      <span className="w-[25%] truncate font-medium text-primary sm:w-[20%]">{payment.id}</span>
                      <span className="w-[40%] truncate pl-2 sm:w-[30%]">{payment.payeeName || '—'}</span>
                      <span className="hidden w-[15%] text-center sm:inline">{date(payment.paymentDate)}</span>
                      <span className="w-[35%] text-right font-semibold sm:w-[20%]">{formatINR(payment.amount)}</span>
                      <span className="hidden w-[15%] truncate rounded-full bg-muted px-2 py-0.5 text-right text-xs text-muted-foreground sm:inline">{payment.paymentType ? t(payment.paymentType) : '—'}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Card className="bg-muted/50 p-4 shadow-inner">
                      <div className="mb-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm md:grid-cols-2">
                        <p><span className="font-medium">Payment ID:</span> {payment.id}</p>
                        <p><span className="font-medium">Payment date:</span> {date(payment.paymentDate)}</p>
                        <p><span className="font-medium">Payment type:</span> {payment.paymentType ? t(payment.paymentType) : '—'}</p>
                        <p><span className="font-medium">Payee:</span> {payment.payeeName || '—'} ({payment.payeeType || '—'})</p>
                        <p className="md:col-span-2"><span className="font-medium">Description:</span> {payment.description}</p>
                        <p><span className="font-medium">Amount:</span> {formatINR(payment.amount)}</p>
                        <p><span className="font-medium">Payment method:</span> {payment.paymentMethod}</p>
                        {payment.transactionId && <p><span className="font-medium">Transaction ID:</span> {payment.transactionId}</p>}
                        {payment.notes && <p className="md:col-span-2"><span className="font-medium">Notes:</span> {payment.notes}</p>}
                        {payment.recordedByStaffName && <p><span className="font-medium">Processed by:</span> {payment.recordedByStaffName}</p>}
                        <p><span className="font-medium">Recorded at:</span> {formatDate(payment.createdAt, 'dd/MM/yyyy HH:mm')}</p>
                        {!!payment.associatedPatientIds?.length && (
                          <p className="md:col-span-2">
                            <span className="font-medium">Patients:</span>{' '}
                            {payment.associatedPatientIds.map(id => patientNames?.get(id) ?? `Patient ID: ${id}`).join(', ')}
                          </p>
                        )}
                      </div>
                      {payment.paymentType === 'Pharmacy' && !!payment.purchasedMedications?.length && (
                        <PurchaseTable title="Pharmacy items purchased" items={payment.purchasedMedications} />
                      )}
                      {payment.paymentType === 'Material' && !!payment.purchasedMaterials?.length && (
                        <PurchaseTable title="Materials purchased" items={payment.purchasedMaterials} />
                      )}
                      <div className="mt-4 text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/payments/form?paymentId=${payment.id}`}><Eye className="mr-2 h-4 w-4" /> {t('View / Edit')}</Link>
                        </Button>
                      </div>
                    </Card>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
