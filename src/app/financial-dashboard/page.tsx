"use client";

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, AreaChart, IndianRupee, Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { DEFAULT_DATE_FILTER, DateRangeFilter, dateFilterRange, describeDateFilter, type DateFilterValue } from '@/components/date-range-filter';
import { RefreshStamp } from '@/components/refresh-stamp';
import { useT } from '@/components/language-provider';
import { useFeatures } from '@/hooks/use-features';
import { financialSummary as loadFinancialSummary, financialSummaryKey, type FinancialSummary } from '@/lib/data';
import { cachedAt, invalidate } from '@/lib/data/cache';
import { formatINR } from '@/lib/format';

// recharts is large; the charts load after the totals and tables.
const FinancialCharts = dynamic(() => import('@/components/financial-charts'), {
  ssr: false,
  loading: () => <div className="h-[350px] animate-pulse rounded-lg border bg-muted/40" aria-hidden />,
});

function Kpi({ title, value, icon: Icon, iconClass }: { title: string; value: number; icon: React.ElementType; iconClass?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={iconClass ?? 'h-4 w-4 text-muted-foreground'} />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{formatINR(value)}</div></CardContent>
    </Card>
  );
}

// Totals are worked out by the database (financial_summary), so the page downloads a small
// summary rather than every bill, payment and patient.
export default function FinancialDashboardPage() {
  const t = useT();
  const { isOn } = useFeatures();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  // Totals and charts cover this period (bills by bill date, payments by payment date).
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ ...DEFAULT_DATE_FILTER, preset: 'all' });

  const load = useCallback(async (refresh = false) => {
    if (refresh) invalidate('summary:');
    try {
      const range = dateFilterRange(dateFilter);
      setSummary(await loadFinancialSummary(range));
      setLoadedAt(cachedAt(financialSummaryKey(range)));
    } catch (error) {
      console.error('Error loading financial data:', error);
    }
  }, [dateFilter]);

  useEffect(() => {
    setIsFiltering(true);
    load().finally(() => { setIsLoading(false); setIsFiltering(false); });
  }, [load]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    load(true).finally(() => setIsRefreshing(false));
  };

  if (isLoading) return <PageLoading />;

  const totalBilled = Number(summary?.totalBilled ?? 0);
  const totalCollected = Number(summary?.totalCollected ?? 0);
  // Doctor fees per attending doctor and referral fees per referring doctor (unpaid
  // referrals without their own fee count at the doctor's default fee).
  const doctorFeeRows = (summary?.doctorFees ?? []).map(row => ({ ...row, paid: Number(row.paid), pending: Number(row.pending) }));
  const referralFeeRows = (summary?.referralFees ?? []).map(row => ({ ...row, paid: Number(row.paid), pending: Number(row.pending) }));

  return (
    <PageBody>
      <PageHeader icon={AreaChart} title={t('Financial Dashboard')} description={t('Money billed, collected and paid out.')} />
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <DateRangeFilter value={dateFilter} onChange={setDateFilter} idPrefix="financeDate" />
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <p className="text-sm text-muted-foreground" role="status">{isFiltering ? t('Loading...') : describeDateFilter(dateFilter, t)}</p>
            <RefreshStamp loadedAt={loadedAt} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
          </div>
        </CardContent>
      </Card>

      {!summary || (summary.billCount === 0 && summary.paymentCount === 0) ? (
        <Card className="text-center">
          <CardHeader>
            <CardTitle>{dateFilter.preset === 'all' ? t('No financial data yet') : t('Nothing in this period')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              {dateFilter.preset === 'all'
                ? 'There are no bills or payments yet. Start by creating bills or recording payments.'
                : 'No bills or payments are dated in this period. Choose a longer period or "All time".'}
            </CardDescription>
            <AlertTriangle className="mx-auto mt-4 h-24 w-24 text-muted-foreground opacity-50" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isOn('billing') && <>
              <Kpi title={t('Total Billed')} value={totalBilled} icon={IndianRupee} />
              <Kpi title={t('Total Collected')} value={totalCollected} icon={TrendingUp} iconClass="h-4 w-4 text-green-500" />
              <Kpi title={t('Total Outstanding')} value={totalBilled - totalCollected} icon={TrendingDown} iconClass="h-4 w-4 text-red-500" />
            </>}
            {isOn('payments') && <Kpi title={t('Total Paid Out')} value={Number(summary.totalSpent)} icon={Receipt} />}
          </div>

          <FinancialCharts summary={summary} showBilling={isOn('billing')} showPayments={isOn('payments')} allTime={dateFilter.preset === 'all'} />

          <Card>
            <CardHeader>
              <CardTitle>{t('By Payment Method')}</CardTitle>
              <CardDescription>Money received on bills (partly paid bills count as half) and paid out, for {describeDateFilter(dateFilter)}.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {([['Received', summary.receivedByMethod, 'billing'], ['Paid out', summary.paidOutByMethod, 'payments']] as const).filter(([, , key]) => isOn(key)).map(([title, values]) => {
                const rows = Object.entries(values ?? {}).map(([method, amount]) => [method, Number(amount)] as const).sort((a, b) => b[1] - a[1]);
                const total = rows.reduce((sum, [, amount]) => sum + amount, 0);
                return (
                  <div key={title}>
                    <h3 className="mb-2 font-semibold">{t(title)}</h3>
                    {rows.length === 0 ? <p className="text-sm text-muted-foreground">None in this period.</p> : (
                      <Table className="[&_td]:px-2 [&_th]:px-2">
                        <TableHeader>
                          <TableRow><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Share</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map(([method, amount]) => (
                            <TableRow key={method}>
                              <TableCell>{method}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatINR(amount)}</TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">{total ? `${Math.round((amount / total) * 100)}%` : '—'}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right tabular-nums">{formatINR(total)}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {isOn('doctorFees') && (
            <Card>
            <CardHeader>
              <CardTitle>{t('Doctor Fees')}</CardTitle>
              <CardDescription>Fees earned per case by each attending doctor, as they stand now (not limited by the period above). Pay pending fees from Payments → New Payment → Doctor Fee.</CardDescription>
            </CardHeader>
            <CardContent>
              {doctorFeeRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No doctor fees set yet. Set them on a patient&apos;s page under Department &amp; Care Team.</p>
              ) : (
                <Table className="[&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-4 sm:[&_th]:px-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead className="hidden md:table-cell">Departments</TableHead>
                      <TableHead className="text-right">Cases</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctorFeeRows.map(row => (
                      <TableRow key={row.doctor}>
                        <TableCell className="font-medium">{row.doctor}</TableCell>
                        <TableCell className="hidden md:table-cell">{row.departments.join(', ') || '—'}</TableCell>
                        <TableCell className="text-right">{row.cases}</TableCell>
                        <TableCell className="text-right">{formatINR(row.paid)}</TableCell>
                        <TableCell className="text-right font-semibold">{row.pending > 0 ? formatINR(row.pending) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          )}

          {isOn('referralFees') && (
            <Card>
            <CardHeader>
              <CardTitle>{t('Referral Fees')}</CardTitle>
              <CardDescription>Fees owed to referring doctors for the patients they referred, as they stand now (not limited by the period above). Pay them from Payments → New Payment → Referral/CC.</CardDescription>
            </CardHeader>
            <CardContent>
              {referralFeeRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No referred patients yet. Set the referring doctor on a patient&apos;s admission details.</p>
              ) : (
                <Table className="[&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-4 sm:[&_th]:px-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referring Doctor</TableHead>
                      <TableHead className="text-right">Referrals</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referralFeeRows.map(row => (
                      <TableRow key={row.doctor}>
                        <TableCell className="font-medium">{row.doctor}</TableCell>
                        <TableCell className="text-right">{row.referrals}</TableCell>
                        <TableCell className="text-right">{formatINR(row.paid)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.pending > 0 ? formatINR(row.pending) : row.unpriced === 0 ? '—' : ''}
                          {row.unpriced > 0 && <span className="block text-xs font-normal text-muted-foreground">{row.unpriced} with no fee set</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          )}
        </>
      )}
    </PageBody>
  );
}
