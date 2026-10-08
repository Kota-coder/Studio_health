"use client";

import Link from 'next/link';
import { CreditCard, Eye, PlusCircle, Printer } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import { AttachmentList } from '@/components/patient/attachment-picker';
import { formatINR, patientDisplayId } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Bill } from '@/types/billing';

const STATUS_COLOR: Record<string, string> = {
  Unpaid: 'text-red-600',
  'Partially Paid': 'text-yellow-600',
  Paid: 'text-emerald-600',
  Cancelled: 'text-gray-500',
};

function summary(bills: Bill[]) {
  const unpaid = bills.filter(b => b.paymentStatus === 'Unpaid');
  const partial = bills.filter(b => b.paymentStatus === 'Partially Paid');
  if (unpaid.length > 0) return `${unpaid.length} Unpaid Bill(s) (Total: ${formatINR(unpaid.reduce((sum, b) => sum + b.totalAmount, 0))}). View all ${bills.length}.`;
  if (partial.length > 0) return `${partial.length} Partially Paid. View all ${bills.length}.`;
  return `All ${bills.length} bill(s) accounted for. View details.`;
}

// The patient's bills, with links to create, edit and print them.
export function PatientBillsCard({ patientId, bills }: { patientId: number; bills: Bill[] }) {
  const t = useT();
  const { date } = useFormat();

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center"><CreditCard className="mr-2 h-5 w-5 text-primary" />{t('Patient Bills')}</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/billing/form?patientId=${patientDisplayId(patientId)}`}><PlusCircle className="mr-2 h-4 w-4" /> {t('Create New Bill')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No bills found for this patient.</p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="bills">
              <AccordionTrigger className="py-2 text-left text-sm hover:no-underline">{summary(bills)}</AccordionTrigger>
              <AccordionContent className="pt-2">
                <ul className="divide-y">
                  {bills.map(bill => (
                    <li key={bill.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{bill.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {date(bill.billDate)}
                          {bill.paymentStatus === 'Paid' && bill.paymentDate && <> · paid {date(bill.paymentDate)}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="tabular-nums">{formatINR(bill.totalAmount)}</p>
                          <p className={cn('text-xs font-semibold', STATUS_COLOR[bill.paymentStatus ?? ''])}>{bill.paymentStatus ? t(bill.paymentStatus) : 'N/A'}</p>
                        </div>
                        <Button variant="ghost" size="icon" asChild aria-label={`View or edit ${bill.id}`}>
                          <Link href={`/billing/form?billId=${bill.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild aria-label={`Print ${bill.id}`}>
                          <Link href={`/billing/print?billId=${bill.id}`}><Printer className="h-4 w-4" /></Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                {bills.map(bill => (
                  <AttachmentList key={bill.id} paths={bill.attachments} label={`Bill ${bill.id} attachments`} size="h-16 w-16" />
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
