// Referral fees worked out as a percentage of what the patient was billed, entered per
// type of procedure. The hospital pays this to the referring doctor.

import type { Bill } from '@/types/billing';
import type { ReferralFeeLine } from '@/types/patient';

export interface BilledProcedure {
  key: string;
  description: string;
  billType: string;
  amount: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// Groups the items on the patient's bills (cancelled bills left out) by bill type and
// description, so a procedure billed twice appears once with its combined amount.
export function billedProcedures(bills: Bill[]): BilledProcedure[] {
  const byKey = new Map<string, BilledProcedure>();
  for (const bill of bills) {
    if (bill.paymentStatus === 'Cancelled') continue;
    for (const item of bill.items ?? []) {
      const description = item.description?.trim();
      const amount = Number(item.total) || 0;
      if (!description || amount <= 0) continue;
      const billType = bill.billType || 'Other';
      const key = `${billType}|${description.toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) existing.amount = round2(existing.amount + amount);
      else byKey.set(key, { key, description, billType, amount: round2(amount) });
    }
  }
  return [...byKey.values()].sort((a, b) => a.billType.localeCompare(b.billType) || b.amount - a.amount);
}

export function referralLines(procedures: BilledProcedure[], percents: Record<string, string>): ReferralFeeLine[] {
  return procedures.map(p => {
    const percent = Number(percents[p.key] || 0);
    return { ...p, percent, fee: round2((p.amount * percent) / 100) };
  });
}

export const referralTotal = (lines: ReferralFeeLine[]) => round2(lines.reduce((sum, line) => sum + line.fee, 0));
