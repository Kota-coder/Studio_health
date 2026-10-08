// Shared formatting for money, dates and patient numbers.
import { format, isValid, parse, parseISO } from 'date-fns';
import { te } from 'date-fns/locale';
import type { Lang } from '@/lib/i18n';

// Dates typed and stored as text use this pattern (e.g. bill and payment dates).
export const DMY = 'dd/MM/yyyy';

// ₹1,23,456.50 (Indian grouping). whole: ₹1,23,457
export function formatINR(amount: number | string | null | undefined, options?: { whole?: boolean }): string {
  const n = Number(amount ?? 0);
  const digits = options?.whole ? 0 : 2;
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

// Stored dates are ISO timestamps or dd/MM/yyyy text; returns null for anything else.
export function parseStoredDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const dmy = parse(value, DMY, new Date());
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value) && isValid(dmy)) return dmy;
  const iso = parseISO(value);
  return isValid(iso) ? iso : null;
}

// "05 Oct 2026" (Telugu month names when lang is 'te'); '—' when there is no valid date.
export function formatDate(value: string | Date | null | undefined, pattern = 'dd MMM yyyy', lang: Lang = 'en'): string {
  const date = parseStoredDate(value);
  return date ? format(date, pattern, lang === 'te' ? { locale: te } : undefined) : '—';
}

export const toDMY = (date: Date) => format(date, DMY);

// Patient numbers are shown with at least three digits: 7 -> "007".
export const patientDisplayId = (id: number | string) => String(id).padStart(3, '0');
