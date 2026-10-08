"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Download, Eye, Pill, PlusCircle, Printer, Stethoscope, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { MethodTotals } from '@/components/method-totals';
import { DEFAULT_DATE_FILTER, DateRangeFilter, dateFilterRange, describeDateFilter, type DateFilterValue } from '@/components/date-range-filter';
import { useFormat, useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { bills as billsRepo, staff as staffRepo } from '@/lib/data';
import { downloadCsv, csvFilename } from '@/lib/csv';
import { DMY, formatDate, formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Bill, PaymentStatus } from '@/types/billing';
import type { StaffMember } from '@/types/staff';

const STATUSES: PaymentStatus[] = ['Paid', 'Unpaid', 'Partially Paid', 'Cancelled'];

const STATUS_COLORS: Record<string, string> = {
  'Unpaid': 'text-red-600',
  'Partially Paid': 'text-yellow-600',
  'Paid': 'text-emerald-700',
  'Cancelled': 'text-gray-500',
};

const newestFirst = (a: Bill, b: Bill) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);

// Bills for a period. The period, status, method and staff filters run in the database,
// so only matching bills are downloaded ("All time" + "Unpaid" finds every outstanding bill).
export default function BillingPage() {
  const t = useT();
  const { date } = useFormat();
  const { toast } = useToast();
  const methodOptions = usePaymentMethods();

  const [bills, setBills] = useState<Bill[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'All'>('All');
  const [filterMethod, setFilterMethod] = useState('All');
  const [filterProcessedBy, setFilterProcessedBy] = useState('All');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  useEffect(() => { staffRepo.list().then(setStaffList).catch(() => setStaffList([])); }, []);

  useEffect(() => {
    let live = true;
    setIsFiltering(true);
    billsRepo.list({
      ...dateFilterRange(dateFilter),
      status: filterStatus === 'All' ? undefined : filterStatus,
      method: filterMethod === 'All' ? undefined : filterMethod,
      processedBy: filterProcessedBy === 'All' ? undefined : Number(filterProcessedBy),
    })
      .then(list => { if (live) setBills(list); })
      .catch(error => {
        console.error('Error loading bills:', error);
        if (!live) return;
        toast({ title: t('Error'), description: 'Could not load bills.', variant: 'destructive' });
        setBills([]);
      })
      .finally(() => { if (live) setIsFiltering(false); });
    return () => { live = false; };
  }, [toast, t, dateFilter, filterStatus, filterMethod, filterProcessedBy]);

  const filteredBills = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (bills ?? [])
      .filter(bill => !term || bill.patientName.toLowerCase().includes(term) || bill.id.toLowerCase().includes(term))
      .sort(newestFirst);
  }, [bills, searchTerm]);

  const handleDownloadCSV = () => {
    if (filteredBills.length === 0) {
      toast({ title: 'Nothing to download', description: 'No bills match these filters.' });
      return;
    }
    const day = (value?: string) => (value ? formatDate(value, DMY) : '');
    downloadCsv([
      ['Bill ID', 'Patient ID', 'Patient Name', 'Bill Date', 'Bill Type', 'Total Amount', 'Payment Method', 'Payment Status', 'Payment Date', 'Processed By', 'Notes', 'Created At'],
      ...filteredBills.map(bill => [
        bill.id, bill.patientId, bill.patientName, day(bill.billDate), bill.billType || 'N/A',
        bill.totalAmount.toFixed(2), bill.paymentMethod || 'N/A', bill.paymentStatus || 'N/A',
        bill.paymentStatus === 'Paid' ? day(bill.paymentDate) : '',
        bill.processedByStaffName || '', bill.notes || '', day(bill.createdAt),
      ]),
    ], csvFilename('bills', dateFilterRange(dateFilter)));
  };

  const deleteBill = async (bill: Bill) => {
    if (!confirm(`Delete unpaid bill ${bill.id}?`)) return;
    try {
      await billsRepo.remove(bill.id);
      setBills(prev => prev?.filter(b => b.id !== bill.id) ?? null);
      toast({ title: 'Bill deleted', description: bill.id });
    } catch (error) {
      toast({ title: t('Error'), description: error instanceof Error ? error.message : 'Could not delete the bill.', variant: 'destructive' });
    }
  };

  if (!bills) return <PageLoading />;

  const filtersOn = dateFilter.preset !== 'all' || filterStatus !== 'All' || filterMethod !== 'All' || filterProcessedBy !== 'All';
  const emptyMessage = bills.length === 0
    ? (filtersOn ? 'No bills match these filters. Choose a longer period, "All time" or another status.' : 'No bills yet. Use "New Bill" to create one.')
    : filteredBills.length === 0 ? 'No bills match your search.' : null;

  return (
    <PageBody>
      <PageHeader icon={CreditCard} title={t('Billing')} description={t('Bills for patients: treatment and pharmacy.')}
        actions={<>
          <Button variant="outline" onClick={handleDownloadCSV}><Download className="mr-2 h-4 w-4" /> {t('Download CSV')}</Button>
          <Button asChild><Link href="/billing/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('New Bill')}</Link></Button>
        </>} />

      <Card>
        <CardHeader><CardTitle className="text-lg">{t('Filters')}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <DateRangeFilter value={dateFilter} onChange={setDateFilter} idPrefix="billsDate" className="w-full sm:w-auto [&_button]:mt-1" />
          <div className="w-full sm:flex-grow">
            <Label htmlFor="searchPatientName">Search by patient name or bill ID</Label>
            <Input id="searchPatientName" placeholder="Patient name or bill ID..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} className="mt-1" />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[200px]">
            <Label htmlFor="filterPaymentStatus">Payment status</Label>
            <Select value={filterStatus} onValueChange={value => setFilterStatus(value as PaymentStatus | 'All')}>
              <SelectTrigger id="filterPaymentStatus" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">{t('All')}</SelectItem>
                {STATUSES.map(status => <SelectItem key={status} value={status}>{t(status)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <Label htmlFor="filterBillMethod">Payment method</Label>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger id="filterBillMethod" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">{t('All')}</SelectItem>
                {methodOptions.filter(m => m.usedFor !== 'Payments').map(m => <SelectItem key={m.id} value={m.name}>{m.name}{m.active ? '' : ' (off)'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[200px]">
            <Label htmlFor="filterBillProcessedBy">Processed by</Label>
            <Select value={filterProcessedBy} onValueChange={setFilterProcessedBy}>
              <SelectTrigger id="filterBillProcessedBy" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Anyone</SelectItem>
                {staffList.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!isFiltering && (
            <MethodTotals label="Received"
              rows={filteredBills.filter(b => b.paymentStatus === 'Paid' || b.paymentStatus === 'Partially Paid')
                .map(b => ({ method: b.paymentMethod, amount: b.paymentStatus === 'Paid' ? b.totalAmount : b.totalAmount / 2 }))} />
          )}
          <p className="w-full text-sm text-muted-foreground" role="status">
            {isFiltering ? t('Loading...') : `${filteredBills.length} bill${filteredBills.length === 1 ? '' : 's'} · ${formatINR(filteredBills.reduce((sum, b) => sum + b.totalAmount, 0))} · ${describeDateFilter(dateFilter, t)}`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Bills')}</CardTitle>
          <CardDescription>{dateFilter.preset === 'all' ? 'All bills' : `Bills dated ${describeDateFilter(dateFilter)}`}{filterStatus !== 'All' ? ` · ${filterStatus}` : ''}, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {emptyMessage ? (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <Table className="[&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-4 sm:[&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Bill date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Paid on</TableHead>
                  <TableHead className="hidden md:table-cell">Method</TableHead>
                  <TableHead className="hidden xl:table-cell">Processed by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map(bill => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.id}</TableCell>
                    <TableCell>{bill.patientName}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {bill.billType === 'Pharmacy' && <Pill className="mr-1 inline-block h-4 w-4 text-green-600" />}
                      {bill.billType === 'Treatment' && <Stethoscope className="mr-1 inline-block h-4 w-4 text-blue-600" />}
                      {bill.billType ? t(bill.billType) : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{date(bill.billDate)}</TableCell>
                    <TableCell>
                      {formatINR(bill.totalAmount)}
                      {/* On phones the status column is hidden, so show it under the amount. */}
                      <span className={cn('block text-xs font-semibold sm:hidden', STATUS_COLORS[bill.paymentStatus])}>{bill.paymentStatus ? t(bill.paymentStatus) : '—'}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={cn('font-semibold', STATUS_COLORS[bill.paymentStatus])}>{bill.paymentStatus ? t(bill.paymentStatus) : '—'}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{bill.paymentStatus === 'Paid' && bill.paymentDate ? date(bill.paymentDate) : '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">{bill.paymentMethod || '—'}</TableCell>
                    <TableCell className="hidden xl:table-cell">{bill.processedByStaffName || '—'}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap text-right sm:space-x-2">
                      <Button variant="outline" size="sm" asChild aria-label={`View or edit ${bill.id}`}>
                        <Link href={`/billing/form?billId=${bill.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild aria-label={`Print ${bill.id}`} title={bill.paymentStatus === 'Paid' ? 'Print receipt' : 'Print bill'}>
                        <Link href={`/billing/print?billId=${bill.id}`}><Printer className="h-4 w-4" /></Link>
                      </Button>
                      {bill.paymentStatus === 'Unpaid' && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => deleteBill(bill)} aria-label={`Delete ${bill.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
