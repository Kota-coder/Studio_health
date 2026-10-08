"use client";

import { format, isValid, parse } from 'date-fns';
import { Input } from '@/components/ui/input';
import Datepicker from '@/components/ui/datepicker';
import { DMY } from '@/lib/format';

// A date typed as dd/MM/yyyy or picked from a calendar. The value is the dd/MM/yyyy text
// (as stored); use parseDMY() to check it before saving.
export function DateField({ id, value, onChange, required, disabled, defaultMonth, max, className }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  defaultMonth?: Date;
  max?: Date; // latest date that may be picked (default: today)
  className?: string;
}) {
  const selected = parseDMY(value);
  return (
    <div className={`flex items-center ${className ?? ''}`}>
      <Input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder="dd/mm/yyyy" inputMode="numeric"
        required={required} disabled={disabled} aria-invalid={value !== '' && !selected} className="rounded-r-none" />
      {!disabled && (
        <Datepicker selected={selected} defaultMonth={defaultMonth}
          disabled={max ? date => date > max || date < new Date('1900-01-01') : undefined}
          onDateChange={date => { if (date) onChange(format(date, DMY)); }}
          triggerClassName="rounded-l-none border-l-0 w-auto p-2.5" />
      )}
    </div>
  );
}

// The date in a dd/MM/yyyy text, or null if it isn't a real date in that form.
export function parseDMY(value: string): Date | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())) return null;
  const date = parse(value.trim(), DMY, new Date());
  return isValid(date) && format(date, DMY) === value.trim() ? date : null;
}
