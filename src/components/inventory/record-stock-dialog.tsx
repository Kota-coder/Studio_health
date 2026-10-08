"use client";

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { inventory, materials, medications } from '@/lib/data';
import { formatQty } from '@/lib/inventory';
import type { InventoryItem } from '@/types/inventory';

type EntryType = 'received' | 'opening' | 'used' | 'expired' | 'count';

const ENTRY_TYPES: Array<{ value: EntryType; label: string; hint: string }> = [
  { value: 'used', label: 'Used', hint: 'Taken from stock for wards or procedures (not sold on a bill).' },
  { value: 'expired', label: 'Expired / damaged', hint: 'Thrown away; written off at its cost.' },
  { value: 'count', label: 'Stock count', hint: 'Enter how many you counted; the difference is recorded.' },
  { value: 'received', label: 'Received', hint: 'Came in without a purchase payment (e.g. free samples, returns). Purchases recorded under Payments are added automatically.' },
  { value: 'opening', label: 'Opening stock', hint: 'What was on the shelf when you started using inventory.' },
];

// Records a stock entry for one item, and sets the level at which it needs refilling.
export function RecordStockDialog({ item, open, onOpenChange, onSaved }: {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [entryType, setEntryType] = useState<EntryType>('used');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [movedOn, setMovedOn] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setEntryType(item.onHand <= 0 && item.qtyIn === 0 && !item.lastMoved ? 'opening' : 'used');
    setQuantity('');
    setUnitCost(item.unitCost ? String(item.unitCost) : '');
    setMovedOn(format(new Date(), 'yyyy-MM-dd'));
    setNote('');
    setReorderLevel(item.reorderLevel != null ? String(item.reorderLevel) : '');
  }, [open, item]);

  if (!item) return null;
  const stockIn = entryType === 'received' || entryType === 'opening';
  const hint = ENTRY_TYPES.find(e => e.value === entryType)?.hint;
  const unit = item.unit ? ` ${item.unit}` : '';

  const save = async () => {
    const qty = Number(quantity);
    const level = reorderLevel.trim() === '' ? null : Number(reorderLevel);
    if (level !== null && (!Number.isFinite(level) || level < 0)) {
      toast({ title: 'Check the refill level', description: 'Enter 0 or more, or leave it empty.', variant: 'destructive' });
      return;
    }
    const hasEntry = quantity.trim() !== '';
    if (hasEntry && (!Number.isFinite(qty) || qty < 0 || (entryType !== 'count' && qty === 0))) {
      toast({ title: 'Check the quantity', description: 'Enter a quantity above 0.', variant: 'destructive' });
      return;
    }
    const cost = unitCost.trim() === '' ? null : Number(unitCost);
    if (stockIn && hasEntry && cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      toast({ title: 'Check the cost', description: 'Enter the cost per unit, or leave it empty.', variant: 'destructive' });
      return;
    }
    const change = !hasEntry ? 0 : entryType === 'count' ? qty - item.onHand : stockIn ? qty : -qty;
    const levelChanged = level !== item.reorderLevel;
    if (change === 0 && !levelChanged) {
      if (hasEntry && entryType === 'count') toast({ title: 'Stock matches', description: `The count agrees with the ${formatQty(item.onHand)}${unit} on record.` });
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    try {
      if (change !== 0) {
        await inventory.record([{
          kind: item.kind, itemId: item.id, quantity: change,
          reason: entryType === 'count' ? 'adjustment' : entryType,
          unitCost: stockIn ? cost : null, movedOn,
          note: entryType === 'count' ? `Counted ${formatQty(qty)}${unit} (record showed ${formatQty(item.onHand)})${note.trim() ? ` · ${note.trim()}` : ''}` : note,
        }]);
      }
      if (levelChanged) {
        if (item.kind === 'pharmacy') await medications.update(item.id, { reorderLevel: level });
        else await materials.update(item.id, { reorderLevel: level });
      }
      toast({ title: 'Saved', description: change !== 0 ? `${item.name}: ${change > 0 ? '+' : ''}${formatQty(change)}${unit}.` : `${item.name}: refill level updated.` });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({ title: 'Could not save', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>On hand: {formatQty(item.onHand)}{unit}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="stockEntryType">Record</Label>
            <Select value={entryType} onValueChange={v => setEntryType(v as EntryType)}>
              <SelectTrigger id="stockEntryType"><SelectValue /></SelectTrigger>
              <SelectContent>{ENTRY_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="stockQuantity">{entryType === 'count' ? 'Counted' : 'Quantity'}{unit && ` (${item.unit})`}</Label>
              <Input id="stockQuantity" type="number" inputMode="decimal" min={0} step="any" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="stockDate">Date</Label>
              <Input id="stockDate" type="date" value={movedOn} max={format(new Date(), 'yyyy-MM-dd')} onChange={e => setMovedOn(e.target.value)} />
            </div>
          </div>
          {stockIn && (
            <div>
              <Label htmlFor="stockCost">Cost per unit (₹)</Label>
              <Input id="stockCost" type="number" inputMode="decimal" min={0} step="any" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="Optional" />
              <p className="mt-1 text-xs text-muted-foreground">Used to value the stock. Leave empty for free items.</p>
            </div>
          )}
          <div>
            <Label htmlFor="stockNote">Note</Label>
            <Textarea id="stockNote" rows={2} maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional, e.g. ward, batch or reason" />
          </div>
          <div className="rounded-md border p-3">
            <Label htmlFor="stockReorder">Refill when stock falls to{unit && ` (${item.unit})`}</Label>
            <Input id="stockReorder" type="number" inputMode="decimal" min={0} step="any" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} placeholder="No warning" className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">The item is listed under &quot;Needs refill&quot; at or below this level.</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={save} disabled={isSaving}>{isSaving ? t('Saving…') : t('Save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
