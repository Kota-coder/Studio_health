"use client";

import Link from '@/components/app-link';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Boxes, CalendarClock, HandCoins, IndianRupee, Receipt, Stethoscope, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useT } from '@/components/language-provider';
import { useFeatures } from '@/hooks/use-features';
import { cn } from '@/lib/utils';
import type { HomeSummary } from '@/lib/data';
import type { StaffMember } from '@/types/staff';

const rupees = (n: number) => `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

function Tile({ icon: Icon, title, value, detail, href, onClick, tone }: {
  icon: React.ElementType;
  title: string;
  value: string;
  detail?: string;
  href?: string;
  onClick?: () => void;
  tone?: 'warn';
}) {
  const body = (
    <Card className={cn('h-full transition-colors', (href || onClick) && 'hover:bg-muted/50', tone === 'warn' && 'border-amber-300 dark:border-amber-900')}>
      <CardContent className="flex items-start gap-3 p-4">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0 text-primary', tone === 'warn' && 'text-amber-600')} />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</button>;
  return body;
}

// "Today at a glance" on the home dashboard. The database returns only the sections the
// person's role may see (home_summary()); switched-off features are hidden here.
export function RoleSummary({ summary, user, onShowMine }: { summary: HomeSummary; user: StaffMember; onShowMine: () => void }) {
  const t = useT();
  const { isOn } = useFeatures();
  const clinical = user.role === 'Doctor' || user.role === 'Nurse';
  const tiles: React.ReactNode[] = [];
  const { patients, duty } = summary;

  if (clinical) {
    tiles.push(<Tile key="mine" icon={Stethoscope} title={t('My patients')} value={String(patients.mine)}
      detail={patients.myCritical ? t('{n} critical', { n: patients.myCritical }) : t('None critical')}
      tone={patients.myCritical ? 'warn' : undefined} onClick={onShowMine} />);
  }
  tiles.push(<Tile key="care" icon={Users} title={t('Patients in care')} value={String(patients.inCare)}
    detail={[t('{n} critical', { n: patients.critical }), t('{n} admitted today', { n: patients.newToday })].join(' · ')} />);

  if (isOn('duty')) {
    const since = duty.clockedInSince ? format(parseISO(duty.clockedInSince), 'h:mm a') : null;
    const next = duty.nextShift;
    const nextText = next
      ? t('Next shift: {type} {start}–{end}', { type: t(next.type), start: next.start, end: next.end })
        + (next.date !== format(new Date(), 'yyyy-MM-dd') ? ` (${format(parseISO(next.date), 'd MMM')})` : '')
      : t('No shift planned');
    tiles.push(<Tile key="duty" icon={CalendarClock} title={t('My duty')} href="/duty"
      value={since ? t('On duty since {time}', { time: since }) : t('Not clocked in')}
      detail={user.role === 'Super Admin' || user.role === 'Admin' ? `${t('{n} staff on duty now', { n: duty.onDutyNow })} · ${nextText}` : nextText} />);
  }

  if (summary.billing && isOn('billing')) {
    const b = summary.billing;
    tiles.push(<Tile key="bills" icon={Receipt} title={t('Bills today')} href="/billing" value={rupees(b.todayAmount)}
      detail={`${t('{n} bills', { n: b.todayCount })} · ${t('Unpaid: {amount} ({n})', { amount: rupees(b.unpaidAmount), n: b.unpaidCount })}`} />);
  }
  if (summary.money && isOn('financialDashboard')) {
    const m = summary.money;
    tiles.push(<Tile key="money" icon={IndianRupee} title={t('Collected today')} href="/financial-dashboard" value={rupees(m.collectedToday)}
      detail={`${t('Paid out today: {amount}', { amount: rupees(m.paidOutToday) })} · ${t('This month: in {in}, out {out}', { in: rupees(m.collectedMonth), out: rupees(m.paidOutMonth) })}`} />);
  }
  if (summary.feesOwed && (isOn('doctorFees') || isOn('referralFees'))) {
    const f = summary.feesOwed;
    const parts = [
      isOn('doctorFees') && t('Doctors: {amount} ({n})', { amount: rupees(f.doctorAmount), n: f.doctorCases }),
      isOn('referralFees') && t('Referrals: {amount} ({n})', { amount: rupees(f.referralAmount), n: f.referralCases }),
    ].filter(Boolean) as string[];
    const total = (isOn('doctorFees') ? f.doctorAmount : 0) + (isOn('referralFees') ? f.referralAmount : 0);
    tiles.push(<Tile key="fees" icon={HandCoins} title={t('Fees to pay')} href="/payments/form" value={rupees(total)} detail={parts.join(' · ')} />);
  }
  if (summary.myFees && isOn('doctorFees') && summary.myFees.pendingCases > 0) {
    tiles.push(<Tile key="myfees" icon={HandCoins} title={t('My fees pending')} value={rupees(summary.myFees.pendingAmount)}
      detail={t('{n} cases', { n: summary.myFees.pendingCases })} />);
  }
  if (summary.stock && isOn('inventory')) {
    const s = summary.stock;
    const need = s.low + s.outOfStock;
    tiles.push(<Tile key="stock" icon={need ? AlertTriangle : Boxes} title={t('Stock')} href="/inventory" tone={need ? 'warn' : undefined}
      value={need ? t('{n} need refill', { n: need }) : t('All stocked')}
      detail={need ? t('{out} out of stock · {low} low', { out: s.outOfStock, low: s.low }) : undefined} />);
  }

  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{tiles}</div>;
}
