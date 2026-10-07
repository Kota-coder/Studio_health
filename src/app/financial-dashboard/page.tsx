
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { ChartContainer, ChartTooltip as ShadCNChartTooltip, ChartTooltipContent as ShadCNChartTooltipContent, ChartLegend as ShadCNChartLegend, ChartLegendContent as ShadCNChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { AreaChart, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Receipt } from 'lucide-react'; // Added Receipt
import { format, parseISO } from 'date-fns';
import type { StaffRole } from '@/types/staff';
import { PAGE_ROLES } from '@/config/permissions';
import { financialSummary as loadFinancialSummary, type FinancialSummary } from '@/lib/data';
import { cachedAt, invalidate } from '@/lib/data/cache';
import { RefreshStamp } from '@/components/refresh-stamp';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.financialDashboard;

const chartColorMapping: { [key: string]: string } = {
  Paid: "hsl(var(--chart-2))", // Greenish
  Unpaid: "hsl(var(--chart-1))", // Reddish/Orange
  "Partially Paid": "hsl(var(--chart-4))", // Yellowish
  Cancelled: "hsl(var(--chart-5))", // Grayish/Bluish

  Pharmacy: "hsl(var(--chart-1))",
  Treatment: "hsl(var(--chart-2))",
  "Referral/CC": "hsl(var(--chart-1))",
  Material: "hsl(var(--chart-2))",
  Salary: "hsl(var(--chart-3))",
  Other: "hsl(var(--chart-4))",
};


export default function FinancialDashboardPage() {
  const router = useRouter();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  // Totals are worked out by the database (financial_summary), so the page downloads a
  // small summary rather than every bill, payment and patient.
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!authIsLoading && currentUser && !ALLOWED_ROLES.includes(currentUser.role)) {
      router.replace('/dashboard');
    } else if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) invalidate('summary:');
    try {
      setSummary(await loadFinancialSummary());
      setLoadedAt(cachedAt('summary:financial'));
    } catch (error) {
      console.error("Error loading financial data:", error);
    }
  }, []);

  useEffect(() => {
    if (currentUser && ALLOWED_ROLES.includes(currentUser.role)) {
      setIsLoading(true);
      load().finally(() => setIsLoading(false));
    } else if (!currentUser && !authIsLoading) {
      setIsLoading(false);
    }
  }, [currentUser, authIsLoading, load]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    load(true).finally(() => setIsRefreshing(false));
  };

  const financialSummary = useMemo(() => {
    const toChart = (values: Record<string, number> | undefined, key: 'count' | 'total') =>
      Object.entries(values ?? {}).map(([name, value]) => ({
        name,
        [key]: Number(value),
        fill: chartColorMapping[name] || "hsl(var(--chart-3))",
      })) as Array<{ name: string; count: number; total: number; fill: string }>;
    const totalBilled = Number(summary?.totalBilled ?? 0);
    const totalCollected = Number(summary?.totalCollected ?? 0);
    return {
      totalBilled,
      totalCollected,
      totalOutstanding: totalBilled - totalCollected,
      totalSpent: Number(summary?.totalSpent ?? 0),
      billStatusChartData: toChart(summary?.billStatusCounts, 'count'),
      billTypeChartData: toChart(summary?.billTypeAmounts, 'total'),
      paymentTypeChartData: toChart(summary?.paymentTypeAmounts, 'total'),
      monthlyBillingData: (summary?.monthly ?? []).map(m => ({
        month: format(parseISO(`${m.month}-01`), 'MMM yy'),
        Billed: Number(m.billed),
        Collected: Number(m.collected),
        Spent: Number(m.spent),
      })),
    };
  }, [summary]);

  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    financialSummary.billStatusChartData.forEach(item => {
      config[item.name] = { label: item.name, color: item.fill };
    });
    financialSummary.paymentTypeChartData.forEach(item => {
      config[item.name] = { label: item.name, color: item.fill };
    });
    financialSummary.billTypeChartData.forEach(item => {
        config[item.name] = { label: item.name, color: item.fill };
    });
    config["Billed"] = { label: "Billed", color: "hsl(var(--chart-1))" };
    config["Collected"] = { label: "Collected", color: "hsl(var(--chart-2))" };
    config["Spent"] = { label: "Spent", color: "hsl(var(--chart-3))" };
    return config;
  }, [financialSummary]);


  // Doctor fees per attending doctor and referral fees per referring doctor (unpaid
  // referrals without their own fee count at the doctor's default fee).
  const doctorFeeRows = (summary?.doctorFees ?? []).map(row => ({ ...row, paid: Number(row.paid), pending: Number(row.pending) }));
  const referralFeeRows = (summary?.referralFees ?? []).map(row => ({ ...row, paid: Number(row.paid), pending: Number(row.pending) }));

  if (authIsLoading || isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading financial dashboard...</p></div>;
  }
  if (!currentUser || !ALLOWED_ROLES.includes(currentUser.role)) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied.</p></div>;
  }

  const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-background/80 border rounded-md shadow-lg">
          <p className="label text-sm font-medium text-muted-foreground">{`${label}`}</p>
          {payload.map((entry: any) => (
            <p key={`item-${entry.name}`} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${entry.dataKey === 'count' ? entry.value : formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
  
  const CustomLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 mt-2 text-xs">
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center">
            <span style={{ backgroundColor: entry.color, width: '10px', height: '10px', display: 'inline-block', marginRight: '5px', borderRadius: '50%' }}></span>
            <span>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <AreaChart className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Financial Dashboard</h1>
      </header>
      <RefreshStamp loadedAt={loadedAt} onRefresh={handleRefresh} isRefreshing={isRefreshing} className="justify-end" />

      {!summary || (summary.billCount === 0 && summary.paymentCount === 0) ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Financial Data Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              There are no bills or payments recorded to display on the dashboard. Start by creating some bills or recording payments.
            </CardDescription>
            <AlertTriangle data-ai-hint="empty finance data" className="mx-auto h-24 w-24 text-muted-foreground opacity-50 mt-4" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalBilled)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalCollected)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalOutstanding)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Payments Made</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalSpent)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Income & Expenditure (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer>
                  <LineChart data={financialSummary.monthlyBillingData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="#888888" fontSize={12} />
                    <YAxis tickFormatter={(value) => `₹${value/1000}k`} tickLine={false} axisLine={false} stroke="#888888" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <Line type="monotone" dataKey="Billed" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{r:4, fill:"hsl(var(--chart-1))"}} activeDot={{r:6}} />
                    <Line type="monotone" dataKey="Collected" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{r:4, fill:"hsl(var(--chart-2))"}} activeDot={{r:6}}/>
                    <Line type="monotone" dataKey="Spent" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{r:4, fill:"hsl(var(--chart-3))"}} activeDot={{r:6}}/>
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bill Status Distribution</CardTitle>
                <CardDescription>Count of bills by their current payment status.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <ResponsiveContainer>
                    <BarChart data={financialSummary.billStatusChartData} layout="vertical">
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" dataKey="count" hide/>
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} stroke="#888888" fontSize={12} width={100}/>
                      <Tooltip content={<CustomTooltip />} cursor={{fill: "hsl(var(--muted))"}}/>
                      <Bar dataKey="count" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payments by Type</CardTitle>
                <CardDescription>Total amount spent for each payment category.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                 <ChartContainer config={chartConfig} className="h-full w-full max-w-xs">
                  <ResponsiveContainer>
                    <PieChart>
                      <Tooltip content={<CustomTooltip />} />
                      <Pie data={financialSummary.paymentTypeChartData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} 
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return ( percent > 0.05 ? 
                              <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
                                {`${name} (${(percent * 100).toFixed(0)}%)`}
                              </text> : null
                            );
                          }}
                      >
                        {financialSummary.paymentTypeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                       <ShadCNChartLegend content={<ShadCNChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
           <Card>
            <CardHeader>
                <CardTitle>Billed Amount by Type</CardTitle>
                <CardDescription>Distribution of total billed amounts between Pharmacy and Treatment types.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
                <ChartContainer config={chartConfig} className="h-full w-full max-w-xs">
                <ResponsiveContainer>
                    <PieChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Pie data={financialSummary.billTypeChartData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return ( percent > 0.05 ? 
                                <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
                                {`${name} (${(percent * 100).toFixed(0)}%)`}
                                </text> : null
                            );
                        }}
                    >
                        {financialSummary.billTypeChartData.map((entry, index) => (
                        <Cell key={`cell-billtype-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>
                    <ShadCNChartLegend content={<ShadCNChartLegendContent nameKey="name" />} />
                    </PieChart>
                </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg mt-6">
            <CardHeader>
              <CardTitle>Doctor Fees</CardTitle>
              <CardDescription>Fees earned per case by each attending doctor. Pay pending fees from Payments → Record New Payment → Doctor Fee.</CardDescription>
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
                        <TableCell className="text-right">₹{row.paid.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">{row.pending > 0 ? `₹${row.pending.toFixed(2)}` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg mt-6">
            <CardHeader>
              <CardTitle>Referral Fees</CardTitle>
              <CardDescription>Fees owed to referring doctors for the patients they referred. Pay them from Payments → Record New Payment → Referral/CC.</CardDescription>
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
                        <TableCell className="text-right">₹{row.paid.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.pending > 0 ? `₹${row.pending.toFixed(2)}` : row.unpriced === 0 ? '—' : ''}
                          {row.unpriced > 0 && <span className="block text-xs font-normal text-muted-foreground">{row.unpriced} with no fee set</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

