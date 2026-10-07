
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Payment } from '@/types/payment';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Eye, Receipt, ArrowLeft, Download } from 'lucide-react';
import { format, parseISO, isValid, parse } from 'date-fns';
import { patients as patientsRepo, payments as paymentsRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PAGE_ROLES } from '@/config/permissions';
import type { Patient } from '@/types/patient';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.payments;

export default function PaymentsOverviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      Promise.all([paymentsRepo.list(), patientsRepo.listBasic()])
        .then(([paymentList, patientList]) => {
          setPayments(paymentList);
          setPatients(patientList);
        })
        .catch(error => {
          console.error("Error loading payments:", error);
          toast({ title: "Error", description: "Could not load payment data.", variant: "destructive" });
          setPayments([]);
          setPatients([]);
        })
        .finally(() => setIsLoading(false));
    } else if (currentUser && !ALLOWED_ROLES.includes(currentUser.role)) {
      setIsLoading(false);
    } else {
      setPayments([]);
      setIsLoading(false);
    }
  }, [toast, currentUser]);

  const formatDateSafe = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const isoParsed = parseISO(dateString);
      if (isValid(isoParsed)) return format(isoParsed, 'dd/MM/yyyy');
    } catch (e) {/* ignore */}
  
    try {
      const generalParsed = parse(dateString, 'dd/MM/yyyy', new Date());
      if (isValid(generalParsed)) return format(generalParsed, 'dd/MM/yyyy');
    } catch (e) {/* ignore */}
    
    return dateString;
  };

  const escapeCsvField = (field: any): string => {
    if (field === null || field === undefined) {
      return "";
    }
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  };

  const handleDownloadCSV = useCallback(() => {
    if (payments.length === 0) {
      toast({ title: "No Data", description: "There is no payment data to download.", variant: "default" });
      return;
    }

    const headers = [
      "Payment ID", "Payment Date", "Payment Type", "Payee Name", "Payee Type", 
      "Description", "Amount", "Payment Method", "Transaction ID", 
      "Notes", "Recorded By", "Created At"
    ];

    const csvRows = [headers.join(',')];

    payments.sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()).forEach(payment => {
      const row = [
        escapeCsvField(payment.id),
        escapeCsvField(formatDateSafe(payment.paymentDate)),
        escapeCsvField(payment.paymentType || 'N/A'),
        escapeCsvField(payment.payeeName || 'N/A'),
        escapeCsvField(payment.payeeType || 'N/A'),
        escapeCsvField(payment.description),
        escapeCsvField(payment.amount.toFixed(2)),
        escapeCsvField(payment.paymentMethod || 'N/A'),
        escapeCsvField(payment.transactionId || ''),
        escapeCsvField(payment.notes || ''),
        escapeCsvField(payment.recordedByStaffName || 'N/A'),
        escapeCsvField(formatDateSafe(payment.createdAt))
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
      link.setAttribute('download', `payments_overview_${today}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({title: "Success", description: "Payment data downloaded as CSV."});
    } else {
        toast({title: "Error", description: "CSV download not supported by your browser.", variant: "destructive"});
    }
  }, [payments, toast]);

  const getPatientNamesForPayment = (payment: Payment) => {
    if (payment.paymentType !== "Referral/CC" || !payment.associatedPatientIds || payment.associatedPatientIds.length === 0) {
      return '';
    }
    
    const patientNames = payment.associatedPatientIds.map(patientId => {
      const patient = patients.find(p => p.id === patientId);
      return patient ? `${patient.firstName} ${patient.lastName}` : `Patient ID: ${patientId}`;
    });
    
    return patientNames.join(', ');
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading payments...</p>
      </div>
    );
  }

  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Payments Overview</h1>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-end gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
            <Button variant="outline" onClick={handleDownloadCSV}>
                <Download className="mr-2 h-4 w-4" /> Download CSV
            </Button>
            <Link href="/payments/form" passHref>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Record New Payment
                </Button>
            </Link>
        </div>
      </header>

      {payments.length === 0 && !isLoading ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Payments Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              There are no payments recorded yet. Click "Record New Payment" to start.
            </CardDescription>
            <img
              src="https://placehold.co/600x300.png"
              data-ai-hint="empty ledger document"
              alt="No payments placeholder"
              className="mx-auto rounded-md mt-4 shadow-md"
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>All Recorded Payments</CardTitle>
            <CardDescription>List of all recorded outgoing payments.</CardDescription>
            {/* Static Header Row */}
            <div className="mt-2 flex w-full text-sm font-semibold text-muted-foreground border-b pb-2">
              <span className="w-[25%] sm:w-[20%] truncate">Payment ID</span>
              <span className="w-[40%] sm:w-[30%] truncate pl-2">Payee</span>
              <span className="hidden sm:inline w-[15%] truncate text-center">Date</span>
              <span className="w-[35%] sm:w-[20%] truncate text-right">Amount</span>
              <span className="hidden sm:inline w-[15%] truncate text-right">Type</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Accordion type="multiple" className="w-full">
                {payments.sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()).map((payment) => (
                  <AccordionItem value={payment.id} key={payment.id}>
                    <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center w-full text-sm">
                            <span className="w-[25%] sm:w-[20%] font-medium text-primary truncate">{payment.id}</span>
                            <span className="w-[40%] sm:w-[30%] truncate pl-2">{payment.payeeName || "N/A"}</span>
                            <span className="hidden sm:inline w-[15%] text-center">{formatDateSafe(payment.paymentDate)}</span>
                            <span className="w-[35%] sm:w-[20%] font-semibold text-right">₹{payment.amount.toFixed(2)}</span>
                            <span className="hidden sm:inline w-[15%] text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-right truncate">{payment.paymentType}</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Card className="p-4 bg-muted/50 shadow-inner">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                                <p><span className="font-medium">Payment ID:</span> {payment.id}</p>
                                <p><span className="font-medium">Payment Date:</span> {formatDateSafe(payment.paymentDate)}</p>
                                <p><span className="font-medium">Payment Type:</span> {payment.paymentType}</p>
                                <p><span className="font-medium">Payee:</span> {payment.payeeName || "N/A"} ({payment.payeeType || 'N/A'})</p>
                                <p className="md:col-span-2"><span className="font-medium">Description:</span> {payment.description}</p>
                                <p><span className="font-medium">Amount:</span> ₹{payment.amount.toFixed(2)}</p>
                                <p><span className="font-medium">Payment Method:</span> {payment.paymentMethod}</p>
                                {payment.transactionId && <p><span className="font-medium">Transaction ID:</span> {payment.transactionId}</p>}
                                {payment.notes && <p className="md:col-span-2"><span className="font-medium">Notes:</span> {payment.notes}</p>}
                                {payment.recordedByStaffName && <p><span className="font-medium">Recorded By:</span> {payment.recordedByStaffName}</p>}
                                <p><span className="font-medium">Recorded At:</span> {format(parseISO(payment.createdAt), "dd/MM/yyyy HH:mm")}</p>
                                {payment.associatedPatientIds && payment.associatedPatientIds.length > 0 && (
                                    <p className="md:col-span-2"><span className="font-medium">Associated Patients:</span> {getPatientNamesForPayment(payment) || payment.associatedPatientIds.join(', ')}</p>
                                )}
                            </div>
                            {payment.paymentType === "Pharmacy" && payment.purchasedMedications && payment.purchasedMedications.length > 0 && (
                                <div className="mt-3">
                                    <h4 className="text-sm font-semibold mb-1">Purchased Medications:</h4>
                                    <Table className="bg-background rounded-md text-xs">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs h-8">Medication</TableHead>
                                                <TableHead className="text-xs h-8 text-right">Qty</TableHead>
                                                <TableHead className="text-xs h-8 text-right">Unit Price Paid</TableHead>
                                                <TableHead className="text-xs h-8 text-right">List Price Ref.</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payment.purchasedMedications.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="text-xs py-1">{item.medicationName}</TableCell>
                                                    <TableCell className="text-xs py-1 text-right">{item.quantityPurchased}</TableCell>
                                                    <TableCell className="text-xs py-1 text-right">
                                                        {item.unitPriceAtPurchase !== undefined ? `₹${item.unitPriceAtPurchase.toFixed(2)}` : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-xs py-1 text-right">
                                                        {item.listPriceSnapshot !== undefined ? `₹${item.listPriceSnapshot.toFixed(2)}` : 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                            {payment.paymentType === "Material" && payment.purchasedMaterials && payment.purchasedMaterials.length > 0 && (
                                <div className="mt-3">
                                    <h4 className="text-sm font-semibold mb-1">Purchased Materials:</h4>
                                    <Table className="bg-background rounded-md text-xs">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs h-8">Material</TableHead>
                                                <TableHead className="text-xs h-8 text-right">Qty</TableHead>
                                                <TableHead className="text-xs h-8 text-right">Unit Price Paid</TableHead>
                                                <TableHead className="text-xs h-8 text-right">List Price Ref.</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {payment.purchasedMaterials.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="text-xs py-1">{item.materialName}</TableCell>
                                                    <TableCell className="text-xs py-1 text-right">{item.quantityPurchased}</TableCell>
                                                    <TableCell className="text-xs py-1 text-right">
                                                        {item.unitPriceAtPurchase !== undefined ? `₹${item.unitPriceAtPurchase.toFixed(2)}` : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-xs py-1 text-right">
                                                        {item.listPriceSnapshot !== undefined ? `₹${item.listPriceSnapshot.toFixed(2)}` : 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                             <div className="mt-4 text-right">
                                <Link href={`/payments/form?paymentId=${payment.id}`} passHref>
                                    <Button variant="outline" size="sm">
                                    <Eye className="mr-2 h-4 w-4" /> View/Edit Details
                                    </Button>
                                </Link>
                            </div>
                        </Card>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
