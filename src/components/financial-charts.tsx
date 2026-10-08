"use client";

// The Financial Dashboard's charts. Loaded separately (next/dynamic) so the totals and
// tables show before the charting library has downloaded.
import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PieLabelRenderProps, TooltipProps } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { useT } from '@/components/language-provider';
import { formatINR } from '@/lib/format';
import type { FinancialSummary } from '@/lib/data';

const COLORS: Record<string, string> = {
  Paid: 'hsl(var(--chart-2))',
  Unpaid: 'hsl(var(--chart-1))',
  'Partially Paid': 'hsl(var(--chart-4))',
  Cancelled: 'hsl(var(--chart-5))',
  Pharmacy: 'hsl(var(--chart-1))',
  Treatment: 'hsl(var(--chart-2))',
  'Referral/CC': 'hsl(var(--chart-1))',
  Material: 'hsl(var(--chart-2))',
  Salary: 'hsl(var(--chart-3))',
  Other: 'hsl(var(--chart-4))',
  Billed: 'hsl(var(--chart-1))',
  Collected: 'hsl(var(--chart-2))',
  Spent: 'hsl(var(--chart-3))',
};
const colorFor = (name: string) => COLORS[name] ?? 'hsl(var(--chart-3))';

type Slice = { name: string; value: number; fill: string };
const toSlices = (values: Record<string, number> | undefined): Slice[] =>
  Object.entries(values ?? {}).map(([name, value]) => ({ name, value: Number(value), fill: colorFor(name) }));

function MoneyTooltip({ active, payload, label, counts }: TooltipProps<number, string> & { counts?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background/80 p-2 shadow-lg">
      {label != null && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
      {payload.map(entry => (
        <p key={entry.name} style={{ color: entry.color ?? entry.payload?.fill }} className="text-sm">
          {entry.name}: {counts ? entry.value : formatINR(entry.value)}
        </p>
      ))}
    </div>
  );
}

// Percentage labels inside pie slices big enough to hold them.
function sliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: PieLabelRenderProps) {
  if (!percent || percent <= 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
  const x = Number(cx) + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const y = Number(cy) + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor={x > Number(cx) ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
      {`${name} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
}

function PieCard({ title, description, data, config }: { title: string; description: string; data: Slice[]; config: ChartConfig }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex h-[300px] items-center justify-center">
        <ChartContainer config={config} className="h-full w-full max-w-xs">
          <ResponsiveContainer>
            <PieChart>
              <Tooltip content={<MoneyTooltip />} />
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={sliceLabel}>
                {data.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export default function FinancialCharts({ summary, showBilling, showPayments, allTime }: {
  summary: FinancialSummary;
  showBilling: boolean;
  showPayments: boolean;
  allTime: boolean;
}) {
  const t = useT();
  const { statuses, billTypes, paymentTypes, monthly, config } = useMemo(() => {
    const statuses = toSlices(summary.billStatusCounts);
    const billTypes = toSlices(summary.billTypeAmounts);
    const paymentTypes = toSlices(summary.paymentTypeAmounts);
    const monthly = summary.monthly.map(m => ({
      month: format(parseISO(`${m.month}-01`), 'MMM yy'),
      Billed: Number(m.billed),
      Collected: Number(m.collected),
      Spent: Number(m.spent),
    }));
    const config: ChartConfig = {};
    for (const name of [...statuses, ...billTypes, ...paymentTypes].map(s => s.name).concat('Billed', 'Collected', 'Spent')) {
      config[name] = { label: name, color: colorFor(name) };
    }
    return { statuses, billTypes, paymentTypes, monthly, config };
  }, [summary]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('Income & Expenditure')}</CardTitle>
          <CardDescription>{allTime ? 'Last 6 months' : 'By month'}</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ChartContainer config={config} className="h-full w-full">
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="#888888" fontSize={12} />
                <YAxis tickFormatter={value => `₹${value / 1000}k`} tickLine={false} axisLine={false} stroke="#888888" fontSize={12} />
                <Tooltip content={<MoneyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(['Billed', 'Collected', 'Spent'] as const).map(key => (
                  <Line key={key} type="monotone" dataKey={key} stroke={colorFor(key)} strokeWidth={2} dot={{ r: 4, fill: colorFor(key) }} activeDot={{ r: 6 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {showBilling && (
          <Card>
            <CardHeader>
              <CardTitle>{t('Bill Status')}</CardTitle>
              <CardDescription>Count of bills by their current payment status.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ChartContainer config={config} className="h-full w-full">
                <ResponsiveContainer>
                  <BarChart data={statuses} layout="vertical">
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" dataKey="value" hide />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} stroke="#888888" fontSize={12} width={100} />
                    <Tooltip content={<MoneyTooltip counts />} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="value" name="Bills" radius={4}>
                      {statuses.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
        {showPayments && (
          <PieCard title={t('Payments by Type')} description="Total amount spent for each payment category." data={paymentTypes} config={config} />
        )}
      </div>

      {showBilling && (
        <PieCard title={t('Billed Amount by Type')} description="Total billed for Pharmacy and Treatment bills." data={billTypes} config={config} />
      )}
    </>
  );
}
