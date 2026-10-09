"use client";

import { useState } from 'react';
import { Pill } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import { formatQty } from '@/lib/inventory';
import { cn } from '@/lib/utils';
import type { Patient } from '@/types/patient';
import type { PharmacyOrder } from '@/types/pharmacyOrder';

interface MedicineRow {
  key: string;
  name: string;
  dosage?: string;
  notes?: string;
  by?: string;
  at: string;
  status?: { label: string; tone: 'waiting' | 'done' | 'none' };
}

const SHOWN = 6;

// Every medicine prescribed for the patient (from care notes, and orders sent to the pharmacy),
// newest first, with the dosage, who prescribed it and, with Pharmacy Orders on, whether the
// pharmacy has given it.
export function MedicinesCard({ patient, orders, pharmacyOn }: { patient: Patient; orders: PharmacyOrder[]; pharmacyOn: boolean }) {
  const t = useT();
  const { date } = useFormat();
  const [showAll, setShowAll] = useState(false);

  const statusOf = (order?: PharmacyOrder, medicationId?: string): MedicineRow['status'] => {
    if (!pharmacyOn) return undefined;
    if (!order) return { label: t('Not sent to the pharmacy'), tone: 'none' };
    if (order.status === 'Requested') return { label: t('Waiting at the pharmacy'), tone: 'waiting' };
    const given = order.items.find(i => i.medicationId === medicationId)?.quantity;
    if (given === 0) return { label: t('Not given'), tone: 'none' };
    return { label: given ? t('Given × {n}', { n: formatQty(given) }) : t('Dispensed'), tone: 'done' };
  };

  const live = orders.filter(o => o.status !== 'Cancelled');
  const rows: MedicineRow[] = [];
  for (const note of patient.careNotes ?? []) {
    const order = live.find(o => o.careNoteId === note.id);
    (note.medicationsMentioned ?? []).forEach((med, i) => rows.push({
      key: `${note.id}-${i}`, name: med.medicationName, dosage: med.dosage, notes: med.notes,
      by: note.staffName, at: note.createdAt, status: statusOf(order, med.medicationId),
    }));
  }
  // Orders sent without a care note.
  for (const order of live.filter(o => !o.careNoteId)) {
    order.items.forEach((item, i) => rows.push({
      key: `${order.id}-${i}`, name: item.medicationName, dosage: item.dosage, notes: i === 0 ? order.notes : undefined,
      by: order.requestedByStaffName, at: order.createdAt, status: statusOf(order, item.medicationId),
    }));
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));
  const shown = showAll ? rows : rows.slice(0, SHOWN);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center"><Pill className="mr-2 h-5 w-5 text-primary" />{t('Medicines')}</CardTitle>
        <CardDescription>{t('Prescribed by the doctors, newest first.')}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t('No medicines prescribed yet. Add them to a care note.')}</p>
        ) : (
          <>
            <ul className="divide-y rounded-md border text-sm">
              {shown.map(row => (
                <li key={row.key} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{row.name}</p>
                    {row.dosage && <p className="break-words">{row.dosage}</p>}
                    {row.notes && <p className="text-xs text-muted-foreground break-words">{row.notes}</p>}
                    <p className="text-xs text-muted-foreground">{row.by ? `${row.by} · ` : ''}{date(row.at, 'dd MMM yyyy')}</p>
                  </div>
                  {row.status && (
                    <Badge variant="outline" className={cn('shrink-0 self-start',
                      row.status.tone === 'waiting' && 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                      row.status.tone === 'done' && 'border-green-300 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300')}>
                      {row.status.label}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            {rows.length > SHOWN && (
              <Button variant="link" className="mt-1 h-auto px-0" onClick={() => setShowAll(v => !v)}>
                {showAll ? t('Show fewer') : t('Show all ({n})', { n: rows.length })}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
