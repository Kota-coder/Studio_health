"use client";

import { Activity, AlertTriangle, CheckCircle2, HelpCircle, ShieldCheck } from 'lucide-react';
import { useT } from '@/components/language-provider';
import type { PatientCondition } from '@/types/patient';

const CONDITIONS: Record<PatientCondition, { icon: React.ElementType; className: string }> = {
  Critical: { icon: AlertTriangle, className: 'bg-red-100 text-red-700' },
  Medium: { icon: Activity, className: 'bg-yellow-100 text-yellow-700' },
  Low: { icon: ShieldCheck, className: 'bg-green-100 text-green-700' },
  Discharged: { icon: CheckCircle2, className: 'bg-sky-100 text-sky-700' },
  Unassigned: { icon: HelpCircle, className: 'bg-gray-100 text-gray-700' },
};

export function ConditionBadge({ condition }: { condition?: PatientCondition | null }) {
  const t = useT();
  const level = condition && CONDITIONS[condition] ? condition : 'Unassigned';
  const { icon: Icon, className } = CONDITIONS[level];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-semibold ${className}`}>
      <Icon className="mr-1 h-3 w-3" /> {t(level)}
    </span>
  );
}
