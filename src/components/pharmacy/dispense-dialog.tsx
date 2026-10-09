"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { inventory, medications as medicationsRepo, pharmacyOrders } from '@/lib/data';
import { formatINR } from '@/lib/format';
import { formatQty } from '@/lib/inventory';
import type { PharmacyOrder } from '@/types/pharmacyOrder';

interface Line { medicationId: string; medicationName: string; dosage?: string; quantity: string; unitPrice: number; onHand: number | null; unit: string }

// Dispenses a pharmacy order: the pharmacist sets how much of each medicine is given (0 to
// leave one out), sees the stock and prices, and confirms. That makes the pharmacy bill
// (Unpaid), takes the medicines out of stock, and offers to collect the payment.
export function DispenseDialog({ order, patientName, open, onOpenChange, onDone }: {
  order: PharmacyOrder;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLines(null);
    Promise.all([medicationsRepo.list(), inventory.summary().catch(() => [])]).then(([meds, stock]) => {
      setLines(order.items.map(item => {
        const med = meds.find(m => m.id === item.medicationId);
        const onHand = stock.find(s => s.kind === 'pharmacy' && s.id === item.medicationId)?.onHand ?? null;
        return {
          medicationId: item.medicationId, medicationName: item.medicationName, dosage: item.dosage,
          quantity: String(item.quantity ?? 1), unitPrice: med?.listPrice ?? 0, onHand, unit: med?.unitOfMeasure ?? '',
        };
      }));
    }).catch(() => toast({ title: t('Could not load the medicines'), variant: 'destructive' }));
  }, [open, order, t, toast]);

  const qty = (line: Line) => Math.max(Number(line.quantity) || 0, 0);
  const total = (lines ?? []).reduce((sum, line) => sum + qty(line) * line.unitPrice, 0);

  const dispense = async (collectNow: boolean) => {
    if (!lines) return;
    setIsSaving(true);
    try {
      const billId = await pharmacyOrders.dispense(order, patientName, lines.map(line => ({
        medicationId: line.medicationId, medicationName: line.medicationName, dosage: line.dosage, quantity: qty(line), unitPrice: line.unitPrice,
      })));
      toast({ title: t('Dispensed'), description: t('Bill {id} for {amount} is waiting for payment.', { id: billId, amount: formatINR(total) }) });
      onOpenChange(false);
      onDone();
      if (collectNow) router.push(`/billing/form?billId=${billId}`);
    } catch (e) {
      toast({ title: t('Could not dispense'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Dispense medicines')}</DialogTitle>
          <DialogDescription>{patientName}{order.requestedByStaffName ? ` · ${t('asked by {name}', { name: order.requestedByStaffName })}` : ''}</DialogDescription>
        </DialogHeader>
        {!lines ? <p className="text-sm text-muted-foreground">{t('Loading…')}</p> : (
          <div className="space-y-3">
            {lines.map((line, index) => {
              const short = line.onHand != null && qty(line) > line.onHand;
              return (
                <div key={index} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{line.medicationName}</p>
                      {line.dosage && <p className="text-xs text-muted-foreground break-words">{line.dosage}</p>}
                      <p className={`text-xs ${short ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                        {t('In stock')}: {line.onHand != null ? `${formatQty(line.onHand)}${line.unit ? ` ${line.unit}` : ''}` : '—'} · {formatINR(line.unitPrice)} {t('each')}
                      </p>
                    </div>
                    <div className="w-20 shrink-0">
                      <Input type="number" inputMode="decimal" min={0} step="any" aria-label={t('Quantity of {name}', { name: line.medicationName })}
                        value={line.quantity} onChange={e => setLines(prev => prev && prev.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))} />
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">{t('Set a quantity to 0 to leave a medicine out.')}</p>
            <p className="text-right font-semibold">{t('Total')}: {formatINR(total)}</p>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button variant="outline" onClick={() => dispense(false)} disabled={isSaving || !lines || !lines.some(l => qty(l) > 0)}>{t('Dispense & bill')}</Button>
          <Button onClick={() => dispense(true)} disabled={isSaving || !lines || !lines.some(l => qty(l) > 0)}>{t('Dispense & collect payment')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
