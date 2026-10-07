"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Bill, PaymentStatus } from '@/types/billing';
import { Payment } from '@/types/payment';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { ArrowLeft, Download, Calendar, TrendingUp, TrendingDown, DollarSign, CreditCard, Receipt } from 'lucide-react';
import { format, parseISO, isValid, parse, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { cn } from "@/lib/utils";
import Datepicker from '@/components/ui/datepicker';
import { Breadcrumb } from '@/components/breadcrumb';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

interface DateRange {
  from: Date | null;
  to: Date | null;
}

export default function FinancialDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [quickFilter, setQuickFilter] = useState<string>("all");
  const [selectedMetric, setSelectedMetric] = useState<string>("revenue");
  const [billsSortField, setBillsSortField] = useState<'date' | 'amount' | 'patient'>('date');
  const [billsSortOrder, setBillsSortOrder] = useState<'asc' | 'desc'>('desc');
  const [paymentsSortField, setPaymentsSortField] = useState<'date' | 'amount' | 'patient'>('date');
  const [paymentsSortOrder, setPaymentsSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  useEffect(() => {
    if (currentUser) {
      setIsLoading(true);
      if (typeof window !== 'undefined') {
        try {
          const storedBills = localStorage.getItem('bills');
          const storedPayments = localStorage.getItem('payments');

          if (storedBills) {
            const parsedBills = JSON.parse(storedBills).map((b: any) => ({
              ...b,
              auditLog: Array.isArray(b.auditLog) ? b.auditLog : []
            }));
            setBills(parsedBills);
          }

          if (storedPayments) {
            setPayments(JSON.parse(storedPayments));
          }
        } catch (error) {
          console.error("Error loading financial data:", error);
          toast({ title: "Error", description: "Could not load financial data.", variant: "destructive" });
        }
      }
      setIsLoading(false);
    }
  }, [toast, currentUser]);

  const formatDateSafe = (dateString: string | undefined) => {
    if (!dateString) return null;
    let parsedDate;
    try {
      parsedDate = parseISO(dateString);
      if (isValid(parsedDate)) return parsedDate;
    } catch (e) { /* ignore */ }

    try {
      parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());
      if (isValid(parsedDate)) return parsedDate;
    } catch (e) { /* ignore */ }

    try {
      const createdAtDate = new Date(dateString);
      if (isValid(createdAtDate)) return createdAtDate;
    } catch (e) { /* ignore */ }

    return null;
  };

  const handleQuickFilter = (filter: string) => {
    setQuickFilter(filter);
    const today = new Date();

    switch (filter) {
      case "today":
        setDateRange({ from: startOfDay(today), to: endOfDay(today) });
        break;
      case "week":
        setDateRange({ from: startOfDay(subDays(today, 7)), to: endOfDay(today) });
        break;
      case "month":
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
      case "year":
        setDateRange({ from: startOfYear(today), to: endOfYear(today) });
        break;
      case "all":
      default:
        setDateRange({ from: null, to: null });
        break;
    }
  };

  const filteredData = useMemo(() => {
    let filteredBills = [...bills];
    let filteredPayments = [...payments];

    if (dateRange.from || dateRange.to) {
      filteredBills = bills.filter(bill => {
        const billDate = formatDateSafe(bill.billDate);
        if (!billDate) return false;

        if (dateRange.from && billDate < startOfDay(dateRange.from)) return false;
        if (dateRange.to && billDate > endOfDay(dateRange.to)) return false;
        return true;
      });

      filteredPayments = payments.filter(payment => {
        const paymentDate = formatDateSafe(payment.paymentDate);
        if (!paymentDate) return false;

        if (dateRange.from && paymentDate < startOfDay(dateRange.from)) return false;
        if (dateRange.to && paymentDate > endOfDay(dateRange.to)) return false;
        return true;
      });
    }

    return { bills: filteredBills, payments: filteredPayments };
  }, [bills, payments, dateRange]);

  const sortedBills = useMemo(() => {
    const { bills: filteredBills } = filteredData;
    return [...filteredBills].sort((a, b) => {
      let aValue, bValue;

      switch (billsSortField) {
        case 'date':
          aValue = formatDateSafe(a.billDate)?.getTime() || 0;
          bValue = formatDateSafe(b.billDate)?.getTime() || 0;
          break;
        case 'amount':
          aValue = a.totalAmount;
          bValue = b.totalAmount;
          break;
        case 'patient':
          aValue = a.patientName.toLowerCase();
          bValue = b.patientName.toLowerCase();
          break;
        default:
          return 0;
      }

      if (billsSortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [filteredData, billsSortField, billsSortOrder]);

  const sortedPayments = useMemo(() => {
    const { payments: filteredPayments } = filteredData;
    return [...filteredPayments].sort((a, b) => {
      let aValue, bValue;

      switch (paymentsSortField) {
        case 'date':
          aValue = formatDateSafe(a.paymentDate)?.getTime() || 0;
          bValue = formatDateSafe(b.paymentDate)?.getTime() || 0;
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'patient':
          aValue = a.patientName.toLowerCase();
          bValue = b.patientName.toLowerCase();
          break;
        default:
          return 0;
      }

      if (paymentsSortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [filteredData, paymentsSortField, paymentsSortOrder]);

  const handleBillsSort = (field: 'date' | 'amount' | 'patient') => {
    if (billsSortField === field) {
      setBillsSortOrder(billsSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setBillsSortField(field);
      setBillsSortOrder('desc');
    }
  };

  const handlePaymentsSort = (field: 'date' | 'amount' | 'patient') => {
    if (paymentsSortField === field) {
      setPaymentsSortOrder(paymentsSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPaymentsSortField(field);
      setPaymentsSortOrder('desc');
    }
  };

  const totalRevenue = useMemo(() => {
    return bills
      .filter(bill => bill.paymentStatus === 'Paid')
      .reduce((sum, bill) => sum + bill.totalAmount, 0);
  }, [bills]);

  const totalExpenses = useMemo(() => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  const netProfit = totalRevenue - totalExpenses;

  const analytics = useMemo(() => {
    const { bills: filteredBills, payments: filteredPayments } = filteredData;

    const totalRevenue = filteredBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const totalPayments = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const paidBills = filteredBills.filter(bill => bill.paymentStatus === 'Paid');
    const unpaidBills = filteredBills.filter(bill => bill.paymentStatus === 'Unpaid');
    const partiallyPaidBills = filteredBills.filter(bill => bill.paymentStatus === 'Partially Paid');

    // Revenue by bill type
    const revenueByType = filteredBills.reduce((acc, bill) => {
      const type = bill.billType || 'Other';
      acc[type] = (acc[type] || 0) + bill.totalAmount;
      return acc;
    }, {} as Record<string, number>);

    // Payment methods distribution
    const paymentMethodsData = filteredPayments.reduce((acc, payment) => {
      const method = payment.paymentMethod || 'Other';
      acc[method] = (acc[method] || 0) + payment.amount;
      return acc;
    }, {} as Record<string, number>);

    // Daily revenue trend (last 30 days)
    const dailyRevenue = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayRevenue = filteredBills
        .filter(bill => {
          const billDate = formatDateSafe(bill.billDate);
          return billDate && format(billDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
        })
        .reduce((sum, bill) => sum + bill.totalAmount, 0);

      dailyRevenue.push({
        date: format(date, 'MMM dd'),
        revenue: dayRevenue
      });
    }

    return {
      totalRevenue,
      totalPayments,
      totalBills: filteredBills.length,
      paidCount: paidBills.length,
      unpaidCount: unpaidBills.length,
      partiallyPaidCount: partiallyPaidBills.length,
      averageBillAmount: filteredBills.length > 0 ? totalRevenue / filteredBills.length : 0,
      revenueByTypeData: Object.entries(revenueByType).map(([name, value]) => ({ name, value })),
      paymentMethodsData: Object.entries(paymentMethodsData).map(([name, value]) => ({ name, value })),
      dailyRevenueData: dailyRevenue,
      paymentStatusData: [
        { name: 'Paid', value: paidBills.length, amount: paidBills.reduce((sum, b) => sum + b.totalAmount, 0) },
        { name: 'Unpaid', value: unpaidBills.length, amount: unpaidBills.reduce((sum, b) => sum + b.totalAmount, 0) },
        { name: 'Partially Paid', value: partiallyPaidBills.length, amount: partiallyPaidBills.reduce((sum, b) => sum + b.totalAmount, 0) }
      ]
    };
  }, [filteredData, totalExpenses, totalRevenue]);

  const handleDownloadReport = () => {
    const { bills: filteredBills, payments: filteredPayments } = filteredData;

    const reportData = [
      ['Financial Dashboard Report'],
      ['Generated on:', format(new Date(), 'dd/MM/yyyy HH:mm')],
      ['Date Range:', dateRange.from && dateRange.to 
        ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
        : 'All Time'],
      [''],
      ['Summary Metrics:'],
      ['Total Revenue:', `₹${analytics.totalRevenue.toFixed(2)}`],
      ['Total Payments Received:', `₹${analytics.totalPayments.toFixed(2)}`],
      ['Total Bills:', analytics.totalBills.toString()],
      ['Paid Bills:', analytics.paidCount.toString()],
      ['Unpaid Bills:', analytics.unpaidCount.toString()],
      ['Partially Paid Bills:', analytics.partiallyPaidCount.toString()],
      ['Average Bill Amount:', `₹${analytics.averageBillAmount.toFixed(2)}`],
      [''],
      ['Revenue by Type:'],
      ...analytics.revenueByTypeData.map(item => [item.name, `₹${item.value.toFixed(2)}`]),
      [''],
      ['Payment Methods:'],
      ...analytics.paymentMethodsData.map(item => [item.name, `₹${item.value.toFixed(2)}`])
    ];

    const csvContent = reportData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financial_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: "Success", description: "Financial report downloaded successfully." });
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading financial dashboard...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <div className="flex justify-center items-center min-h-screen"><p>Redirecting to login...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Breadcrumb items={[{ label: 'Financial Dashboard' }]} />

      <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Financial Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <Button variant="outline" onClick={handleDownloadReport}>
            <Download className="mr-2 h-4 w-4" /> Download Report
          </Button>
        </div>
      </header>

      {/* Date Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All Time", value: "all" },
                { label: "Today", value: "today" },
                { label: "Last 7 Days", value: "week" },
                { label: "This Month", value: "month" },
                { label: "This Year", value: "year" }
              ].map(filter => (
                <Button
                  key={filter.value}
                  variant={quickFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 items-end">
              <div>
                <Label>From Date</Label>
                <Datepicker
                  selected={dateRange.from}
                  onDateChange={(date) => setDateRange(prev => ({ ...prev, from: date || null }))}
                  placeholderText="Select start date"
                />
              </div>
              <div>
                <Label>To Date</Label>
                <Datepicker
                  selected={dateRange.to}
                  onDateChange={(date) => setDateRange(prev => ({ ...prev, to: date || null }))}
                  placeholderText="Select end date"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{analytics.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From {analytics.totalBills} bills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payments Received</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{analytics.totalPayments.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From {filteredData.payments.length} payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Bills</CardTitle>
            <Receipt className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.paidCount}</div>
            <p className="text-xs text-muted-foreground">
              {((analytics.paidCount / analytics.totalBills) * 100 || 0).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.unpaidCount}</div>
            <p className="text-xs text-muted-foreground">
              ₹{analytics.paymentStatusData.find(p => p.name === 'Unpaid')?.amount.toFixed(2) || '0.00'} unpaid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.dailyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.paymentStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.paymentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Bill Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.revenueByTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.paymentMethodsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ₹${value.toFixed(0)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.paymentMethodsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`₹${value}`, 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Bills</CardTitle>
            <CardDescription>Latest bills in selected date range</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill ID</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => handleBillsSort('patient')}
                  >
                    Patient {billsSortField === 'patient' && (billsSortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => handleBillsSort('date')}
                  >
                    Bill Date {billsSortField === 'date' && (billsSortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => handleBillsSort('amount')}
                  >
                    Amount {billsSortField === 'amount' && (billsSortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBills.slice(0, 5).map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.id}</TableCell>
                    <TableCell>{bill.patientName}</TableCell>
                    <TableCell>
                      {formatDateSafe(bill.billDate) ? 
                        format(formatDateSafe(bill.billDate)!, 'dd/MM/yyyy') : 
                        'N/A'
                      }
                    </TableCell>
                    <TableCell>₹{bill.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={cn("font-semibold", {
                        'text-red-600': bill.paymentStatus === 'Unpaid',
                        'text-yellow-600': bill.paymentStatus === 'Partially Paid',
                        'text-emerald-700': bill.paymentStatus === 'Paid',
                        'text-gray-500': bill.paymentStatus === 'Cancelled',
                      })}>
                        {bill.paymentStatus}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Latest payments received in selected date range</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => handlePaymentsSort('patient')}
                  >
                    Patient {paymentsSortField === 'patient' && (paymentsSortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => handlePaymentsSort('date')}
                  >
                    Payment Date {paymentsSortField === 'date' && (paymentsSortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => handlePaymentsSort('amount')}
                  >
                    Amount {paymentsSortField === 'amount' && (paymentsSortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayments.slice(0, 5).map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.id}</TableCell>
                    <TableCell>{payment.patientName}</TableCell>
                    <TableCell>
                      {formatDateSafe(payment.paymentDate) ? 
                        format(formatDateSafe(payment.paymentDate)!, 'dd/MM/yyyy') : 
                        'N/A'
                      }
                    </TableCell>
                    <TableCell>₹{payment.amount.toFixed(2)}</TableCell>
                    <TableCell>{payment.paymentMethod}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}