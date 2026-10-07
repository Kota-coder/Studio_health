
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
import { PlusCircle, Eye, CreditCard, ArrowLeft, Pill, Stethoscope, Download, Trash2 } from 'lucide-react';
import { format, parseISO, isValid, parse } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { bills as billsRepo } from '@/lib/data';
import { cn } from "@/lib/utils";
import type { StaffRole } from '@/types/staff';
import { PAGE_ROLES } from '@/config/permissions';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.billing;
const ALL_PAYMENT_STATUSES: (PaymentStatus | "All")[] = ["All", "Paid", "Unpaid", "Partially Paid", "Cancelled"];

export default function BillingOverviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "All">("All");

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
      setIsLoading(true);
      billsRepo.list()
        .then(setBills)
        .catch(error => {
          console.error("Error loading bills:", error);
          toast({ title: "Error", description: "Could not load billing data.", variant: "destructive" });
          setBills([]);
        })
        .finally(() => setIsLoading(false));
    } else {
        setBills([]);
        setIsLoading(false);
    }
  }, [toast, currentUser]);

  const filteredBills = useMemo(() => {
    let tempBills = [...bills];

    if (searchTerm) {
      tempBills = tempBills.filter(bill =>
        bill.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "All") {
      tempBills = tempBills.filter(bill => bill.paymentStatus === filterStatus);
    }

    return tempBills.sort((a, b) => {
        const dateA = isValid(parseISO(a.createdAt)) ? parseISO(a.createdAt) : new Date(0);
        const dateB = isValid(parseISO(b.createdAt)) ? parseISO(b.createdAt) : new Date(0);
        return dateB.getTime() - dateA.getTime();
    });
  }, [bills, searchTerm, filterStatus]);

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
      toast({ title: "No Data", description: "There is no billing data to download.", variant: "default" });
      return;
    }

    const headers = [
      "Bill ID", "Patient ID", "Patient Name", "Bill Date", "Bill Type",
      "Total Amount", "Payment Method", "Payment Status", "Payment Date",
      "Notes", "Created At"
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
      link.setAttribute('download', `billing_overview_${today}.csv`);
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
        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
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
        </CardContent>
      </Card>

      {bills.length === 0 && !isLoading ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Bills Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              There are no bills recorded yet. Click "Create New Bill" to start.
            </CardDescription>
            <img
              src="https://placehold.co/600x300.png"
              alt="No bills placeholder"
              data-ai-hint="empty finance document"
              className="mx-auto rounded-md mt-4 shadow-md"
            />
          </CardContent>
        </Card>
      ) : filteredBills.length === 0 && bills.length > 0 ? (
         <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Bills Match Criteria</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              No bills found matching your current search and filter settings.
            </CardDescription>
             <img
              src="https://placehold.co/600x300.png"
              alt="No matching bills placeholder"
              data-ai-hint="empty search results"
              className="mx-auto rounded-md mt-4 shadow-md"
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>All Bills</CardTitle>
            <CardDescription>List of all generated bills. Use filters above to narrow down results.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Bill Type</TableHead>
                  <TableHead className="hidden md:table-cell">Bill Date</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Payment Date</TableHead>
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
                    <TableCell>₹{bill.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
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
                    <TableCell className="text-right space-x-1 sm:space-x-2">
                      <Link href={`/billing/form?billId=${bill.id}`} passHref>
                        <Button variant="outline" size="sm" aria-label={`View or Edit ${bill.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {bill.paymentStatus === 'Unpaid' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:bg-destructive/10"
                          onClick={async () => {
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
