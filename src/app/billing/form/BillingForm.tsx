
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Datepicker from "@/components/ui/datepicker";
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import type { Patient } from '@/types/patient'; // Ensure correct path
import type { Bill, BillItem, PaymentMethod, PaymentStatus, BillType, AuditLogEntry } from '@/types/billing'; // Ensure correct path
import type { StaffMember } from '@/types/staff'; // Ensure correct path
import { ArrowLeft, Save, PlusCircle, Trash2, DollarSign, Printer, Pill, Stethoscope, History, Camera as CameraIcon, UploadCloud, X } from 'lucide-react';
import { format, parse, isValid, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext'; // Ensure correct path
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { compressImageFiles } from '@/lib/images';
import { uploadNewImages } from '@/lib/storage';
import { StoredImage } from '@/components/stored-image';
import { bills as billsRepo, inventory as inventoryRepo, medications as medicationsRepo, patients as patientsRepo, staff as staffRepo, type BillFields } from '@/lib/data';
import { useFeatures } from '@/hooks/use-features';
import { formatQty } from '@/lib/inventory';
import type { Medication } from '@/types/medication';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { methodChoices } from '@/types/paymentMethod';
import { ProcessedByField } from '@/components/processed-by-field';


const PAYMENT_STATUSES: PaymentStatus[] = ["Paid", "Unpaid", "Partially Paid", "Cancelled"];
const BILL_TYPES: { value: BillType; label: string; icon: React.ElementType }[] = [
  { value: "Pharmacy", label: "Pharmacy Bill", icon: Pill },
  { value: "Treatment", label: "Treatment/Consultation Bill", icon: Stethoscope },
];

// Helper function to add audit log entries for Bills

export default function BillingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const billIdToEdit = searchParams.get('billId');
  const patientIdFromQuery = searchParams.get('patientId');
  const isEditMode = Boolean(billIdToEdit);

  const [billType, setBillType] = useState<BillType>("");
  const [isBillTypeSelected, setIsBillTypeSelected] = useState(false);
  const { isOn } = useFeatures();
  // Pharmacy bills: the items the pharmacy sells, and their stock (Inventory).
  const [pharmacyItems, setPharmacyItems] = useState<Medication[]>([]);
  const [stockById, setStockById] = useState<Record<string, number>>({});

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [billDate, setBillDate] = useState<Date | null>(new Date());
  const [billDateInput, setBillDateInput] = useState<string>(format(new Date(), 'dd/MM/yyyy'));
  const [paymentDate, setPaymentDate] = useState<Date | null>(null);
  const [paymentDateInput, setPaymentDateInput] = useState<string>("");

  const [billItems, setBillItems] = useState<BillItem[]>([
    { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0, originalUnitPrice: 0, total: 0 }
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const methodOptions = usePaymentMethods();
  // Who processed the bill: the person creating it, unless the Super Admin picks someone else.
  const [processedById, setProcessedById] = useState<string>("");
  const [processedByName, setProcessedByName] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const canAssignProcessor = currentUser?.role === 'Super Admin';
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
  const [notes, setNotes] = useState<string>("");
  const [currentBillId, setCurrentBillId] = useState<string | null>(null);
  const [formIsLoading, setFormIsLoading] = useState(true);
  const [currentBillAuditLog, setCurrentBillAuditLog] = useState<AuditLogEntry[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [billAttachments, setBillAttachments] = useState<string[]>([]);
  const billAttachmentInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  useEffect(() => {
    if (!currentUser) {
        setFormIsLoading(false);
        return;
    }
    setFormIsLoading(true);
    let cancelled = false;
    const load = async () => {
    try {
    setPatients(await patientsRepo.listNames());
    if (canAssignProcessor) setStaffList(await staffRepo.list());
    if (!isEditMode && currentUser) {
      setProcessedById(String(currentUser.id));
      setProcessedByName(currentUser.name);
    }

    if (patientIdFromQuery && !isEditMode) {
      const unpaddedPatientId = parseInt(patientIdFromQuery, 10).toString();
      setSelectedPatientId(unpaddedPatientId);
    }

    if (isEditMode && billIdToEdit) {
      {
        const billToEdit = await billsRepo.get(billIdToEdit);
        if (cancelled) return;
        if (billToEdit) {
          setCurrentBillId(billToEdit.id);
          setBillType(billToEdit.billType || "Treatment");
          setIsBillTypeSelected(true);
          setSelectedPatientId(billToEdit.patientId.toString());
          setPaymentMethod(billToEdit.paymentMethod);
          setProcessedById(billToEdit.processedByStaffId ? String(billToEdit.processedByStaffId) : "");
          setProcessedByName(billToEdit.processedByStaffName ?? null);
          setPaymentStatus(billToEdit.paymentStatus);
          setNotes(billToEdit.notes || "");
          setBillItems(billToEdit.items.map(item => ({
              ...item,
              id: item.id || Date.now().toString() + Math.random(),
              originalUnitPrice: item.originalUnitPrice !== undefined ? item.originalUnitPrice : item.unitPrice
            })));
          setCurrentBillAuditLog(billToEdit.auditLog || []);
          setBillAttachments(billToEdit.attachments || []);


          try {
            let parsedDate = parseISO(billToEdit.billDate);
            if (!isValid(parsedDate)) {
                parsedDate = parse(billToEdit.billDate, 'dd/MM/yyyy', new Date());
            }
             if (isValid(parsedDate)) {
                setBillDate(parsedDate);
                setBillDateInput(format(parsedDate, 'dd/MM/yyyy'));
            } else {
                setBillDate(null);
                setBillDateInput(billToEdit.billDate);
                 toast({ title: "Warning", description: "Could not parse bill date correctly. Please verify.", variant:"default" });
            }
          } catch (e) {
             setBillDate(null);
             setBillDateInput(billToEdit.billDate);
             toast({ title: "Error", description: "Error parsing bill date.", variant:"destructive" });
          }
          
          if (billToEdit.paymentStatus === "Paid" && billToEdit.paymentDate) {
             try {
                let parsedPDate = parse(billToEdit.paymentDate, 'dd/MM/yyyy', new Date());
                if (isValid(parsedPDate)) {
                    setPaymentDate(parsedPDate);
                    setPaymentDateInput(format(parsedPDate, 'dd/MM/yyyy'));
                } else {
                    setPaymentDate(null);
                    setPaymentDateInput(billToEdit.paymentDate);
                }
             } catch (e) {
                setPaymentDate(null);
                setPaymentDateInput(billToEdit.paymentDate);
             }
          } else {
            setPaymentDate(null);
            setPaymentDateInput("");
          }

        } else {
          toast({ title: "Error", description: "Bill not found.", variant: "destructive" });
          router.push('/billing');
        }
      }
    } else {
        setIsBillTypeSelected(false);
        setCurrentBillAuditLog([]);
        setPaymentDate(null);
        setPaymentDateInput("");
    }
    } catch (error) {
      console.error("Error loading bill form data:", error);
      toast({ title: "Error", description: "Could not load bill details.", variant: "destructive" });
    } finally {
      if (!cancelled) setFormIsLoading(false);
    }
    };
    load();
    return () => { cancelled = true; };
  }, [isEditMode, billIdToEdit, patientIdFromQuery, router, toast, currentUser]);

  const handleBillTypeSelectionContinue = () => {
    if (!billType) {
        toast({ title: "Selection Required", description: "Please select a bill type to continue.", variant: "destructive" });
        return;
    }
    setIsBillTypeSelected(true);
  };

  const handleBillDateChange = (selectedDate: Date | undefined) => {
    setBillDate(selectedDate || null);
    if (selectedDate) {
      setBillDateInput(format(selectedDate, 'dd/MM/yyyy'));
    } else {
      setBillDateInput("");
    }
  };

  const handleBillDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBillDateInput(val);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        try {
            const parsedDate = parse(val, 'dd/MM/yyyy', new Date());
            if (isValid(parsedDate)) {
                setBillDate(parsedDate);
            } else {
                setBillDate(null);
            }
        } catch {
            setBillDate(null);
        }
    } else {
        setBillDate(null);
    }
  };
  
  const handlePaymentDateChange = (selectedDate: Date | undefined) => {
    setPaymentDate(selectedDate || null);
    if (selectedDate) {
      setPaymentDateInput(format(selectedDate, 'dd/MM/yyyy'));
    } else {
      setPaymentDateInput("");
    }
  };

  const handlePaymentDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPaymentDateInput(val);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        try {
            const parsedDate = parse(val, 'dd/MM/yyyy', new Date());
            if (isValid(parsedDate)) {
                setPaymentDate(parsedDate);
            } else {
                setPaymentDate(null);
            }
        } catch {
            setPaymentDate(null);
        }
    } else {
        setPaymentDate(null);
    }
  };
  
  const handlePaymentStatusChange = (status: PaymentStatus) => {
    setPaymentStatus(status);
    if (status === "Paid") {
      if (!paymentDate) { 
        const today = new Date();
        setPaymentDate(today);
        setPaymentDateInput(format(today, 'dd/MM/yyyy'));
      }
    } else {
      setPaymentDate(null);
      setPaymentDateInput("");
    }
  };


  useEffect(() => {
    if (billType !== 'Pharmacy' || !isOn('medications')) return;
    medicationsRepo.list().then(setPharmacyItems).catch(error => console.error('Could not load pharmacy items', error));
    if (isOn('inventory')) {
      inventoryRepo.summary()
        .then(list => setStockById(Object.fromEntries(list.filter(i => i.kind === 'pharmacy').map(i => [i.id, i.onHand]))))
        .catch(error => console.error('Could not load stock', error));
    }
  }, [billType, isOn]);

  const pharmacyItemNamed = (name: string) => {
    const key = name.trim().toLowerCase();
    return key ? pharmacyItems.find(m => m.name.trim().toLowerCase() === key) : undefined;
  };

  const handleItemChange = (index: number, field: keyof Omit<BillItem, 'originalUnitPrice' | 'id' | 'total'>, value: string | number) => {
    const newItems = [...billItems];
    const item = { ...newItems[index] };

    if (field === 'quantity' || field === 'unitPrice') {
        const numValue = Number(value);
        (item as any)[field] = numValue < 0 ? 0 : numValue;
    } else if (field === 'description') {
        item[field] = value as string;
        if (billType === 'Pharmacy') {
          // Picking a pharmacy item links it (for stock) and fills in its price.
          const match = pharmacyItemNamed(value as string);
          item.medicationId = match?.id;
          if (match && (!item.unitPrice || item.unitPrice === item.originalUnitPrice)) {
            item.unitPrice = match.listPrice;
            item.originalUnitPrice = match.listPrice;
          }
        }
    }

    item.total = item.quantity * item.unitPrice;
    newItems[index] = item;
    setBillItems(newItems);
  };

  const addItem = () => {
    setBillItems([...billItems, {
        id: Date.now().toString(),
        description: "",
        quantity: 1,
        originalUnitPrice: 0,
        unitPrice: 0,
        total: 0
    }]);
  };

  const removeItem = (index: number) => {
    if (billItems.length > 1) {
      const newItems = billItems.filter((_, i) => i !== index);
      setBillItems(newItems);
    } else {
        toast({title: "Info", description: "At least one service item is required.", variant: "default"});
    }
  };

  const calculateGrandTotal = useCallback(() => {
    return billItems.reduce((sum, item) => sum + item.total, 0);
  }, [billItems]);

  const handleBillFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        const fileArray = Array.from(files);
        const readers = compressImageFiles(fileArray);

        readers.then(results => {
            setBillAttachments(prev => [...prev, ...results]);
        });
    }
    if (event.target) event.target.value = "";
  };

  const removeBillAttachment = (index: number) => {
    setBillAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const clearBillAttachment = () => {
    setBillAttachments([]);
    if (billAttachmentInputRef.current) {
      billAttachmentInputRef.current.value = "";
    }
  };


  const handleSubmit = async () => {
    if (!currentUser) {
        toast({ title: "Auth Error", description: "User not logged in.", variant: "destructive" });
        return;
    }
    if (!isBillTypeSelected || !billType) {
        toast({ title: "Validation Error", description: "Bill Type must be selected.", variant: "destructive" }); return;
    }
    if (!selectedPatientId) { toast({ title: "Validation Error", description: "Please select a patient.", variant: "destructive" }); return; }

    let finalBillDateString = "";
    if (billDate) {
        finalBillDateString = format(billDate, 'dd/MM/yyyy');
    } else if (billDateInput) {
         try {
            const parsed = parse(billDateInput, 'dd/MM/yyyy', new Date());
            if(!isValid(parsed) || format(parsed, 'dd/MM/yyyy') !== billDateInput) {
                 toast({ title: "Validation Error", description: "Bill Date must be in dd/MM/yyyy format.", variant: "destructive" }); return;
            }
            finalBillDateString = billDateInput;
        } catch {
            toast({ title: "Validation Error", description: "Bill Date must be in dd/MM/yyyy format.", variant: "destructive" }); return;
        }
    } else {
        toast({ title: "Validation Error", description: "Bill Date is required.", variant: "destructive" }); return;
    }

    if (billItems.some(item => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0)) {
      toast({ title: "Validation Error", description: "All service items must have a description, positive quantity, and non-negative unit price.", variant: "destructive" });
      return;
    }
    if (!paymentMethod) { toast({ title: "Validation Error", description: "Payment Method is required.", variant: "destructive" }); return; }
    if (!paymentStatus) { toast({ title: "Validation Error", description: "Payment Status is required.", variant: "destructive" }); return; }

    let finalPaymentDateString: string | undefined = undefined;
    if (paymentStatus === "Paid") {
        if (paymentDate) {
            finalPaymentDateString = format(paymentDate, 'dd/MM/yyyy');
        } else if (paymentDateInput) {
            try {
                const parsed = parse(paymentDateInput, 'dd/MM/yyyy', new Date());
                if(!isValid(parsed) || format(parsed, 'dd/MM/yyyy') !== paymentDateInput) {
                    toast({ title: "Validation Error", description: "Payment Date must be in dd/MM/yyyy format if status is Paid.", variant: "destructive" }); return;
                }
                finalPaymentDateString = paymentDateInput;
            } catch {
                toast({ title: "Validation Error", description: "Payment Date must be in dd/MM/yyyy format if status is Paid.", variant: "destructive" }); return;
            }
        } else {
            finalPaymentDateString = format(new Date(), 'dd/MM/yyyy');
        }
    }


    const patient = patients.find(p => p.id.toString() === selectedPatientId);
    if (!patient) {
        toast({ title: "Error", description: "Selected patient not found. Please ensure the patient is correctly selected.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
      const billData: BillFields = {
        patientId: parseInt(selectedPatientId, 10),
        patientName: `${patient.firstName} ${patient.lastName}`,
        billDate: finalBillDateString,
        billType: billType,
        items: billItems.map(({id, description, quantity, unitPrice, originalUnitPrice, total, medicationId}) => ({
          id, description, quantity, unitPrice, originalUnitPrice, total,
          ...(billType === 'Pharmacy' && medicationId ? { medicationId } : {}),
        })),
        totalAmount: calculateGrandTotal(),
        paymentMethod,
        paymentStatus,
        paymentDate: finalPaymentDateString,
        notes: notes.trim(),
        attachments: await uploadNewImages(billAttachments, `patients/${selectedPatientId}/bills`),
        processedByStaffId: processedById ? Number(processedById) : null,
      };

      if (isEditMode && currentBillId) {
        const previousStatus = (await billsRepo.get(currentBillId))?.paymentStatus;
        let auditDetails = `Bill ${currentBillId} details updated. Status: ${paymentStatus}.`;
        if (paymentStatus === "Paid" && previousStatus !== "Paid") {
          auditDetails += ` Marked as Paid on ${finalPaymentDateString}.`;
        }
        await billsRepo.update(currentBillId, billData, { actionType: "Bill Updated", details: auditDetails });
        toast({ title: "Success", description: `Bill ${currentBillId} updated.` });
        // Just paid: straight to the receipt, ready to print.
        router.push(paymentStatus === "Paid" && previousStatus !== "Paid" ? `/billing/print?billId=${currentBillId}` : '/billing');
      } else {
        const newBill = await billsRepo.create(billData, `Bill created with status ${paymentStatus}.${paymentStatus === "Paid" ? ` Marked as Paid on ${finalPaymentDateString}.` : ''}`);
        toast({ title: "Success", description: `New bill ${newBill.id} created.` });
        router.push(paymentStatus === "Paid" ? `/billing/print?billId=${newBill.id}` : '/billing');
      }
    } catch (e) {
      console.error("Failed to save bill", e);
      toast({
        title: "Save Error",
        description: e instanceof Error ? e.message : "Could not save bill data.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authIsLoading || formIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading form...</p></div>;
  }

  if (!currentUser) {
    return <div className="flex justify-center items-center min-h-screen"><p>Redirecting to login...</p></div>;
  }

  if (!isEditMode && !isBillTypeSelected) {
    return (
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
        <Card className="w-full max-w-md mt-10 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><DollarSign className="mr-3 h-7 w-7 text-primary"/>Select Bill Type</CardTitle>
            <CardDescription>Choose the type of bill you want to create.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={billType} onValueChange={(value: BillType) => setBillType(value)}>
              {BILL_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <Label
                    key={type.value}
                    htmlFor={`billType-${type.value}`}
                    className="flex items-center space-x-3 p-4 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary"
                  >
                    <RadioGroupItem value={type.value} id={`billType-${type.value}`} className="h-5 w-5" />
                    <Icon className="h-6 w-6 text-primary" />
                    <span className="font-medium">{type.label}</span>
                  </Label>
                );
              })}
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => router.push('/billing')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleBillTypeSelectionContinue} disabled={!billType}>Continue</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-2xl mt-6 shadow-xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-2xl flex items-center">
              <DollarSign className="mr-3 h-7 w-7 text-primary"/>
              {isEditMode ? `Edit Bill: ${currentBillId}` : (billType === "Pharmacy" ? "Create Pharmacy Bill" : "Create Treatment Bill")}
            </CardTitle>
            {isEditMode && currentBillId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/billing/print?billId=${currentBillId}`}><Printer className="mr-2 h-4 w-4" /> {paymentStatus === 'Paid' ? 'Print Receipt' : 'Print Bill'}</Link>
              </Button>
            )}
          </div>
          <CardDescription>
            {isEditMode ? "Update the details for this bill." : "Fill in the details to generate a new bill."}
            {billType && !isEditMode && <span className="block text-sm text-muted-foreground mt-1">Selected Bill Type: {billType}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="patient">Patient *</Label>
              <Select
                onValueChange={setSelectedPatientId}
                value={selectedPatientId}
                disabled={isEditMode || Boolean(patientIdFromQuery)}
              >
                <SelectTrigger id="patient">
                  <SelectValue placeholder="Select Patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.length > 0 ? (
                    patients.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.firstName} {p.lastName} (ID: {p.id.toString().padStart(3,'0')})
                      </SelectItem>
                    ))
                  ) : (
                     <div className="p-2 text-sm text-muted-foreground text-center">No patients found. <Link href="/patients/new" className="underline text-primary">Add a patient first</Link>.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="billDate">Bill Date *</Label>
              <div className="flex items-center">
                <Input
                    type="text"
                    id="billDate"
                    placeholder="dd/MM/yyyy"
                    value={billDateInput}
                    onChange={handleBillDateInputChange}
                    className="rounded-r-none min-w-0"
                    required
                />
                <Datepicker
                    selected={billDate}
                    onDateChange={handleBillDateChange}
                    triggerClassName="rounded-l-none border-l-0 w-auto p-2.5"
                />
              </div>
            </div>
          </div>

          <Card className="p-4 bg-muted/50">
             <CardTitle className="text-lg mb-3">{billType === "Pharmacy" ? "Pharmacy Items" : "Services/Treatments Rendered"}</CardTitle>
             {billType === "Pharmacy" && (
               <datalist id="pharmacyItemNames">
                 {pharmacyItems.map(m => <option key={m.id} value={m.name}>{`₹${Number(m.listPrice).toFixed(2)}${m.unitOfMeasure ? ` / ${m.unitOfMeasure}` : ''}`}</option>)}
               </datalist>
             )}
            {billItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[1fr_1fr_1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] items-end gap-2 mb-3 pb-3 border-b last:border-b-0 last:mb-0 last:pb-0">
                <div className="col-span-4 sm:col-span-1">
                  <Label htmlFor={`itemDesc-${index}`}>Description *</Label>
                  <Input
                    id={`itemDesc-${index}`}
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    placeholder={billType === "Pharmacy" ? "Start typing a pharmacy item" : "Service / Item Name"}
                    list={billType === "Pharmacy" && pharmacyItems.length > 0 ? 'pharmacyItemNames' : undefined}
                    autoComplete="off"
                  />
                  {billType === "Pharmacy" && item.description.trim() !== '' && pharmacyItems.length > 0 && (() => {
                    const linked = item.medicationId ? pharmacyItems.find(m => m.id === item.medicationId) : pharmacyItemNamed(item.description);
                    if (!linked) return <p className="mt-1 text-xs text-muted-foreground">Not a pharmacy item, so stock won&apos;t change.</p>;
                    const onHand = stockById[linked.id];
                    if (onHand === undefined) return null;
                    const short = onHand - item.quantity < 0;
                    return (
                      <p className={`mt-1 text-xs ${short ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                        In stock: {formatQty(onHand)}{linked.unitOfMeasure ? ` ${linked.unitOfMeasure}` : ''}{short ? ' (not enough)' : ''}
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <Label htmlFor={`itemQty-${index}`}>Qty *</Label>
                  <Input
                    id={`itemQty-${index}`}
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className="w-full sm:w-16 px-2 text-center"
                    min="1"
                  />
                </div>
                <div>
                    <Label htmlFor={`itemPrice-${index}`} className="block">
                        Unit Price *
                        {(billType === "Pharmacy" && typeof item.originalUnitPrice === 'number' && item.originalUnitPrice > 0) && (
                        <span className="text-xs text-muted-foreground ml-1">
                            {item.originalUnitPrice !== item.unitPrice
                            ? `(₹${item.originalUnitPrice.toFixed(2)})`
                            : `(Original)`
                            }
                        </span>
                        )}
                    </Label>
                  <Input
                    id={`itemPrice-${index}`}
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    className="w-full sm:w-32 px-2 text-right"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="text-right">
                  <Label>Amount</Label>
                  <Input value={`₹${item.total.toFixed(2)}`} readOnly className="w-full sm:w-28 px-2 text-right bg-muted" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="text-destructive hover:bg-destructive/10 self-end mb-1" title="Remove Item">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addItem} className="mt-2 w-full md:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add {billType === "Pharmacy" ? "Medication Item" : "Service Item"}
            </Button>
          </Card>

          <div className="text-right mt-2">
            <Label className="text-lg font-semibold">Grand Total:</Label>
            <span className="text-xl font-bold ml-2">₹{calculateGrandTotal().toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select onValueChange={(value) => setPaymentMethod(value as PaymentMethod)} value={paymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  {methodChoices(methodOptions, 'Bills', paymentMethod).map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="paymentStatus">Payment Status *</Label>
              <Select onValueChange={(value) => handlePaymentStatusChange(value as PaymentStatus)} value={paymentStatus}>
                <SelectTrigger id="paymentStatus">
                  <SelectValue placeholder="Select Payment Status" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ProcessedByField id="processedBy" value={processedById} onChange={setProcessedById}
              staff={staffList} canAssign={canAssignProcessor} displayName={processedByName ?? (isEditMode ? null : currentUser?.name)} />
          </div>

          {paymentStatus === "Paid" && (
            <div>
              <Label htmlFor="paymentDate">Payment Date *</Label>
               <div className="flex items-center">
                <Input
                    type="text"
                    id="paymentDate"
                    placeholder="dd/MM/yyyy"
                    value={paymentDateInput}
                    onChange={handlePaymentDateInputChange}
                    className="rounded-r-none"
                    required
                />
                <Datepicker
                    selected={paymentDate}
                    onDateChange={handlePaymentDateChange}
                    triggerClassName="rounded-l-none border-l-0 w-auto p-2.5"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes / Remarks</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes for this bill..." />
          </div>

           <div>
            <Label htmlFor="billAttachment">Attachments (Optional, images are resized automatically)</Label>
            <div className="flex items-center gap-3 mt-1">
                <input 
                    type="file" 
                    accept="image/*"
                    multiple
                    onChange={handleBillFileUpload} 
                    ref={billAttachmentInputRef} 
                    className="hidden"
                />
                <Button type="button" variant="outline" onClick={() => billAttachmentInputRef.current?.click()} className="flex-1">
                    <UploadCloud className="mr-2 h-4 w-4"/> {billAttachments.length > 0 ? `Add More (${billAttachments.length})` : "Upload Files"}
                </Button>
                {billAttachments.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearBillAttachment} className="text-xs text-destructive">
                        Clear All
                    </Button>
                )}
            </div>

            {billAttachments.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                    {billAttachments.map((attachment, index) => (
                        <div key={index} className="relative border rounded-md p-1">
                            <StoredImage path={attachment} alt={`Bill Attachment ${index + 1}`} className="rounded-md w-full h-20 object-cover" />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                                onClick={() => removeBillAttachment(index)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
          </div>


          {isEditMode && currentBillAuditLog.length > 0 && (
            <Accordion type="single" collapsible className="w-full mt-4">
                <AccordionItem value="bill-audit-log">
                    <AccordionTrigger className="text-sm hover:no-underline flex items-center">
                        <History className="mr-2 h-4 w-4 text-muted-foreground"/> Bill History / Audit Log ({currentBillAuditLog.length})
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {currentBillAuditLog.sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()).map((log) => (
                                <Card key={log.id} className="bg-muted/30 p-3 text-sm shadow-sm">
                                    <p className="text-xs text-muted-foreground mb-1">
                                    {format(parseISO(log.timestamp), "dd/MM/yyyy, HH:mm:ss")}
                                    {log.staffName && (
                                        <>
                                        {' by '}
                                        <span className="font-semibold text-foreground">{log.staffName}</span>
                                        </>
                                    )}
                                    </p>
                                    <p><span className="font-medium">{log.actionType}:</span> {log.changeDetails}</p>
                                </Card>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          )}


        </CardContent>
        <CardFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => router.push('/billing')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Save Bill"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
