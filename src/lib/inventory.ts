// Inventory helpers shared by the Inventory page and the billing form.
import type { InventoryItem, StockReason } from '@/types/inventory';

export type StockStatus = 'out' | 'low' | 'ok';

export function stockStatus(item: Pick<InventoryItem, 'onHand' | 'reorderLevel'>): StockStatus {
  if (item.onHand <= 0) return 'out';
  if (item.reorderLevel != null && item.onHand <= item.reorderLevel) return 'low';
  return 'ok';
}

export const STATUS_LABELS: Record<StockStatus, string> = { out: 'Out of stock', low: 'Low', ok: 'In stock' };

// Stock is valued at what it cost to buy (never below zero).
export const stockValue = (item: Pick<InventoryItem, 'onHand' | 'unitCost'>) => Math.max(item.onHand, 0) * item.unitCost;

// Order enough to bring stock back to twice the reorder level.
export function suggestedOrder(item: Pick<InventoryItem, 'onHand' | 'reorderLevel'>): number {
  const level = item.reorderLevel ?? 0;
  return Math.max(Math.ceil(level * 2 - item.onHand), level > 0 ? 1 : 0);
}

export const REASON_LABELS: Record<StockReason, string> = {
  purchase: 'Purchased',
  received: 'Received',
  opening: 'Opening stock',
  dispensed: 'Sold (pharmacy bill)',
  used: 'Used',
  expired: 'Expired / damaged',
  adjustment: 'Stock count correction',
};

export const formatQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
export const formatRupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
