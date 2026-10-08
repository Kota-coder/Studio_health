"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFormat } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { inventory } from '@/lib/data';
import { formatINR } from '@/lib/format';
import { REASON_LABELS, formatQty } from '@/lib/inventory';
import type { InventoryItem, StockMovement } from '@/types/inventory';

// The latest stock changes for one item. Mistaken manual entries can be deleted by Super
// Admin and Admin; entries from bills and payments change only with those records.
export function StockHistoryDialog({ item, open, onOpenChange, canDelete, onChanged }: {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { date } = useFormat();
  const [movements, setMovements] = useState<StockMovement[] | null>(null);

  const load = useCallback(async () => {
    if (!item) return;
    setMovements(null);
    try {
      setMovements(await inventory.history(item.kind, item.id));
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not load the history.', variant: 'destructive' });
      setMovements([]);
    }
  }, [item, toast]);

  useEffect(() => { if (open) load(); }, [open, load]);

  if (!item) return null;

  const remove = async (movement: StockMovement) => {
    if (!confirm(`Delete this entry (${REASON_LABELS[movement.reason]}, ${formatQty(movement.quantity)})?`)) return;
    try {
      await inventory.remove(movement.id);
      await load();
      onChanged();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not delete.', variant: 'destructive' });
    }
  };

  const sourceLink = (m: StockMovement) =>
    m.sourceType === 'bill' ? `/billing/form?billId=${m.sourceId}` : m.sourceType === 'payment' ? `/payments/form?paymentId=${m.sourceId}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>Latest stock changes, newest first. On hand: {formatQty(item.onHand)}{item.unit ? ` ${item.unit}` : ''}.</DialogDescription>
        </DialogHeader>
        {movements === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stock entries yet.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {movements.map(m => {
              const link = sourceLink(m);
              return (
                <li key={m.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{REASON_LABELS[m.reason]}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {date(m.movedOn, 'd MMM yyyy')}
                      {m.note ? <> · {link ? <Link href={link} className="text-primary underline">{m.note}</Link> : m.note}</> : null}
                      {m.recordedByStaffName ? ` · ${m.recordedByStaffName}` : ''}
                      {m.unitCost != null && m.quantity > 0 ? ` · ${formatINR(m.unitCost)} each` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={`tabular-nums font-semibold ${m.quantity < 0 ? 'text-destructive' : 'text-green-700 dark:text-green-400'}`}>
                      {m.quantity > 0 ? '+' : ''}{formatQty(m.quantity)}
                    </span>
                    {canDelete && !m.sourceType && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Delete entry" onClick={() => remove(m)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
