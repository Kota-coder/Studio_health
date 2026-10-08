// Inventory helpers shared by the Inventory page and the billing form.
import type { InventoryItem, StockReason } from '@/types/inventory';

export type StockStatus = 'out' | 'low' | 'ok';
type StockLevels = Pick<InventoryItem, 'onHand' | 'reorderLevel' | 'used30Days'>;

// Keep at least two weeks of stock at the rate it was sold or used over the last 30 days
// (the database's home_summary() counts low stock the same way).
export const COVER_DAYS = 14;
const USAGE_DAYS = 30;

export const dailyUse = (item: Pick<InventoryItem, 'used30Days'>) => Math.max(item.used30Days ?? 0, 0) / USAGE_DAYS;

// Two weeks' stock at the recent rate of use, in whole units.
export const twoWeeksNeed = (item: Pick<InventoryItem, 'used30Days'>) => Math.ceil(dailyUse(item) * COVER_DAYS);

// About how many days the stock lasts at the recent rate of use (null when it isn't used).
export const daysLeft = (item: StockLevels) => (dailyUse(item) > 0 ? Math.max(item.onHand, 0) / dailyUse(item) : null);

// The stock level that triggers a refill: the level set on the item or two weeks' use,
// whichever is higher (null when neither applies).
export function refillLevel(item: StockLevels): number | null {
  const need = twoWeeksNeed(item);
  if (item.reorderLevel == null) return need > 0 ? need : null;
  return Math.max(item.reorderLevel, need);
}

export function stockStatus(item: StockLevels): StockStatus {
  if (item.onHand <= 0) return 'out';
  if (item.reorderLevel != null && item.onHand <= item.reorderLevel) return 'low';
  if (item.onHand < twoWeeksNeed(item)) return 'low';
  return 'ok';
}

export const STATUS_LABELS: Record<StockStatus, string> = { out: 'Out of stock', low: 'Low', ok: 'In stock' };

// Stock is valued at what it cost to buy (never below zero).
export const stockValue = (item: Pick<InventoryItem, 'onHand' | 'unitCost'>) => Math.max(item.onHand, 0) * item.unitCost;

// Order enough for four weeks of recent use (so two weeks are still left two weeks from now),
// or twice the refill level set on the item, whichever is more.
export function suggestedOrder(item: StockLevels): number {
  const target = Math.max((item.reorderLevel ?? 0) * 2, Math.ceil(dailyUse(item) * COVER_DAYS * 2));
  return Math.max(Math.ceil(target - item.onHand), target > 0 ? 1 : 0);
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
