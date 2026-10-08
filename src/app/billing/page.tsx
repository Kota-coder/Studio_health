
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Bill, PaymentStatus } from '@/types/billing';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Eye, CreditCard, ArrowLeft, Pill, Stethoscope, Download, Trash2, Printer } from 'lucide-react';
import { format, parseISO, isValid, parse } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { bills as billsRepo, staff as staffRepo } from '@/lib/data';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { MethodTotals } from '@/components/method-totals';
import type { StaffMember } from '@/types/staff';
import { cn } from "@/lib/utils";
import type { StaffRole } from '@/types/staff';
import { PAGE_ROLES } from '@/config/permissions';
import { DEFAULT_DATE_FILTER, DateRangeFilter, dateFilterRange, describeDateFilter, type DateFilterValue } from '@/components/date-range-filter';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.billing;
const ALL_PAYMENT_STATUSES: (PaymentStatus | "All")[] = ["All", "Paid", "Unpaid", "Partially Paid", "Cancelled"];

const STATUS_COLORS: Record<string, string> = {
  'Unpaid': 'text-red-600',
  'Partially Paid': 'text-yellow-600',
  'Paid': 'text-emerald-700',
  'Cancelled': 'text-gray-500',
};

export default function BillingOverviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "All">("All");
  // The period and status are applied by the database, so only matching bills are downloaded.
  // Choose "All time" with "Unpaid" to find every outstanding bill.
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const [filterMethod, setFilterMethod] = useState<string>("All");
  const [filterProcessedBy, setFilterProcessedBy] = useState<string>("All");
  const methodOptions = usePaymentMethods();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  useEffect(() => { staffRepo.list().then(setStaffList).catch(() => setStaffList([])); }, []);
  const [isFiltering, setIsFiltering] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (!authIsLoading && currentUser && !ALLOWED_ROLES.includes(currentUser.role)) {
      toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
      router.replace('/dashboard');
    } else if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router, toast]);

  useEffect(() => {
    if (currentUser && ALLOWED_ROLES.includes(currentUser.role)) {
      if (hasLoadedOnce) setIsFiltering(true); else setIsLoading(true);
      billsRepo.list({
        ...dateFilterRange(dateFilter),
        status: filterStatus === "All" ? undefined : filterStatus,
        method: filterMethod === "All" ? undefined : filterMethod,
        processedBy: filterProcessedBy === "All" ? undefined : Number(filterProcessedBy),
      })
        .then(setBills)
        .catch(error => {
          console.error("Error loading bills:", error);
          toast({ title: "Error", description: "Could not load billing data.", variant: "destructive" });
          setBills([]);
        })
        .finally(() => { setIsLoading(false); setIsFiltering(false); setHasLoadedOnce(true); });
    } else {
        setBills([]);
        setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasLoadedOnce only picks the loading style
  }, [toast, currentUser, dateFilter, filterStatus, filterMethod, filterProcessedBy]);

  const filteredBills = useMemo(() => {
    let tempBills = [...bills];

    if (searchTerm) {
      tempBills = tempBills.filter(bill =>
        bill.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return tempBills.sort((a, b) => {
        const dateA = isValid(parseISO(a.createdAt)) ? parseISO(a.createdAt) : new Date(0);
        const dateB = isValid(parseISO(b.createdAt)) ? parseISO(b.createdAt) : new Date(0);
        return dateB.getTime() - dateA.getTime();
    });
  }, [bills, searchTerm]);

  const formatDateSafe = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    let parsedDate;
    try {
      parsedDate = parseISO(dateString);
      if (isValid(parsedDate)) return format(parsedDate, 'dd/MM/yyyy');
    } catch (e) { /* ignore */ }

    try {
        parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());
        if(isValid(parsedDate)) return format(parsedDate, 'dd/MM/yyyy');
    } catch (e) { /* ignore */ }

    try {
        const createdAtDate = new Date(dateString);
        if(isValid(createdAtDate)) return format(createdAtDate, 'dd/MM/yyyy');
    } catch(e) { /* ignore */ }

    return dateString;
  };

  const BillTypeIcon = ({ type }: { type: Bill['billType'] }) => {
    if (type === "Pharmacy") return <Pill className="h-4 w-4 text-green-600 inline-block mr-1" />;
    if (type === "Treatment") return <Stethoscope className="h-4 w-4 text-blue-600 inline-block mr-1" />;
    return null;
  };

  const escapeCsvField = (field: any): string => {
    if (field === null || field === undefined) {
      return "";
    }
    const stringField = String(field);
    // If the field contains a comma, double quote, or newline, enclose it in double quotes
    // and escape any existing double quotes by doubling them (e.g., " becomes "")
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  };

  const handleDownloadCSV = useCallback(() => {
    if (filteredBills.length === 0) {
      toast({ title: "No Data", description: "There are no bills matching these filters to download.", variant: "default" });
      return;
    }

    const headers = [
      "Bill ID", "Patient ID", "Patient Name", "Bill Date", "Bill Type",
      "Total Amount", "Payment Method", "Payment Status", "Payment Date",
      "Processed By", "Notes", "Created At"
    ];

    const csvRows = [headers.join(',')];

    filteredBills.forEach(bill => {
      const row = [
        escapeCsvField(bill.id),
        escapeCsvField(bill.patientId),
        escapeCsvField(bill.patientName),
        escapeCsvField(formatDateSafe(bill.billDate)),
        escapeCsvField(bill.billType || 'N/A'),
        escapeCsvField(bill.totalAmount.toFixed(2)),
        escapeCsvField(bill.paymentMethod || 'N/A'),
        escapeCsvField(bill.paymentStatus || 'N/A'),
        escapeCsvField(bill.paymentStatus === 'Paid' && bill.paymentDate ? formatDateSafe(bill.paymentDate) : 'N/A'),
        escapeCsvField(bill.processedByStaffName || ''),
        escapeCsvField(bill.notes || ''),
        escapeCsvField(formatDateSafe(bill.createdAt))
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      const today = format(new Date(), 'yyyy-MM-dd');
      link.setAttribute('href', url);
      const range = dateFilterRange(dateFilter);
      const period = range.from || range.to ? `${range.from ?? 'start'}_to_${range.to ?? today}` : `all_${today}`;
      link.setAttribute('download', `bills_${period}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({title: "Success", description: "Billing data downloaded as CSV."});
    } else {
        toast({title: "Error", description: "CSV download not supported by your browser.", variant: "destructive"});
    }
  }, [filteredBills, toast]);

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading bills...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <div className="flex justify-center items-center min-h-screen"><p>Redirecting to login...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Billing Overview</h1>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-end gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
             <Button variant="outline" onClick={handleDownloadCSV}>
                <Download className="mr-2 h-4 w-4" /> Download CSV
            </Button>
            <Link href="/billing/form" passHref>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Bill
                </Button>
            </Link>
        </div>
      </header>

      <Card className="shadow-md mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-end">
          <DateRangeFilter value={dateFilter} onChange={setDateFilter} idPrefix="billsDate" className="w-full sm:w-auto [&_button]:mt-1" />
          <div className="w-full sm:flex-grow">
            <Label htmlFor="searchPatientName">Search by Patient Name or Bill ID</Label>
            <Input
              id="searchPatientName"
              type="text"
              placeholder="Enter patient name or bill ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="w-full sm:w-auto min-w-[200px]">
            <Label htmlFor="filterPaymentStatus">Filter by Payment Status</Label>
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as PaymentStatus | "All")}>
              <SelectTrigger id="filterPaymentStatus" className="mt-1">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                {ALL_PAYMENT_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>
                    {status === "All" ? "All Statuses" : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto min-w-[180px]">
            <Label htmlFor="filterBillMethod">Payment Method</Label>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger id="filterBillMethod" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Methods</SelectItem>
                {methodOptions.filter(m => m.usedFor !== 'Payments').map(m => <SelectItem key={m.id} value={m.name}>{m.name}{m.active ? '' : ' (off)'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto min-w-[200px]">
            <Label htmlFor="filterBillProcessedBy">Processed By</Label>
            <Select value={filterProcessedBy} onValueChange={setFilterProcessedBy}>
              <SelectTrigger id="filterBillProcessedBy" className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Anyone</SelectItem>
                {staffList.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!isFiltering && (
            <MethodTotals label="Received"
              rows={filteredBills.filter(b => b.paymentStatus === 'Paid' || b.paymentStatus === 'Partially Paid')
                .map(b => ({ method: b.paymentMethod, amount: b.paymentStatus === 'Paid' ? b.totalAmount : b.totalAmount / 2 }))} />
          )}
          <p className="w-full text-sm text-muted-foreground" role="status">
            {isFiltering ? 'Loading…' : `${filteredBills.length} bill${filteredBills.length === 1 ? '' : 's'} · ₹${filteredBills.reduce((sum, b) => sum + b.totalAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${describeDateFilter(dateFilter)}`}
          </p>
        </CardContent>
      </Card>

      {bills.length === 0 && !isLoading && (dateFilter.preset !== 'all' || filterStatus !== "All" || filterMethod !== "All" || filterProcessedBy !== "All") ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Bills Match These Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Choose a longer period, &quot;All time&quot; or another status to see more bills.</CardDescription>
          </CardContent>
        </Card>
      ) : bills.length === 0 && !isLoading ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Bills Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              There are no bills recorded yet. Click "Create New Bill" to start.
            </CardDescription>
          </CardContent>
        </Card>
      ) : filteredBills.length === 0 && bills.length > 0 ? (
         <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Bills Match Criteria</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No bills found matching your current search and filter settings.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Bills</CardTitle>
            <CardDescription>{dateFilter.preset === 'all' ? 'All bills' : `Bills dated ${describeDateFilter(dateFilter)}`}{filterStatus !== "All" ? ` · ${filterStatus}` : ''}, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="[&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-4 sm:[&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Bill Type</TableHead>
                  <TableHead className="hidden md:table-cell">Bill Date</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Payment Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Payment Date</TableHead>
                  <TableHead className="hidden md:table-cell">Method</TableHead>
                  <TableHead className="hidden xl:table-cell">Processed By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.id}</TableCell>
                    <TableCell>{bill.patientName}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <BillTypeIcon type={bill.billType} />
                      {bill.billType || 'N/A'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{formatDateSafe(bill.billDate)}</TableCell>
                    <TableCell>
                      ₹{bill.totalAmount.toFixed(2)}
                      {/* On phones the status column is hidden, so show it under the amount. */}
                      <span className={cn("block text-xs font-semibold sm:hidden", STATUS_COLORS[bill.paymentStatus] )}>{bill.paymentStatus || 'N/A'}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={cn("font-semibold",{
                        'text-red-600': bill.paymentStatus === 'Unpaid',
                        'text-yellow-600': bill.paymentStatus === 'Partially Paid',
                        'text-emerald-700': bill.paymentStatus === 'Paid',
                        'text-gray-500': bill.paymentStatus === 'Cancelled',
                      })}>
                        {bill.paymentStatus || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {bill.paymentStatus === 'Paid' && bill.paymentDate ? formatDateSafe(bill.paymentDate) : 'N/A'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{bill.paymentMethod || '—'}</TableCell>
                    <TableCell className="hidden xl:table-cell">{bill.processedByStaffName || '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap space-x-1 sm:space-x-2">
                      <Link href={`/billing/form?billId=${bill.id}`} passHref>
                        <Button variant="outline" size="sm" aria-label={`View or Edit ${bill.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/billing/print?billId=${bill.id}`} passHref>
                        <Button variant="outline" size="sm" aria-label={`Print ${bill.id}`} title={bill.paymentStatus === 'Paid' ? 'Print receipt' : 'Print bill'}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </Link>
                      {bill.paymentStatus === 'Unpaid' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (!confirm(`Delete unpaid bill ${bill.id}?`)) return;
                            try {
                              await billsRepo.remove(bill.id);
                              setBills(prev => prev.filter(b => b.id !== bill.id));
                              toast({ title: "Success", description: `Bill ${bill.id} has been deleted.` });
                            } catch (error: any) {
                              toast({ title: "Error", description: error?.message || "Could not delete bill.", variant: "destructive" });
                            }
                          }}
                          aria-label={`Delete ${bill.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
