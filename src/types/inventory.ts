// Pharmacy and material stock (stock_movements table and inventory_summary()).

export type InventoryKind = 'pharmacy' | 'material';

// How stock changed. purchase and dispensed come from payments and pharmacy bills; the
// others are entered on the Inventory page.
export type StockReason = 'purchase' | 'received' | 'opening' | 'dispensed' | 'used' | 'expired' | 'adjustment';

export interface InventoryItem {
  kind: InventoryKind;
  id: string;
  name: string;
  unit: string;
  category: string;
  reorderLevel: number | null;
  onHand: number;
  unitCost: number; // average purchase price per unit (list price if never bought at a recorded price)
  costFromList: boolean;
  qtyIn: number; // in the chosen period
  qtyOut: number; // in the chosen period (dispensed, used, expired, counted short)
  qtyExpired: number;
  used30Days: number; // sold or used in the last 30 days, whatever the period
  lastMoved: string | null; // yyyy-MM-dd
}

export interface StockMovement {
  id: number;
  medicationId: string | null;
  materialId: string | null;
  quantity: number; // out is negative
  unitCost: number | null;
  reason: StockReason;
  sourceType: 'bill' | 'payment' | null;
  sourceId: string | null;
  movedOn: string; // yyyy-MM-dd
  note: string | null;
  recordedByStaffName: string | null;
  createdAt: string;
}

export type NewStockMovement = {
  kind: InventoryKind;
  itemId: string;
  quantity: number;
  reason: Exclude<StockReason, 'purchase' | 'dispensed'>;
  unitCost?: number | null;
  movedOn?: string;
  note?: string;
};
