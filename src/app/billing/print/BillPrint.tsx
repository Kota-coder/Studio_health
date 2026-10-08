"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, isValid, parse, parseISO } from 'date-fns';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HospitalLetterhead } from '@/components/hospital-letterhead';
import { useAuth } from '@/context/AuthContext';
import { PAGE_ROLES } from '@/config/permissions';
import { bills as billsRepo } from '@/lib/data';
import { rupeesInWords } from '@/lib/amount-in-words';
import { cn } from '@/lib/utils';
import type { Bill } from '@/types/billing';
import type { StaffRole } from '@/types/staff';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.billing;

function showDate(value?: string | null): string {
  if (!value) return '—';
  const dmy = parse(value, 'dd/MM/yyyy', new Date());
  if (isValid(dmy)) return format(dmy, 'dd MMM yyyy');
  const iso = parseISO(value);
  return isValid(iso) ? format(iso, 'dd MMM yyyy') : value;
}
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// A bill on the hospital's letterhead, to print or save as PDF for the patient. Once the bill
// is paid it is a receipt (payment date, method and who received it).
export default function BillPrint() {
  const router = useRouter();
  const billId = useSearchParams().get('billId');
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const [bill, setBill] = useState<Bill | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const allowed = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);

  useEffect(() => {
    if (!authIsLoading && !currentUser) router.replace('/login');
    else if (!authIsLoading && currentUser && !allowed) router.replace('/dashboard');
  }, [authIsLoading, currentUser, allowed, router]);

  useEffect(() => {
    if (!allowed || !billId) { if (!billId) setState('missing'); return; }
    billsRepo.get(billId)
      .then(found => { setBill(found); setState(found ? 'ready' : 'missing'); })
      .catch(() => setState('missing'));
  }, [allowed, billId]);

  if (authIsLoading || (allowed && state === 'loading')) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading bill...</p></div>;
  }
  if (!allowed) return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  if (!bill) {
    return (
      <div className="container mx-auto max-w-lg p-6 text-center space-y-4">
        <p>Bill not found.</p>
        <Button variant="outline" asChild><Link href="/billing"><ArrowLeft className="mr-2 h-4 w-4" /> Billing</Link></Button>
      </div>
    );
  }

  const paid = bill.paymentStatus === 'Paid';
  const cancelled = bill.paymentStatus === 'Cancelled';
  const title = paid ? 'Payment Receipt' : cancelled ? 'Bill (Cancelled)' : 'Bill';
  const patientId = String(bill.patientId).padStart(3, '0');
  const Detail = ({ label, value }: { label: string; value?: string | null }) => (
    <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value || '—'}</dd></div>
  );

  return (
    <div className="container mx-auto max-w-3xl p-4 sm:p-6 lg:p-8 space-y-6 print:max-w-none print:p-0 print:space-y-4">
      <div className="flex flex-wrap justify-between gap-2 print:hidden">
        <Button variant="outline" onClick={() => (window.history.length > 1 ? router.back() : router.push('/billing'))}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href={`/billing/form?billId=${bill.id}`}><Pencil className="mr-2 h-4 w-4" /> Edit Bill</Link></Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / Save as PDF</Button>
        </div>
      </div>
      {!paid && !cancelled && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 print:hidden">
          This bill is {bill.paymentStatus === 'Partially Paid' ? 'partly paid' : 'not paid yet'}. It prints as a bill; once it is marked Paid it prints as a receipt.
        </p>
      )}

      <article className="space-y-5 rounded-lg border bg-card p-4 sm:p-6 print:border-0 print:p-0">
        <HospitalLetterhead />

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{bill.billType ? `${bill.billType} bill` : 'Bill'} {bill.id}</p>
          </div>
          <span className={cn('rounded-md border-2 px-3 py-1 text-sm font-bold uppercase tracking-wide',
            paid ? 'border-green-600 text-green-700 dark:text-green-400' : cancelled ? 'border-muted-foreground text-muted-foreground' : 'border-amber-600 text-amber-700 dark:text-amber-400')}>
            {bill.paymentStatus || 'Unpaid'}
          </span>
        </header>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Detail label="Patient" value={bill.patientName} />
          <Detail label="Patient ID" value={patientId} />
          <Detail label="Bill date" value={showDate(bill.billDate)} />
          {paid && <Detail label="Paid on" value={showDate(bill.paymentDate)} />}
          {(paid || bill.paymentStatus === 'Partially Paid') && <Detail label="Payment method" value={bill.paymentMethod} />}
          <Detail label={paid ? 'Received by' : 'Prepared by'} value={bill.processedByStaffName} />
        </dl>

        <Table className="[&_td]:px-2 [&_th]:px-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bill.items.map((item, index) => (
              <TableRow key={item.id || index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell className="break-words">{item.description}</TableCell>
                <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(Number(item.unitPrice))}</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(Number(item.total))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right font-semibold">Total</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{rupees(bill.totalAmount)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        <p className="text-sm"><span className="text-muted-foreground">{paid ? 'Amount received:' : 'Amount:'}</span> <span className="font-medium">{rupeesInWords(bill.totalAmount)}</span></p>
        {bill.notes && <p className="text-sm"><span className="text-muted-foreground">Notes:</span> {bill.notes}</p>}

        <footer className="flex flex-wrap items-end justify-between gap-6 border-t pt-4 text-xs text-muted-foreground">
          <p>{paid ? 'Thank you. ' : ''}This is a computer-generated {paid ? 'receipt' : 'bill'}. Printed {format(new Date(), 'dd MMM yyyy, h:mm a')}.</p>
          <div className="text-center">
            <div className="h-10 w-40 border-b" />
            <p className="mt-1">Authorised signature</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
