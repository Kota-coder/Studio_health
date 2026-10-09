"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ClipboardList, IndianRupee, PackageCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { RefreshStamp } from '@/components/refresh-stamp';
import { DispenseDialog } from '@/components/pharmacy/dispense-dialog';
import { useFormat, useT } from '@/components/language-provider';
import { canOpen } from '@/config/permissions';
import { useStaff } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { useWorkflow } from '@/hooks/use-workflow';
import { pharmacyOrders } from '@/lib/data';
import { cachedAt, invalidate } from '@/lib/data/cache';
import { formatINR, patientDisplayId } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PharmacyOrder } from '@/types/pharmacyOrder';

type View = 'waiting' | 'done';

// The pharmacy's work list: medicines sent from patient pages, waiting to be dispensed, and
// those dispensed in the last day with their bills. Dispensing makes the pharmacy bill.
// Access and the feature switch are checked by PageGuard (src/config/navigation.ts).
export default function PharmacyOrdersPage() {
  const t = useT();
  const { date } = useFormat();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const currentUser = useStaff();
  const { canProcessPharmacy, canRequest } = useWorkflow();
  const canBill = isOn('billing') && canOpen('billing', currentUser.role);

  const [waiting, setWaiting] = useState<PharmacyOrder[] | null>(null);
  const [done, setDone] = useState<PharmacyOrder[] | null>(null);
  const [view, setView] = useState<View>('waiting');
  const [search, setSearch] = useState('');
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dispensing, setDispensing] = useState<PharmacyOrder | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) { invalidate('pharmacy:'); setDone(null); }
    try {
      setWaiting(await pharmacyOrders.listOpen());
      setLoadedAt(cachedAt('pharmacy:open') ?? new Date());
    } catch {
      toast({ title: t('Could not load the pharmacy orders'), variant: 'destructive' });
      setWaiting(prev => prev ?? []);
    }
  }, [t, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 60_000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (view === 'done' && done === null) pharmacyOrders.listRecentlyDispensed().then(setDone).catch(() => setDone([]));
  }, [view, done]);

  const refresh = () => {
    setIsRefreshing(true);
    load(true).finally(() => setIsRefreshing(false));
  };

  const cancel = async (order: PharmacyOrder) => {
    if (!confirm(t('Cancel this pharmacy order?'))) return;
    try {
      await pharmacyOrders.cancel(order);
    } catch (e) {
      toast({ title: t('Could not cancel the order'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    }
    load(true);
  };

  if (!waiting) return <PageLoading />;

  const term = search.trim().toLowerCase();
  const list = (view === 'waiting' ? waiting : done ?? [])
    .filter(o => !term || (o.patientName ?? '').toLowerCase().includes(term) || patientDisplayId(o.patientId).includes(term));

  return (
    <PageBody>
      <PageHeader icon={ClipboardList} title={t('Pharmacy Orders')}
        description={t('Medicines sent to the pharmacy from patient pages. Dispensing makes the pharmacy bill and takes the medicines out of stock.')} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist">
          <Button role="tab" aria-selected={view === 'waiting'} size="sm" variant={view === 'waiting' ? 'default' : 'outline'} onClick={() => setView('waiting')}>
            {t('Waiting')} ({waiting.length})
          </Button>
          <Button role="tab" aria-selected={view === 'done'} size="sm" variant={view === 'done' ? 'default' : 'outline'} onClick={() => setView('done')}>
            {t('Dispensed today')}
          </Button>
        </div>
        <RefreshStamp loadedAt={loadedAt} onRefresh={refresh} isRefreshing={isRefreshing} className="justify-end" />
      </div>

      <Input placeholder={t('Search by patient name or number…')} value={search} onChange={e => setSearch(e.target.value)} aria-label={t('Search')} />

      <Card>
        <CardContent className="p-0">
          {view === 'done' && done === null ? (
            <p className="p-6 text-sm text-muted-foreground">{t('Loading…')}</p>
          ) : list.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{term ? t('No orders match your search.') : view === 'waiting' ? t('No medicines waiting.') : t('Nothing dispensed today.')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {list.map(order => (
                <li key={order.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <Link href={`/patients/${patientDisplayId(order.patientId)}`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                      {order.patientName ?? t('Patient')} · {patientDisplayId(order.patientId)}
                    </Link>
                    <ul className="space-y-0.5">
                      {order.items.map((item, i) => (
                        <li key={i} className="break-words">
                          <span className="font-medium">{item.medicationName}</span>
                          {item.quantity != null && view === 'done' && <span> × {item.quantity}</span>}
                          {item.dosage && <span className="text-muted-foreground"> · {item.dosage}</span>}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {t('asked by {name}', { name: order.requestedByStaffName ?? '—' })} {formatDistanceToNowStrict(parseISO(order.createdAt), { addSuffix: true })}
                    </p>
                    {order.notes && <p className="whitespace-pre-wrap text-xs">{order.notes}</p>}
                    {view === 'done' && order.dispensedAt && (
                      <p className="text-xs text-muted-foreground">{t('Dispensed {time} by {name}', { time: date(order.dispensedAt, 'd MMM, HH:mm'), name: order.dispensedByStaffName ?? '—' })}</p>
                    )}
                    {order.bill && (
                      <p className={cn('text-xs font-medium', order.bill.status === 'Paid' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400')}>
                        {t('Bill {id}', { id: order.bill.id })} · {formatINR(order.bill.amount)} · {t(order.bill.status)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {view === 'waiting' && canProcessPharmacy && (
                      <Button size="sm" onClick={() => setDispensing(order)}><PackageCheck className="mr-2 h-4 w-4" /> {t('Dispense')}</Button>
                    )}
                    {view === 'waiting' && (canRequest || canProcessPharmacy) && (
                      <Button size="sm" variant="ghost" onClick={() => cancel(order)} aria-label={t('Cancel order')}><X className="h-4 w-4" /></Button>
                    )}
                    {view === 'done' && canBill && order.bill && order.bill.status !== 'Paid' && order.bill.status !== 'Cancelled' && (
                      <Button size="sm" asChild>
                        <Link href={`/billing/form?billId=${order.bill.id}`}><IndianRupee className="mr-2 h-4 w-4" /> {t('Collect payment')}</Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {dispensing && (
        <DispenseDialog order={dispensing} patientName={dispensing.patientName ?? ''} open={!!dispensing}
          onOpenChange={open => { if (!open) setDispensing(null); }} onDone={() => load(true)} />
      )}
    </PageBody>
  );
}
