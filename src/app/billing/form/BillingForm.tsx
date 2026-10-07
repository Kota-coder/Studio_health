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
import { bills as billsRepo, patients as patientsRepo, testCatalog as testCatalogRepo, type BillFields } from '@/lib/data';
import { compressImageFile, captureVideoFrame } from '@/lib/images';
import { uploadIfNew, deleteImage } from '@/lib/storage';
import { StoredImage } from '@/components/stored-image';
import { Save, CreditCard, ArrowLeft, Pill, Stethoscope, FlaskConical, X, Trash2, PlusCircle, History, Camera as CameraIcon, UploadCloud, DollarSign } from 'lucide-react';
import { format, parse, isValid, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext'; // Ensure correct path
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "UPI", "Online/Card", "Arogyasree", "Insurance", "Other"];
const PAYMENT_STATUSES: PaymentStatus[] = ["Paid", "Unpaid", "Partially Paid", "Cancelled"];
const BILL_TYPES: { value: BillType; label: string; icon: React.ElementType }[] = [
  { value: "Pharmacy", label: "Pharmacy Bill", icon: Pill },
  { value: "Treatment", label: "Treatment/Consultation Bill", icon: Stethoscope },
  { value: "Test", label: "Medical Test Bill", icon: FlaskConical },
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
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
  const [notes, setNotes] = useState<string>("");
  const [currentBillId, setCurrentBillId] = useState<string | null>(null);
  const [formIsLoading, setFormIsLoading] = useState(true);
  const [currentBillAuditLog, setCurrentBillAuditLog] = useState<AuditLogEntry[]>([]);

  // Either the saved storage path or a new (compressed) data URL awaiting upload.
  const [billAttachmentPreview, setBillAttachmentPreview] = useState<string | null>(null);
  const [savedBill, setSavedBill] = useState<Bill | null>(null);
  const billAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [isCameraDialogOpenForBill, setIsCameraDialogOpenForBill] = useState(false);
  const dialogVideoRefBill = useRef<HTMLVideoElement>(null);
  const [hasDialogCameraPermissionBill, setHasDialogCameraPermissionBill] = useState(false);
  const [testCatalog, setTestCatalog] = useState<{ id: string; name: string; defaultPrice?: number; }[]>([]);

  // Load test catalog
  useEffect(() => {
    testCatalogRepo.list()
      .then(setTestCatalog)
      .catch(error => console.error("Error loading test catalog:", error));
  }, []);

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
    const load = async () => {
    try {
      setPatients(await patientsRepo.listBasic());
    } catch (error) {
      console.error("Error loading patients:", error);
      toast({ title: "Error", description: "Could not load patients.", variant: "destructive" });
    }

    if (patientIdFromQuery && !isEditMode) {
      const unpaddedPatientId = parseInt(patientIdFromQuery, 10).toString();
      setSelectedPatientId(unpaddedPatientId);
    }

    if (isEditMode && billIdToEdit) {
      let billToEdit: Bill | null = null;
      try {
        billToEdit = await billsRepo.get(billIdToEdit);
      } catch (error) {
        console.error("Error loading bill:", error);
      }
        if (billToEdit) {
          setCurrentBillId(billToEdit.id);
          setSavedBill(billToEdit);
          setBillType(billToEdit.billType || "Treatment");
          setIsBillTypeSelected(true);
          setSelectedPatientId(billToEdit.patientId.toString());
          setPaymentMethod(billToEdit.paymentMethod);
          setPaymentStatus(billToEdit.paymentStatus);
          setNotes(billToEdit.notes || "");
          setBillItems(billToEdit.items.map(item => ({
              ...item,
              id: item.id || Date.now().toString() + Math.random(),
              originalUnitPrice: item.originalUnitPrice !== undefined ? item.originalUnitPrice : item.unitPrice
            })));
          setCurrentBillAuditLog(billToEdit.auditLog || []);
          setBillAttachmentPreview(billToEdit.attachmentPath || null);


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
    } else {
        setIsBillTypeSelected(false);
        setCurrentBillAuditLog([]);
        setBillAttachmentPreview(null);
        setPaymentDate(null);
        setPaymentDateInput("");
    }
    setFormIsLoading(false);
    };
    load();
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


  const handleItemChange = (index: number, field: keyof Omit<BillItem, 'id' | 'total'>, value: string | number) => {
    const newItems = [...billItems];
    const item = { ...newItems[index] };

    if (field === 'quantity' || field === 'unitPrice' || field === 'originalUnitPrice') {
        const numValue = Number(value);
        (item as any)[field] = numValue < 0 ? 0 : numValue;
    } else if (field === 'description') {
        item[field] = value as string;
    }

    item.total = item.quantity * item.unitPrice;
    newItems[index] = item;
    setBillItems(newItems);
  };

  const addItem = () => {
    setBillItems([...billItems, {
        id: Date.now().toString(),
        description: "",
        quantity: billType === "Test" ? 1 : 1,
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

  const handleBillFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
        setBillAttachmentPreview(savedBill?.attachmentPath || null);
        return;
    }
    try {
        setBillAttachmentPreview(await compressImageFile(file));
    } catch (error) {
        console.error("Error reading attachment:", error);
        toast({ title: "Invalid Image", description: "Could not read this image file.", variant: "destructive" });
        if (event.target) event.target.value = "";
    }
  };

  const openCameraDialogForBill = async () => {
    try {
      setIsCameraDialogOpenForBill(true);
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        throw new Error("Camera API not available");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });

      if (dialogVideoRefBill.current) {
        dialogVideoRefBill.current.srcObject = stream;
      }
      setHasDialogCameraPermissionBill(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      setHasDialogCameraPermissionBill(false);
      toast({ 
        title: "Camera Error", 
        description: error instanceof Error && error.message === "Camera API not available" 
          ? "Camera not available on this device."
          : "Could not access camera. Please check permissions.", 
        variant: "destructive" 
      });
      setIsCameraDialogOpenForBill(false);
    }
  };

  const captureFromDialogCameraBill = () => {
    if (dialogVideoRefBill.current) {
        setBillAttachmentPreview(captureVideoFrame(dialogVideoRefBill.current));
        toast({ title: "Image Captured", description: "Image captured successfully." });

        // Stop camera stream
        if (dialogVideoRefBill.current.srcObject) {
            const stream = dialogVideoRefBill.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
        dialogVideoRefBill.current.srcObject = null;
        setIsCameraDialogOpenForBill(false);
    }
  };

  const clearBillAttachment = () => {
    setBillAttachmentPreview(null);
    if (billAttachmentInputRef.current) {
      billAttachmentInputRef.current.value = "";
    }
  };


  const handleSubmit = async () => {
    if (!currentUser || !["Admin", "Doctor", "Nurse", "Receptionist"].includes(currentUser.role)) {
      toast({ title: "Access Denied", description: "You don't have permission to create or modify bills.", variant: "destructive" });
      return;
    }
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

    const billData: BillFields = {
      patientId: parseInt(selectedPatientId, 10),
      patientName: `${patient.firstName} ${patient.lastName}`,
      billDate: finalBillDateString,
      billType: billType,
      items: billItems.map(({id, description, quantity, unitPrice, originalUnitPrice, total}) => ({
        id, description, quantity, unitPrice, originalUnitPrice, total
      })),
      totalAmount: calculateGrandTotal(),
      paymentMethod,
      paymentStatus,
      paymentDate: finalPaymentDateString,
      notes: notes.trim(),
      attachmentPath: savedBill?.attachmentPath ?? null,
    };

    try {
      billData.attachmentPath = await uploadIfNew(billAttachmentPreview, `patients/${billData.patientId}/bills`);

      if (isEditMode && currentBillId) {
        let auditDetails = `Bill ${currentBillId} details updated. Status: ${paymentStatus}.`;
        if (paymentStatus === "Paid" && savedBill?.paymentStatus !== "Paid") {
            auditDetails += ` Marked as Paid on ${finalPaymentDateString}.`;
        }
        await billsRepo.update(currentBillId, billData, { actionType: "Bill Updated", details: auditDetails });
        if (savedBill?.attachmentPath && savedBill.attachmentPath !== billData.attachmentPath) {
          await deleteImage(savedBill.attachmentPath);
        }
        toast({ title: "Success", description: `Bill ${currentBillId} updated.` });
      } else {
        let auditDetails = `Bill created with status ${paymentStatus}.`;
        if (paymentStatus === "Paid") {
            auditDetails += ` Marked as Paid on ${finalPaymentDateString}.`;
        }
        const newBill = await billsRepo.create(billData, auditDetails);
        toast({ title: "Success", description: `New bill ${newBill.id} created.` });
      }

      router.push('/billing');
    } catch (e: any) {
      console.error("Failed to save bill", e);
      toast({
          title: "Save Error",
          description: e?.message || "Could not save bill data. An unexpected error occurred.",
          variant: "destructive",
      });
    }
  };

  useEffect(() => { // Effect for managing camera stream in dialog
    let stream: MediaStream | null = null;
    const videoElem = dialogVideoRefBill.current;

    if (isCameraDialogOpenForBill && hasDialogCameraPermissionBill && videoElem) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => {
                stream = s;
                videoElem.srcObject = stream;
            })
            .catch((error) => {
          // Silently handle camera errors as they're not critical for the form
          if (error.name !== 'NotAllowedError' && error.name !== 'NotFoundError') {
            console.warn("Camera access denied or unavailable");
          }
        });
    }
    return () => { // Cleanup: stop camera stream when dialog closes or component unmounts
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (videoElem) {
            videoElem.srcObject = null;
        }
    };
  }, [isCameraDialogOpenForBill, hasDialogCameraPermissionBill, toast]); // Added toast to dependency array


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
          <CardTitle className="text-2xl flex items-center">
            <DollarSign className="mr-3 h-7 w-7 text-primary"/>
            {isEditMode ? `Edit Bill: ${currentBillId}` : (billType === "Pharmacy" ? "Create Pharmacy Bill" : billType === "Test" ? "Create Test Bill" : "Create Treatment Bill")}
          </CardTitle>
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
                     <div className="p-2 text-sm text-muted-foreground text-center">No patients found. <Link href="/" className="underline text-primary">Add a patient first</Link>.</div>
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
                    className="rounded-r-none"
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
             <CardTitle className="text-lg mb-3">{billType === "Pharmacy" ? "Pharmacy Items" : billType === "Test" ? "Medical Tests Performed" : "Services/Treatments Rendered"}</CardTitle>
            {billItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-end gap-2 mb-3 pb-3 border-b last:border-b-0 last:mb-0 last:pb-0">
                <div className="col-span-5 md:col-span-1">
                  <Label htmlFor={`itemDesc-${index}`}>Description *</Label>
                  {billType === "Test" ? (
                    <Select
                      value={item.description || ""}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          handleItemChange(index, 'description', "");
                          handleItemChange(index, 'unitPrice', 0);
                          handleItemChange(index, 'originalUnitPrice', 0);
                        } else {
                          handleItemChange(index, 'description', value);
                          const selectedTest = testCatalog.find(test => test.name === value);
                          if (selectedTest) {
                            handleItemChange(index, 'unitPrice', selectedTest.defaultPrice || 0);
                            handleItemChange(index, 'originalUnitPrice', selectedTest.defaultPrice || 0);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Test" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom Test Entry</SelectItem>
                        {testCatalog.map(test => (
                          <SelectItem key={test.id} value={test.name}>
                            {test.name} {test.defaultPrice ? `(₹${test.defaultPrice})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`itemDesc-${index}`}
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder={billType === "Pharmacy" ? "Medication Name" : "Service / Item Name"}
                    />
                  )}
                </div>
                                {billType !== "Test" && (
                  <div className="col-span-3 md:col-span-1">
                    <Label htmlFor={`itemQty-${index}`}>Quantity *</Label>
                    <Input
                      type="number"
                      id={`itemQty-${index}`}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      min="1"
                      placeholder="Quantity"
                    />
                  </div>
                )}
                <div className="col-span-3 md:col-span-1">
                  <Label htmlFor={`itemPrice-${index}`}>Unit Price *</Label>
                  <Input
                    type="number"
                    id={`itemPrice-${index}`}
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    min="0"
                    placeholder="Unit Price"
                  />
                </div>
                <div className="col-span-2 md:col-span-1 text-right font-semibold">
                  ₹{item.total.toFixed(2)}
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addItem}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select onValueChange={(value: string) => setPaymentMethod(value as PaymentMethod)} value={paymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="paymentStatus">Payment Status *</Label>
              <Select onValueChange={(value: PaymentStatus) => handlePaymentStatusChange(value)} value={paymentStatus}>
                <SelectTrigger id="paymentStatus">
                  <SelectValue placeholder="Select Payment Status" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentStatus === "Paid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paymentDate">Payment Date</Label>
                <div className="flex items-center">
                  <Input
                      type="text"
                      id="paymentDate"
                      placeholder="dd/MM/yyyy"
                      value={paymentDateInput}
                      onChange={handlePaymentDateInputChange}
                      className="rounded-r-none"
                  />
                  <Datepicker
                      selected={paymentDate}
                      onDateChange={handlePaymentDateChange}
                      triggerClassName="rounded-l-none border-l-0 w-auto p-2.5"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Additional notes for this bill" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="item-1">
              <AccordionTrigger><CameraIcon className="mr-2 h-4 w-4"/> Bill Attachment</AccordionTrigger>
              <AccordionContent>
                <div className="flex items-center space-x-4">
                  {billAttachmentPreview ? (
                    <div className="relative">
                      <StoredImage path={billAttachmentPreview} alt="Bill Attachment" className="max-w-[200px] max-h-[200px] rounded-md object-cover" />
                      <Button variant="ghost" size="icon" className="absolute top-0 right-0" onClick={clearBillAttachment}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No attachment added.</p>
                  )}
                  <div className="flex flex-col space-y-2">
                    <Button variant="outline" size="sm" onClick={() => billAttachmentInputRef.current?.click()}>
                      <UploadCloud className="mr-2 h-4 w-4" /> Upload File
                    </Button>
                    <Button variant="outline" size="sm" onClick={openCameraDialogForBill}>
                      <CameraIcon className="mr-2 h-4 w-4" /> Take Photo
                    </Button>
                    <Input
                      type="file"
                      accept="image/*"
                      ref={billAttachmentInputRef}
                      onChange={handleBillFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            {currentBillAuditLog.length > 0 && (
              <AccordionItem value="item-2">
                <AccordionTrigger><History className="mr-2 h-4 w-4"/> Bill History</AccordionTrigger>
                <AccordionContent>
                  <ul>
                    {currentBillAuditLog.map((log) => (
                      <li key={log.id} className="mb-2">
                        <p className="text-sm"><span className="font-semibold">{log.staffName}</span> - {log.actionType} on {format(parseISO(log.timestamp), 'dd/MM/yyyy hh:mm a')}</p>
                        {log.changeDetails && <p className="text-xs text-muted-foreground">{log.changeDetails}</p>}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.push('/billing')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isEditMode ? (<><Save className="mr-2 h-4 w-4" />Update Bill</>) : (<><CreditCard className="mr-2 h-4 w-4" />Create Bill</>)}
          </Button>
        </CardFooter>
      </Card>
      <Dialog open={isCameraDialogOpenForBill} onOpenChange={setIsCameraDialogOpenForBill}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Capture Bill Attachment</DialogTitle>
            <DialogDescription>
              Use your camera to capture a photo of the bill or receipt. Make sure the document is well-lit and clearly visible.
            </DialogDescription>
          </DialogHeader>
          {hasDialogCameraPermissionBill ? (
            <video ref={dialogVideoRefBill} autoPlay className="w-full aspect-video rounded-md"></video>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Camera Access Denied</AlertTitle>
              <AlertDescription>
                Please enable camera permissions to use this feature.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => {
              if (dialogVideoRefBill.current && dialogVideoRefBill.current.srcObject) {
                const stream = dialogVideoRefBill.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
              }
              setIsCameraDialogOpenForBill(false);
            }}><DialogClose>Cancel</DialogClose></Button>
            {hasDialogCameraPermissionBill && (
              <Button type="button" onClick={captureFromDialogCameraBill}>Capture</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}