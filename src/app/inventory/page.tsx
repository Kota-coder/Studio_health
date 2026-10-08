"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Boxes, Download, History, PackagePlus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_DATE_FILTER, DateRangeFilter, dateFilterRange, describeDateFilter, type DateFilterValue } from '@/components/date-range-filter';
import { RefreshStamp } from '@/components/refresh-stamp';
import { RecordStockDialog } from '@/components/inventory/record-stock-dialog';
import { StockHistoryDialog } from '@/components/inventory/stock-history-dialog';
import { useAuth } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { PAGE_ROLES } from '@/config/permissions';
import { inventory } from '@/lib/data';
import { cachedAt, invalidate } from '@/lib/data/cache';
import { STATUS_LABELS, formatQty, formatRupees, stockStatus, stockValue, suggestedOrder, type StockStatus } from '@/lib/inventory';
import { cn } from '@/lib/utils';
import type { InventoryItem, InventoryKind } from '@/types/inventory';
import type { StaffRole } from '@/types/staff';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.inventory;
const DELETE_ROLES: StaffRole[] = ['Super Admin', 'Admin'];
const STATUS_STYLES: Record<StockStatus, string> = {
  out: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
  low: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
  ok: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900',
};

// Pharmacy and material stock: what is on hand and what it is worth, what came in and went
// out in a period, and what needs refilling.
export default function InventoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const { isOn } = useFeatures();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const [kind, setKind] = useState<'all' | InventoryKind>('all');
  const [search, setSearch] = useState('');
  const [refillOnly, setRefillOnly] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recordItem, setRecordItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  const allowed = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);
  const showPharmacy = isOn('medications');
  const showMaterials = isOn('materials');

  useEffect(() => {
    if (!authIsLoading && !currentUser) router.replace('/login');
    else if (!authIsLoading && currentUser && !allowed) router.replace('/dashboard');
  }, [authIsLoading, currentUser, allowed, router]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) invalidate('summary:inventory:');
    try {
      const range = dateFilterRange(dateFilter);
      setItems(await inventory.summary(range));
      setLoadedAt(cachedAt(`summary:inventory:${range.from ?? ''}:${range.to ?? ''}`));
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not load the inventory.', variant: 'destructive' });
      setItems(prev => prev ?? []);
    }
  }, [dateFilter, toast]);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const visible = useMemo(() => (items ?? []).filter(i => (i.kind === 'pharmacy' ? showPharmacy : showMaterials)), [items, showPharmacy, showMaterials]);
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visible.filter(i => (kind === 'all' || i.kind === kind)
      && (!refillOnly || stockStatus(i) !== 'ok')
      && (!term || i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term)));
  }, [visible, kind, search, refillOnly]);

  const totals = useMemo(() => {
    const sum = (list: InventoryItem[], f: (i: InventoryItem) => number) => list.reduce((s, i) => s + f(i), 0);
    const pharmacy = visible.filter(i => i.kind === 'pharmacy');
    const material = visible.filter(i => i.kind === 'material');
    return {
      value: sum(visible, stockValue),
      pharmacyValue: sum(pharmacy, stockValue),
      materialValue: sum(material, stockValue),
      inValue: sum(visible, i => i.qtyIn * i.unitCost),
      outValue: sum(visible, i => i.qtyOut * i.unitCost),
      expiredValue: sum(visible, i => i.qtyExpired * i.unitCost),
      out: visible.filter(i => stockStatus(i) === 'out').length,
      low: visible.filter(i => stockStatus(i) === 'low').length,
      negative: visible.filter(i => i.onHand < 0).length,
    };
  }, [visible]);
  const refill = useMemo(() => visible.filter(i => stockStatus(i) !== 'ok' && (i.reorderLevel != null || i.qtyOut > 0 || i.lastMoved)), [visible]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    load(true).finally(() => setIsRefreshing(false));
  };

  const downloadCsv = () => {
    const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Type', 'Item', 'Category', 'Unit', 'On hand', 'Refill at', 'Status', 'Cost per unit', 'Value', `In (${describeDateFilter(dateFilter)})`, `Out (${describeDateFilter(dateFilter)})`]];
    for (const i of shown) {
      rows.push([i.kind === 'pharmacy' ? 'Pharmacy' : 'Material', i.name, i.category, i.unit, formatQty(i.onHand), i.reorderLevel != null ? formatQty(i.reorderLevel) : '',
        STATUS_LABELS[stockStatus(i)], i.unitCost.toFixed(2), stockValue(i).toFixed(2), formatQty(i.qtyIn), formatQty(i.qtyOut)].map(String));
    }
    const blob = new Blob([rows.map(r => r.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (authIsLoading || (allowed && items === null)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading inventory...</p></div>;
  }
  if (!allowed) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  const canDelete = DELETE_ROLES.includes(currentUser.role);
  const purchaseLink = isOn('payments') && (PAGE_ROLES.payments as StaffRole[]).includes(currentUser.role);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Boxes className="h-8 w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Inventory</h1>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <RefreshStamp loadedAt={loadedAt} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
          <Button variant="outline" onClick={downloadCsv}><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
          <Button variant="outline" onClick={() => router.push('/dashboard')}><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Button>
        </div>
      </header>
      <p className="text-sm text-muted-foreground max-w-4xl">
        Stock goes up when a Pharmacy or Material purchase is recorded under Payments, and down when a pharmacy bill is
        made. Record anything else here: items used on wards, expired stock, opening stock and stock counts. Stock is valued
        at its average purchase cost.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Stock value</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatRupees(totals.value)}</p>
            <p className="text-xs text-muted-foreground">
              {[showPharmacy && `Pharmacy ${formatRupees(totals.pharmacyValue)}`, showMaterials && `Materials ${formatRupees(totals.materialValue)}`].filter(Boolean).join(' · ')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Needs refill</CardTitle></CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold tabular-nums', totals.out + totals.low > 0 && 'text-amber-700 dark:text-amber-400')}>{totals.out + totals.low} items</p>
            <p className="text-xs text-muted-foreground">{totals.out} out of stock · {totals.low} low</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Came in</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatRupees(totals.inValue)}</p>
            <p className="text-xs text-muted-foreground">{describeDateFilter(dateFilter)}, at cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Went out</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatRupees(totals.outValue)}</p>
            <p className="text-xs text-muted-foreground">
              {describeDateFilter(dateFilter)}, at cost{totals.expiredValue > 0 ? ` · ${formatRupees(totals.expiredValue)} expired/damaged` : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {totals.negative > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {totals.negative} item{totals.negative === 1 ? ' shows' : 's show'} less than zero: more was sold or used than was recorded coming in.
          Record the opening stock or a stock count for {totals.negative === 1 ? 'it' : 'them'}.
        </p>
      )}

      {refill.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /> Needs refill</CardTitle>
            <CardDescription>
              At or below the refill level, or out of stock. The suggested order brings stock back to twice the refill level.
              {purchaseLink && <> Record the purchase under <Link href="/payments/form" className="text-primary underline">Payments → Record New Payment</Link> (type Pharmacy or Material) and stock goes up automatically.</>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="[&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Refill at</TableHead>
                  <TableHead className="text-right">Order</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Approx. cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refill.map(i => {
                  const order = suggestedOrder(i);
                  return (
                    <TableRow key={`${i.kind}-${i.id}`}>
                      <TableCell>
                        <span className="font-medium">{i.name}</span>
                        <span className="block text-xs text-muted-foreground">{i.kind === 'pharmacy' ? 'Pharmacy' : 'Material'}{i.unit ? ` · ${i.unit}` : ''}</span>
                      </TableCell>
                      <TableCell className={cn('text-right tabular-nums', i.onHand <= 0 && 'text-destructive font-semibold')}>{formatQty(i.onHand)}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{i.reorderLevel != null ? formatQty(i.reorderLevel) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{order > 0 ? formatQty(order) : <button type="button" className="text-xs text-primary underline" onClick={() => setRecordItem(i)}>Set level</button>}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{order > 0 ? formatRupees(order * i.unitCost) : '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-lg">Stock</CardTitle>
            <CardDescription>On hand now; &quot;In&quot; and &quot;Out&quot; for {describeDateFilter(dateFilter)}.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            {showPharmacy && showMaterials && (
              <Tabs value={kind} onValueChange={v => setKind(v as typeof kind)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="pharmacy">Pharmacy</TabsTrigger>
                  <TabsTrigger value="material">Materials</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <div className="relative lg:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input aria-label="Search items" placeholder="Search items" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <DateRangeFilter value={dateFilter} onChange={setDateFilter} idPrefix="inventoryDate" className="w-full sm:w-auto [&_button]:mt-1" />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={refillOnly} onCheckedChange={setRefillOnly} aria-label="Only items that need refilling" /> Needs refill only
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {visible.length === 0
                ? <>No items yet. Add them under {[showPharmacy && <Link key="p" href="/pharmacy" className="text-primary underline">Pharmacy</Link>, showMaterials && <Link key="m" href="/materials" className="text-primary underline">Materials</Link>].filter(Boolean).reduce<React.ReactNode[]>((acc, el, idx) => (idx ? [...acc, ' and ', el] : [el]), [])}.</>
                : 'No items match.'}
            </p>
          ) : (
            <Table className="[&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Cost / unit</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Value</TableHead>
                  <TableHead className="text-right hidden md:table-cell">In</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Out</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map(i => {
                  const status = stockStatus(i);
                  return (
                    <TableRow key={`${i.kind}-${i.id}`}>
                      <TableCell>
                        <span className="font-medium">{i.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {i.kind === 'pharmacy' ? 'Pharmacy' : 'Material'}{i.category ? ` · ${i.category}` : ''}{i.unit ? ` · ${i.unit}` : ''}
                        </span>
                        <Badge variant="outline" className={cn('mt-1 md:hidden', STATUS_STYLES[status])}>{STATUS_LABELS[status]}</Badge>
                      </TableCell>
                      <TableCell className={cn('text-right tabular-nums', i.onHand < 0 && 'text-destructive font-semibold')}>
                        {formatQty(i.onHand)}
                        {i.reorderLevel != null && <span className="block text-xs text-muted-foreground">refill at {formatQty(i.reorderLevel)}</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell"><Badge variant="outline" className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums hidden lg:table-cell" title={i.costFromList ? 'No recorded purchase price yet; using the list price' : 'Average purchase price'}>
                        {formatRupees(i.unitCost)}{i.costFromList && <span className="text-muted-foreground">*</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{formatRupees(stockValue(i))}</TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell">{i.qtyIn ? `+${formatQty(i.qtyIn)}` : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell">{i.qtyOut ? `−${formatQty(i.qtyOut)}` : '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setRecordItem(i)} aria-label={`Record stock for ${i.name}`}>
                            <PackagePlus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Record</span>
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setHistoryItem(i)} aria-label={`History of ${i.name}`} title="History">
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {shown.some(i => i.costFromList) && (
            <p className="mt-3 text-xs text-muted-foreground">* No purchase price recorded yet, so valued at the list price.</p>
          )}
        </CardContent>
      </Card>

      <RecordStockDialog item={recordItem} open={!!recordItem} onOpenChange={o => { if (!o) setRecordItem(null); }} onSaved={() => load()} />
      <StockHistoryDialog item={historyItem} open={!!historyItem} onOpenChange={o => { if (!o) setHistoryItem(null); }} canDelete={canDelete} onChanged={() => load()} />
    </div>
  );
}
