"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/components/app-link';
import { ClipboardCheck, Hand, IndianRupee, Microscope, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { RefreshStamp } from '@/components/refresh-stamp';
import { RequestSummary } from '@/components/lab/request-summary';
import { useFormat, useT } from '@/components/language-provider';
import { useStaff } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { testRequests } from '@/lib/data';
import { cachedAt, invalidate } from '@/lib/data/cache';
import { canOpen } from '@/config/permissions';
import { useFeatures } from '@/hooks/use-features';
import { useWorkflow } from '@/hooks/use-workflow';
import { formatINR, patientDisplayId } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TestRequest } from '@/types/testRequest';

type View = 'mine' | 'queue' | 'all' | 'done';

// The lab's work list: requests assigned to me, the queue waiting for any technician, every
// open request, and what was finished in the last day. Search by patient name or number.
// Access and the feature switch are checked by PageGuard (src/config/navigation.ts).
export default function LabPage() {
  const t = useT();
  const { date } = useFormat();
  const { toast } = useToast();
  const currentUser = useStaff();
  const isTechnician = currentUser.role === 'Lab Technician';
  const { isOn } = useFeatures();
  const canBill = isOn('billing') && canOpen('billing', currentUser.role);
  const { canProcessLab } = useWorkflow(); // taking requests and recording results

  const [open, setOpen] = useState<TestRequest[] | null>(null);
  const [done, setDone] = useState<TestRequest[] | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [search, setSearch] = useState('');
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) invalidate('lab:');
    try {
      const list = await testRequests.listOpen();
      setOpen(list);
      setLoadedAt(cachedAt('lab:open') ?? new Date());
      // Technicians start on their own requests, or the queue when they have none.
      setView(v => v ?? (!isTechnician ? 'all' : list.some(r => r.assignedToStaffId === currentUser.id) ? 'mine' : 'queue'));
    } catch {
      toast({ title: t('Could not load the lab requests'), variant: 'destructive' });
      setOpen(prev => prev ?? []);
      setView(v => v ?? 'all');
    }
  }, [currentUser.id, isTechnician, t, toast]);

  useEffect(() => { load(); }, [load]);

  // New requests appear without a manual refresh while the page is open and visible.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (view === 'done' && done === null) {
      testRequests.listRecentlyDone().then(setDone).catch(() => setDone([]));
    }
  }, [view, done]);

  const refresh = () => {
    setIsRefreshing(true);
    setDone(null);
    load(true).finally(() => setIsRefreshing(false));
  };

  const act = async (request: TestRequest, action: () => Promise<unknown>) => {
    setBusyId(request.id);
    try {
      await action();
    } catch (e) {
      toast({ title: t('Could not update the request'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
      await load(true);
    }
  };

  const lists = useMemo(() => {
    const all = open ?? [];
    return {
      mine: all.filter(r => r.assignedToStaffId === currentUser.id),
      queue: all.filter(r => !r.assignedToStaffId),
      all,
      done: done ?? [],
    };
  }, [open, done, currentUser.id]);

  if (!open || !view) return <PageLoading />;

  const term = search.trim().toLowerCase();
  const shown = lists[view]
    .filter(r => !term || (r.patientName ?? '').toLowerCase().includes(term) || patientDisplayId(r.patientId).toLowerCase().includes(term))
    // Urgent first, then oldest first.
    .sort((a, b) => view === 'done' ? 0 : (a.priority === 'Urgent' ? 0 : 1) - (b.priority === 'Urgent' ? 0 : 1) || a.createdAt.localeCompare(b.createdAt));

  const views: Array<{ key: View; label: string; count?: number }> = [
    { key: 'mine', label: t('Assigned to me'), count: lists.mine.length },
    { key: 'queue', label: t('Waiting in queue'), count: lists.queue.length },
    { key: 'all', label: t('All open'), count: lists.all.length },
    { key: 'done', label: t('Done today') },
  ];
  const resultLink = (r: TestRequest) => `/patients/${patientDisplayId(r.patientId)}?request=${r.id}`;

  return (
    <PageBody>
      <PageHeader icon={Microscope} title={t('Lab Requests')}
        description={t('Tests requested from patient pages. Take one from the queue, then record its result on the patient page.')} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist">
          {views.map(v => (
            <Button key={v.key} role="tab" aria-selected={view === v.key} size="sm" variant={view === v.key ? 'default' : 'outline'} onClick={() => setView(v.key)}>
              {v.label}{v.count !== undefined ? ` (${v.count})` : ''}
            </Button>
          ))}
        </div>
        <RefreshStamp loadedAt={loadedAt} onRefresh={refresh} isRefreshing={isRefreshing} className="justify-end" />
      </div>

      <Input placeholder={t('Search by patient name or number…')} value={search} onChange={e => setSearch(e.target.value)} aria-label={t('Search')} />

      <Card>
        <CardContent className="p-0">
          {view === 'done' && done === null ? (
            <p className="p-6 text-sm text-muted-foreground">{t('Loading…')}</p>
          ) : shown.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {term ? t('No requests match your search.') : view === 'mine' ? t('Nothing assigned to you. Take a request from the queue.') : view === 'queue' ? t('The queue is empty.') : t('No requests.')}
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {shown.map(request => {
                const mine = request.assignedToStaffId === currentUser.id;
                const busy = busyId === request.id;
                return (
                  <li key={request.id} className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between', request.priority === 'Urgent' && view !== 'done' && 'bg-red-50/60 dark:bg-red-950/20')}>
                    <div className="min-w-0 space-y-1">
                      <Link href={`/patients/${patientDisplayId(request.patientId)}`} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                        {request.patientName ?? t('Patient')} · {patientDisplayId(request.patientId)}
                      </Link>
                      <RequestSummary request={request} />
                      {view === 'done' && request.completedAt && (
                        <p className="text-xs text-muted-foreground">{t('Done {time} by {name}', { time: date(request.completedAt, 'd MMM, HH:mm'), name: request.assignedToStaffName ?? '—' })}</p>
                      )}
                      {view === 'done' && request.bill && (
                        <p className={cn('text-xs font-medium', request.bill.status === 'Paid' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400')}>
                          {t('Bill {id}', { id: request.bill.id })} · {formatINR(request.bill.amount)} · {t(request.bill.status)}
                        </p>
                      )}
                    </div>
                    {view === 'done' && canBill && request.bill && request.bill.status !== 'Paid' && request.bill.status !== 'Cancelled' && (
                      <Button size="sm" asChild className="shrink-0">
                        <Link href={`/billing/form?billId=${request.bill.id}`}><IndianRupee className="mr-2 h-4 w-4" /> {t('Collect payment')}</Link>
                      </Button>
                    )}
                    {view !== 'done' && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {canProcessLab && (!request.assignedToStaffId || (mine && request.status === 'Requested')) && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => act(request, () => testRequests.take(request.id, currentUser.id))}>
                            <Hand className="mr-2 h-4 w-4" /> {mine ? t('Start') : t('Take')}
                          </Button>
                        )}
                        {canProcessLab && (
                          <Button size="sm" asChild>
                            <Link href={resultLink(request)}><ClipboardCheck className="mr-2 h-4 w-4" /> {t('Record result')}</Link>
                          </Button>
                        )}
                        {request.assignedToStaffId && (mine || !isTechnician) && (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(request, () => testRequests.release(request.id))}>
                            <Undo2 className="mr-2 h-4 w-4" /> {t('Back to queue')}
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
