"use client";

import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/lib/data';

export type DatePreset = 'last30' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear' | 'all' | 'custom';

export interface DateFilterValue {
  preset: DatePreset;
  from: string; // yyyy-MM-dd, used when preset is 'custom'
  to: string;
}

const PRESET_LABELS: Record<DatePreset, string> = {
  last30: 'Last 30 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  last3Months: 'Last 3 months',
  thisYear: 'This year',
  all: 'All time',
  custom: 'Custom dates',
};

const ymd = (date: Date) => format(date, 'yyyy-MM-dd');

export const DEFAULT_DATE_FILTER: DateFilterValue = { preset: 'last30', from: ymd(subDays(new Date(), 29)), to: ymd(new Date()) };

// The dates a filter value covers; empty for "All time".
export function dateFilterRange(value: DateFilterValue, today = new Date()): DateRange {
  switch (value.preset) {
    case 'last30': return { from: ymd(subDays(today, 29)), to: ymd(today) };
    case 'thisMonth': return { from: ymd(startOfMonth(today)), to: ymd(endOfMonth(today)) };
    case 'lastMonth': {
      const last = subMonths(today, 1);
      return { from: ymd(startOfMonth(last)), to: ymd(endOfMonth(last)) };
    }
    case 'last3Months': return { from: ymd(startOfMonth(subMonths(today, 2))), to: ymd(endOfMonth(today)) };
    case 'thisYear': return { from: ymd(startOfYear(today)), to: ymd(endOfYear(today)) };
    case 'all': return {};
    case 'custom': return { from: value.from || undefined, to: value.to || undefined };
  }
}

// e.g. "1 Sep 2026 – 30 Sep 2026", for headings and file names.
export function describeDateFilter(value: DateFilterValue): string {
  if (value.preset === 'all') return 'All time';
  const { from, to } = dateFilterRange(value);
  const show = (d?: string) => (d ? format(new Date(`${d}T00:00`), 'd MMM yyyy') : '…');
  return `${show(from)} – ${show(to)}`;
}

// Period picker for lists: preset periods, or custom from/to dates.
export function DateRangeFilter({ value, onChange, idPrefix = 'dateFilter', className }: {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
  idPrefix?: string;
  className?: string;
}) {
  const custom = value.preset === 'custom';
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-end', className)}>
      <div className="sm:w-44">
        <Label htmlFor={`${idPrefix}Period`}>Period</Label>
        <Select value={value.preset} onValueChange={preset => {
          const next = { ...value, preset: preset as DatePreset };
          // Switching to custom starts from the period that was showing.
          if (preset === 'custom' && value.preset !== 'custom') {
            const range = dateFilterRange(value);
            next.from = range.from ?? '';
            next.to = range.to ?? '';
          }
          onChange(next);
        }}>
          <SelectTrigger id={`${idPrefix}Period`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PRESET_LABELS) as DatePreset[]).map(preset => (
              <SelectItem key={preset} value={preset}>{PRESET_LABELS[preset]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {custom && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={`${idPrefix}From`}>From</Label>
            <Input id={`${idPrefix}From`} type="date" value={value.from} max={value.to || undefined}
              onChange={e => onChange({ ...value, from: e.target.value })} className="sm:w-40" />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}To`}>To</Label>
            <Input id={`${idPrefix}To`} type="date" value={value.to} min={value.from || undefined}
              onChange={e => onChange({ ...value, to: e.target.value })} className="sm:w-40" />
          </div>
        </div>
      )}
    </div>
  );
}
