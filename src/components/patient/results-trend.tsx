"use client";

import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import { normalRange, rangeFlag, resultParameters } from '@/lib/test-templates';
import { cn } from '@/lib/utils';
import type { TestEntry } from '@/types/patient';

const MAX_COLUMNS = 8;
const newestFirst = (a: TestEntry, b: TestEntry) => b.createdAt.localeCompare(a.createdAt);

// Values outside the normal range in one result, e.g. ["Hemoglobin 18.2 g/dL (High)"].
export function abnormalValues(test: TestEntry, t: (text: string) => string): string[] {
  return resultParameters(test).flatMap(p => {
    const value = test.testData?.[p.id];
    const flag = rangeFlag(p, value);
    return flag ? [`${p.label} ${value}${p.unit ? ` ${p.unit}` : ''} (${t(flag)})`] : [];
  });
}

// Each test's results side by side over time (newest first), one row per parameter, with
// values outside the normal range marked, so changes are easy to follow.
export function ResultsTrend({ tests }: { tests: TestEntry[] }) {
  const t = useT();
  const { date } = useFormat();
  const groups = new Map<string, TestEntry[]>();
  for (const test of [...tests].sort(newestFirst)) groups.set(test.testTypeName, [...(groups.get(test.testTypeName) ?? []), test]);
  const tables = [...groups.entries()]
    .map(([name, list]) => ({ name, list: list.slice(0, MAX_COLUMNS), params: resultParameters(list[0]).filter(p => p.type !== 'textarea') }))
    .filter(g => g.params.some(p => g.list.some(test => String(test.testData?.[p.id] ?? '').trim() !== '')));

  if (tables.length === 0) return null;
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-primary" />{t('Results over time')}</CardTitle>
        <CardDescription>{t('Newest first. Values outside the normal range are marked.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {tables.map(({ name, list, params }) => (
          <div key={name} className="space-y-2">
            <h3 className="font-semibold">{name}</h3>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="sticky left-0 bg-muted/90 p-2 text-left font-medium">{t('Parameter')}</th>
                    {list.map(test => <th key={test.id} className="whitespace-nowrap p-2 text-right font-medium">{date(test.createdAt, 'dd MMM yy')}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {params.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="sticky left-0 bg-background p-2">
                        <span className="font-medium">{p.label}</span>
                        {normalRange(p) && <span className="block text-xs text-muted-foreground">{normalRange(p)}</span>}
                      </td>
                      {list.map(test => {
                        const value = test.testData?.[p.id];
                        const flag = rangeFlag(p, value);
                        return (
                          <td key={test.id} className={cn('whitespace-nowrap p-2 text-right tabular-nums', flag && 'font-semibold text-destructive')}>
                            {value === undefined || String(value).trim() === '' ? '—' : String(value)}
                            {flag && <span className="ml-1 text-xs">{flag === 'High' ? '↑' : '↓'}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
