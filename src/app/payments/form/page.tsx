
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Datepicker from "@/components/ui/datepicker";
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Payment, PaymentType, PaymentMethodSpent, PurchasedMedicationItem, PurchasedMaterialItem } from '@/types/payment';
import { ReferringDoctor } from '@/types/referringDoctor';
import { StaffMember } from '@/types/staff';
import type { StaffRole as AppStaffRole } from '@/types/staff';
import { AuditLogEntry, Patient } from '@/types/patient'; 
import { Medication } from '@/types/medication';
import { Vendor } from '@/types/vendor';
import { Material } from '@/types/material'; // Import Material type
import { ArrowLeft, Save, Receipt, UserPlus, Briefcase, List, PlusCircle, Trash2, Truck, Pill as PillIcon, Archive } from 'lucide-react';
import { format, parse, isValid, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { addAuditLogEntry } from '@/lib/audit';


const ALLOWED_ROLES: AppStaffRole[] = ["Admin"];
const PAYMENTS_STORAGE_KEY = 'paymentsData';
const NEXT_PAYMENT_ID_KEY = 'nextPaymentIdNumber';
const REFERRING_DOCTORS_STORAGE_KEY = 'referringDoctorsData';
const STAFF_MEMBERS_STORAGE_KEY = 'staffMembers';
const PATIENTS_STORAGE_KEY = 'patients'; 
const MEDICATIONS_STORAGE_KEY = 'medicationsData';
const VENDORS_STORAGE_KEY = 'materialVendorsData';
const MATERIALS_STORAGE_KEY = 'materialsData'; // Key for materials catalog


const PAYMENT_TYPES: PaymentType[] = ["Referral/CC", "Material", "Pharmacy", "Salary", "Other"];
const PAYMENT_METHODS_SPENT: PaymentMethodSpent[] = ["Cash", "Cheque", "Bank Transfer", "UPI", "Card", "Other"];



export default function PaymentFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const paymentIdToEdit = searchParams.get('paymentId');
  const isEditMode = Boolean(paymentIdToEdit);

  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [paymentDateInput, setPaymentDateInput] = useState<string>(format(new Date(), 'dd/MM/yyyy'));
  const [paymentType, setPaymentType] = useState<PaymentType>("");
  
  const [payeeId, setPayeeId] = useState<string>(""); 
  const [payeeNameInput, setPayeeNameInput] = useState<string>(""); 
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");


  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodSpent>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  
  const [referringDoctorsList, setReferringDoctorsList] = useState<ReferringDoctor[]>([]);
  const [staffMembersList, setStaffMembersList] = useState<StaffMember[]>([]);
  const [availableVendors, setAvailableVendors] = useState<Vendor[]>([]);
  const [referredPatientsList, setReferredPatientsList] = useState<Patient[]>([]);
  const [selectedPatientIdsForPayment, setSelectedPatientIdsForPayment] = useState<number[]>([]);

  const [availableMedications, setAvailableMedications] = useState<Medication[]>([]);
  const [currentPurchasedMedications, setCurrentPurchasedMedications] = useState<PurchasedMedicationItem[]>([]);
  
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]); // State for materials catalog
  const [currentPurchasedMaterials, setCurrentPurchasedMaterials] = useState<PurchasedMaterialItem[]>([]); // State for materials in current payment

  const [currentPaymentAuditLog, setCurrentPaymentAuditLog] = useState<AuditLogEntry[]>([]);
  const [formIsLoading, setFormIsLoading] = useState(true);
  const [currentPaymentIdState, setCurrentPaymentIdState] = useState<string | null>(null);


  useEffect(() => {
    if (!authIsLoading && currentUser && !ALLOWED_ROLES.includes(currentUser.role)) {
      toast({ title: "Access Denied", description: "You do not have permission to access this page.", variant: "destructive" });
      router.replace('/dashboard');
    } else if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router, toast]);

  useEffect(() => {
    if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role) && !authIsLoading)) {
        setFormIsLoading(false);
        return;
    }
    setFormIsLoading(true);
    try {
      const storedRefDoctors = localStorage.getItem(REFERRING_DOCTORS_STORAGE_KEY);
      if (storedRefDoctors) setReferringDoctorsList(JSON.parse(storedRefDoctors));
      
      const storedStaff = localStorage.getItem(STAFF_MEMBERS_STORAGE_KEY);
      if (storedStaff) setStaffMembersList(JSON.parse(storedStaff));

      const storedMedications = localStorage.getItem(MEDICATIONS_STORAGE_KEY);
      if (storedMedications) setAvailableMedications(JSON.parse(storedMedications));

      const storedMaterials = localStorage.getItem(MATERIALS_STORAGE_KEY); // Load materials catalog
      if (storedMaterials) setAvailableMaterials(JSON.parse(storedMaterials));

      const storedVendors = localStorage.getItem(VENDORS_STORAGE_KEY);
      if (storedVendors) setAvailableVendors(JSON.parse(storedVendors));

    } catch (e) {
      console.error("Error loading payee/medication/material lists:", e);
      toast({ title: "Error", description: "Could not load related data lists.", variant: "destructive" });
    }

    if (isEditMode && paymentIdToEdit) {
      const storedPayments = localStorage.getItem(PAYMENTS_STORAGE_KEY);
      if (storedPayments) {
        const payments: Payment[] = JSON.parse(storedPayments).map((p: any) => ({
            ...p, 
            auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
            associatedPatientIds: Array.isArray(p.associatedPatientIds) ? p.associatedPatientIds : [],
            purchasedMedications: Array.isArray(p.purchasedMedications) ? p.purchasedMedications : [],
            purchasedMaterials: Array.isArray(p.purchasedMaterials) ? p.purchasedMaterials : [], // Load purchased materials
        }));
        const paymentToEdit = payments.find(p => p.id === paymentIdToEdit);
        if (paymentToEdit) {
          setCurrentPaymentIdState(paymentToEdit.id);
          try {
            let parsedDate = parse(paymentToEdit.paymentDate, 'dd/MM/yyyy', new Date());
            if (isValid(parsedDate)) {
                setPaymentDate(parsedDate);
                setPaymentDateInput(format(parsedDate, 'dd/MM/yyyy'));
            } else { setPaymentDateInput(paymentToEdit.paymentDate); }
          } catch (e) { setPaymentDateInput(paymentToEdit.paymentDate); }
          
          setPaymentType(paymentToEdit.paymentType);
          setDescription(paymentToEdit.description);
          setAmount(String(paymentToEdit.amount));
          setPaymentMethod(paymentToEdit.paymentMethod);
          setTransactionId(paymentToEdit.transactionId || "");
          setNotes(paymentToEdit.notes || "");
          setCurrentPurchasedMedications(paymentToEdit.purchasedMedications || []);
          setCurrentPurchasedMaterials(paymentToEdit.purchasedMaterials || []); // Set purchased materials
          setCurrentPaymentAuditLog(paymentToEdit.auditLog || []);
          setSelectedPatientIdsForPayment(paymentToEdit.associatedPatientIds || []);


          if (paymentToEdit.payeeType === "ReferringDoctor" || paymentToEdit.payeeType === "StaffMember") {
            setPayeeId(String(paymentToEdit.payeeId) || "");
             if(paymentToEdit.payeeType === "ReferringDoctor" && paymentToEdit.payeeId){
                fetchReferredPatients(String(paymentToEdit.payeeId));
            }
          } else if (paymentToEdit.payeeType === "Vendor" && paymentToEdit.payeeId){
            setSelectedVendorId(String(paymentToEdit.payeeId));
          } else if (paymentToEdit.payeeName) { // For "Other" type
            setPayeeNameInput(paymentToEdit.payeeName);
          }


        } else {
          toast({ title: "Error", description: "Payment record not found.", variant: "destructive" });
          router.push('/payments');
        }
      }
    } else {
        setCurrentPaymentAuditLog([]);
        setSelectedPatientIdsForPayment([]);
        setCurrentPurchasedMedications([]);
        setCurrentPurchasedMaterials([]); // Reset purchased materials for new form
    }
    setFormIsLoading(false);
  }, [isEditMode, paymentIdToEdit, router, toast, currentUser, authIsLoading]);


  const fetchReferredPatients = (doctorId: string) => {
    const storedPatients = localStorage.getItem(PATIENTS_STORAGE_KEY);
    if (storedPatients) {
      const allPatients: Patient[] = JSON.parse(storedPatients).map((p: any) => ({
        ...p,
        id: parseInt(p.id, 10), 
        careNotes: Array.isArray(p.careNotes) ? p.careNotes : [],
        assignedStaffIds: Array.isArray(p.assignedStaffIds) ? p.assignedStaffIds : [],
        tests: Array.isArray(p.tests) ? p.tests : [],
        auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
      }));
      const numericDoctorId = parseInt(doctorId, 10);
      const filtered = allPatients.filter(patient => patient.referredDoctorId === numericDoctorId);
      setReferredPatientsList(filtered);
    } else {
      setReferredPatientsList([]);
    }
  };

  useEffect(() => {
    if (paymentType === "Referral/CC" && payeeId) {
      fetchReferredPatients(payeeId);
    } else {
      setReferredPatientsList([]);
      if (paymentType !== "Referral/CC") { 
          setSelectedPatientIdsForPayment([]);
      }
    }
  }, [paymentType, payeeId]);

  useEffect(() => {
    if (paymentType === "Pharmacy" && currentPurchasedMedications.length > 0) {
      const total = currentPurchasedMedications.reduce((sum, item) => {
        const priceToUse = item.unitPriceAtPurchase ?? item.listPriceSnapshot ?? 0;
        return sum + (item.quantityPurchased * priceToUse);
      }, 0);
      setAmount(total.toFixed(2));
    } else if (paymentType === "Material" && currentPurchasedMaterials.length > 0) {
      const total = currentPurchasedMaterials.reduce((sum, item) => {
        const priceToUse = item.unitPriceAtPurchase ?? item.listPriceSnapshot ?? 0;
        return sum + (item.quantityPurchased * priceToUse);
      }, 0);
      setAmount(total.toFixed(2));
    }
  }, [currentPurchasedMedications, currentPurchasedMaterials, paymentType]);


  const handleDateChange = (selectedDate: Date | undefined) => {
    setPaymentDate(selectedDate || null);
    if (selectedDate) {
      setPaymentDateInput(format(selectedDate, 'dd/MM/yyyy'));
    } else {
      setPaymentDateInput("");
    }
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPaymentDateInput(val);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        try {
            const parsedDate = parse(val, 'dd/MM/yyyy', new Date());
            if (isValid(parsedDate)) setPaymentDate(parsedDate);
            else setPaymentDate(null);
        } catch { setPaymentDate(null); }
    } else {
        setPaymentDate(null);
    }
  };
  
  const handlePaymentTypeChange = (type: PaymentType) => {
    setPaymentType(type);
    setPayeeId("");
    setPayeeNameInput("");
    setSelectedVendorId("");
    setReferredPatientsList([]); 
    setSelectedPatientIdsForPayment([]);
    if (type !== "Pharmacy") {
        setCurrentPurchasedMedications([]);
    }
    if (type !== "Material") {
        setCurrentPurchasedMaterials([]);
    }
  };

  const handlePatientSelectionForPayment = (patientId: number, checked: boolean | string) => {
    setSelectedPatientIdsForPayment(prevSelectedIds => {
        if (checked) {
            return [...prevSelectedIds, patientId];
        } else {
            return prevSelectedIds.filter(id => id !== patientId);
        }
    });
  };

  const handleAddPurchasedMedicationItem = () => {
    setCurrentPurchasedMedications([
      ...currentPurchasedMedications,
      { medicationId: "", medicationName: "", quantityPurchased: 1, listPriceSnapshot: 0, unitPriceAtPurchase: undefined }
    ]);
  };

  const handlePurchasedMedicationChange = (index: number, field: keyof PurchasedMedicationItem, value: string | number) => {
    const newItems = [...currentPurchasedMedications];
    const item = { ...newItems[index] };

    if (field === 'medicationId') {
      const selectedMed = availableMedications.find(m => m.id === value);
      item.medicationId = value as string;
      item.medicationName = selectedMed?.name || "";
      item.listPriceSnapshot = selectedMed?.listPrice;
      item.unitPriceAtPurchase = selectedMed?.listPrice;
    } else if (field === 'quantityPurchased') {
      item.quantityPurchased = Number(value) < 0 ? 0 : Number(value);
    } else if (field === 'unitPriceAtPurchase') {
      item.unitPriceAtPurchase = Number.isNaN(parseFloat(String(value))) ? undefined : parseFloat(String(value)) < 0 ? 0 : parseFloat(String(value));
    } else {
      (item as any)[field] = value;
    }
    newItems[index] = item;
    setCurrentPurchasedMedications(newItems);
  };

  const handleRemovePurchasedMedicationItem = (index: number) => {
    setCurrentPurchasedMedications(currentPurchasedMedications.filter((_, i) => i !== index));
  };

  const handleAddPurchasedMaterialItem = () => {
    setCurrentPurchasedMaterials([
      ...currentPurchasedMaterials,
      { materialId: "", materialName: "", quantityPurchased: 1, listPriceSnapshot: 0, unitPriceAtPurchase: undefined }
    ]);
  };

  const handlePurchasedMaterialChange = (index: number, field: keyof PurchasedMaterialItem, value: string | number) => {
    const newItems = [...currentPurchasedMaterials];
    const item = { ...newItems[index] };

    if (field === 'materialId') {
      const selectedMat = availableMaterials.find(m => m.id === value);
      item.materialId = value as string;
      item.materialName = selectedMat?.name || "";
      item.listPriceSnapshot = selectedMat?.listPrice;
      item.unitPriceAtPurchase = selectedMat?.listPrice;
    } else if (field === 'quantityPurchased') {
      item.quantityPurchased = Number(value) < 0 ? 0 : Number(value);
    } else if (field === 'unitPriceAtPurchase') {
      item.unitPriceAtPurchase = Number.isNaN(parseFloat(String(value))) ? undefined : parseFloat(String(value)) < 0 ? 0 : parseFloat(String(value));
    } else {
      (item as any)[field] = value;
    }
    newItems[index] = item;
    setCurrentPurchasedMaterials(newItems);
  };

  const handleRemovePurchasedMaterialItem = (index: number) => {
    setCurrentPurchasedMaterials(currentPurchasedMaterials.filter((_, i) => i !== index));
  };


  const handleSubmit = async () => {
    if (!currentUser) {
        toast({ title: "Auth Error", description: "User not logged in.", variant: "destructive" });
        return;
    }
    
    let finalPaymentDateString = "";
    if (paymentDate) finalPaymentDateString = format(paymentDate, 'dd/MM/yyyy');
    else if (paymentDateInput) {
        try {
            const parsed = parse(paymentDateInput, 'dd/MM/yyyy', new Date());
            if(!isValid(parsed) || format(parsed, 'dd/MM/yyyy') !== paymentDateInput) {
                 toast({ title: "Validation Error", description: "Payment Date must be in dd/MM/yyyy format.", variant: "destructive" }); return;
            }
            finalPaymentDateString = paymentDateInput;
        } catch { toast({ title: "Validation Error", description: "Payment Date must be in dd/MM/yyyy format.", variant: "destructive" }); return; }
    } else { toast({ title: "Validation Error", description: "Payment Date is required.", variant: "destructive" }); return; }

    if (!paymentType) { toast({ title: "Validation Error", description: "Payment Type is required.", variant: "destructive" }); return; }
    if (!description.trim()) { toast({ title: "Validation Error", description: "Description is required.", variant: "destructive" }); return; }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast({ title: "Validation Error", description: "Amount must be a positive number.", variant: "destructive" }); return; }
    
    if (!paymentMethod) { toast({ title: "Validation Error", description: "Payment Method is required.", variant: "destructive" }); return; }

    if (paymentType === "Pharmacy") {
        if (currentPurchasedMedications.some(item => !item.medicationId || item.quantityPurchased <= 0)) {
            toast({ title: "Validation Error", description: "For Pharmacy payments, all medication items must have a selected medication and positive quantity.", variant: "destructive"});
            return;
        }
        const pharmacyTotal = currentPurchasedMedications.reduce((sum, item) => {
            const priceToUse = item.unitPriceAtPurchase ?? item.listPriceSnapshot ?? 0;
            return sum + (item.quantityPurchased * priceToUse);
        }, 0);
        if (Math.abs(pharmacyTotal - numAmount) > 0.005) { 
             toast({ title: "Info", description: `Pharmacy total recalculated to ₹${pharmacyTotal.toFixed(2)} based on items.`, variant: "default"});
        }
    } else if (paymentType === "Material") {
        if (currentPurchasedMaterials.some(item => !item.materialId || item.quantityPurchased <= 0)) {
            toast({ title: "Validation Error", description: "For Material payments, all items must have a selected material and positive quantity.", variant: "destructive"});
            return;
        }
        const materialTotal = currentPurchasedMaterials.reduce((sum, item) => {
            const priceToUse = item.unitPriceAtPurchase ?? item.listPriceSnapshot ?? 0;
            return sum + (item.quantityPurchased * priceToUse);
        }, 0);
        if (Math.abs(materialTotal - numAmount) > 0.005) { 
             toast({ title: "Info", description: `Material total recalculated to ₹${materialTotal.toFixed(2)} based on items.`, variant: "default"});
        }
    }


    let resolvedPayeeId: string | number | undefined = undefined;
    let resolvedPayeeName: string | undefined = undefined;
    let resolvedPayeeType: Payment['payeeType'] = undefined;

    if (paymentType === "Referral/CC" && payeeId) {
        const doctor = referringDoctorsList.find(d => d.id.toString() === payeeId);
        resolvedPayeeId = doctor?.id;
        resolvedPayeeName = doctor?.name;
        resolvedPayeeType = "ReferringDoctor";
        if (!doctor) { toast({ title: "Validation Error", description: "Selected Referring Doctor not found.", variant: "destructive" }); return;}
    } else if (paymentType === "Salary" && payeeId) {
        const staff = staffMembersList.find(s => s.id.toString() === payeeId);
        resolvedPayeeId = staff?.id;
        resolvedPayeeName = staff?.name;
        resolvedPayeeType = "StaffMember";
        if (!staff) { toast({ title: "Validation Error", description: "Selected Staff Member not found.", variant: "destructive" }); return;}
    } else if (["Material", "Pharmacy"].includes(paymentType)) {
        if (!selectedVendorId) { toast({ title: "Validation Error", description: "Please select a Vendor for this payment type.", variant: "destructive" }); return; }
        const vendor = availableVendors.find(v => v.id === selectedVendorId);
        resolvedPayeeId = vendor?.id;
        resolvedPayeeName = vendor?.name;
        resolvedPayeeType = "Vendor";
        if (!vendor) { toast({ title: "Validation Error", description: "Selected Vendor not found.", variant: "destructive" }); return; }
    } else if (paymentType === "Other") {
        if (!payeeNameInput.trim()) { toast({ title: "Validation Error", description: "Payee Name is required for 'Other' payment type.", variant: "destructive" }); return; }
        resolvedPayeeName = payeeNameInput.trim();
        resolvedPayeeType = "Other";
    } else if (paymentType === "Referral/CC" || paymentType === "Salary") { 
        toast({ title: "Validation Error", description: `Please select a ${paymentType === "Referral/CC" ? "Referring Doctor" : "Staff Member"}.`, variant: "destructive" }); return;
    }


    const paymentData: Omit<Payment, 'id' | 'createdAt' | 'auditLog' | 'recordedByStaffId' | 'recordedByStaffName'> = {
      paymentDate: finalPaymentDateString,
      paymentType,
      payeeId: resolvedPayeeId,
      payeeName: resolvedPayeeName,
      payeeType: resolvedPayeeType,
      description: description.trim(),
      amount: (paymentType === "Pharmacy") 
                ? currentPurchasedMedications.reduce((sum, item) => sum + (item.quantityPurchased * (item.unitPriceAtPurchase ?? item.listPriceSnapshot ?? 0)), 0) 
                : (paymentType === "Material")
                  ? currentPurchasedMaterials.reduce((sum, item) => sum + (item.quantityPurchased * (item.unitPriceAtPurchase ?? item.listPriceSnapshot ?? 0)), 0)
                  : numAmount,
      paymentMethod,
      transactionId: transactionId.trim() || undefined,
      notes: notes.trim() || undefined,
      associatedPatientIds: paymentType === "Referral/CC" ? selectedPatientIdsForPayment : undefined,
      purchasedMedications: paymentType === "Pharmacy" ? currentPurchasedMedications : undefined,
      purchasedMaterials: paymentType === "Material" ? currentPurchasedMaterials : undefined,
    };

    try {
      const paymentsJSON = localStorage.getItem(PAYMENTS_STORAGE_KEY);
      let allPayments: Payment[] = paymentsJSON ? JSON.parse(paymentsJSON).map((p: any) => ({...p, auditLog: Array.isArray(p.auditLog) ? p.auditLog : [], associatedPatientIds: Array.isArray(p.associatedPatientIds) ? p.associatedPatientIds : [], purchasedMedications: Array.isArray(p.purchasedMedications) ? p.purchasedMedications : [], purchasedMaterials: Array.isArray(p.purchasedMaterials) ? p.purchasedMaterials : [] })) : [];
      let auditActionType = "";
      let auditDetails = "";

      if (isEditMode && currentPaymentIdState) {
        let paymentToUpdate = allPayments.find(p => p.id === currentPaymentIdState);
        if (paymentToUpdate) {
            let updatedPayment = { 
                ...paymentToUpdate, 
                ...paymentData, 
                recordedByStaffId: paymentToUpdate.recordedByStaffId, 
                recordedByStaffName: paymentToUpdate.recordedByStaffName,
                auditLog: paymentToUpdate.auditLog || [] 
            };
            auditActionType = "Payment Updated";
            auditDetails = `Payment ${currentPaymentIdState} details updated. Amount: ₹${paymentData.amount.toFixed(2)}.`;
            if(paymentType === "Referral/CC" && selectedPatientIdsForPayment.length > 0) {
                auditDetails += ` Associated patients count: ${selectedPatientIdsForPayment.length}.`;
            }
            if(paymentType === "Pharmacy" && currentPurchasedMedications.length > 0) {
                auditDetails += ` Pharmacy items listed: ${currentPurchasedMedications.length}.`;
            }
             if(paymentType === "Material" && currentPurchasedMaterials.length > 0) {
                auditDetails += ` Material items listed: ${currentPurchasedMaterials.length}.`;
            }
            updatedPayment = addAuditLogEntry(updatedPayment, auditActionType, auditDetails, currentUser);
            allPayments = allPayments.map(p => p.id === currentPaymentIdState ? updatedPayment : p);
            toast({ title: "Success", description: `Payment ${currentPaymentIdState} updated.` });
        } else {
             toast({ title: "Error", description: "Could not find payment record to update.", variant: "destructive" });
             return;
        }
      } else {
        const nextIdNumStr = localStorage.getItem(NEXT_PAYMENT_ID_KEY) || '1';
        let nextIdNum = parseInt(nextIdNumStr, 10);
        const newPaymentId = `PAY-${String(nextIdNum).padStart(3, '0')}`;
        
        let newPayment: Payment = { 
            ...paymentData, 
            id: newPaymentId, 
            createdAt: new Date().toISOString(), 
            recordedByStaffId: currentUser.id,
            recordedByStaffName: currentUser.name,
            auditLog: [] 
        };
        auditActionType = "Payment Recorded";
        auditDetails = `New payment ${newPaymentId} recorded for ${resolvedPayeeName || 'N/A'}. Amount: ₹${paymentData.amount.toFixed(2)}.`;
        if(paymentType === "Referral/CC" && selectedPatientIdsForPayment.length > 0) {
                auditDetails += ` Associated patients count: ${selectedPatientIdsForPayment.length}.`;
        }
        if(paymentType === "Pharmacy" && currentPurchasedMedications.length > 0) {
            auditDetails += ` Pharmacy items listed: ${currentPurchasedMedications.length}.`;
        }
        if(paymentType === "Material" && currentPurchasedMaterials.length > 0) {
            auditDetails += ` Material items listed: ${currentPurchasedMaterials.length}.`;
        }
        newPayment = addAuditLogEntry(newPayment, auditActionType, auditDetails, currentUser);
        allPayments.push(newPayment);
        localStorage.setItem(NEXT_PAYMENT_ID_KEY, (nextIdNum + 1).toString());
        toast({ title: "Success", description: `New payment ${newPaymentId} recorded.` });
      }

      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(allPayments));
      router.push('/payments');

    } catch (e) {
      console.error("Failed to save payment to localStorage", e);
      toast({
        title: "Storage Error",
        description: "Could not save payment data. LocalStorage might be full or disabled.",
        variant: "destructive",
      });
    }
  };
  
  if (authIsLoading || formIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading payment form...</p></div>;
  }

  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  const isPharmacyPaymentWithItems = paymentType === "Pharmacy" && currentPurchasedMedications.length > 0;
  const isMaterialPaymentWithItems = paymentType === "Material" && currentPurchasedMaterials.length > 0;


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-xl mt-6 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Receipt className="mr-3 h-7 w-7 text-primary"/>
            {isEditMode ? `Edit Payment: ${currentPaymentIdState}` : "Record New Payment"}
          </CardTitle>
          <CardDescription>
            {isEditMode ? "Update the details for this payment." : "Fill in the details to record a new outgoing payment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentDate">Payment Date *</Label>
              <div className="flex items-center">
                <Input
                    type="text"
                    id="paymentDate"
                    placeholder="dd/MM/yyyy"
                    value={paymentDateInput}
                    onChange={handleDateInputChange}
                    className="rounded-r-none"
                    required
                />
                <Datepicker
                    selected={paymentDate}
                    onDateChange={handleDateChange}
                    triggerClassName="rounded-l-none border-l-0 w-auto p-2.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="paymentType">Payment Type *</Label>
              <Select onValueChange={handlePaymentTypeChange} value={paymentType}>
                <SelectTrigger id="paymentType">
                  <SelectValue placeholder="Select Payment Type" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentType === "Referral/CC" && (
            <>
              <div>
                <Label htmlFor="referringDoctorPayee">Referring Doctor *</Label>
                <div className="flex items-center gap-2">
                  <Select onValueChange={setPayeeId} value={payeeId}>
                      <SelectTrigger id="referringDoctorPayee" className="flex-grow">
                      <SelectValue placeholder="Select Referring Doctor" />
                      </SelectTrigger>
                      <SelectContent>
                      {referringDoctorsList.length > 0 ? (
                          referringDoctorsList.map(doc => <SelectItem key={doc.id} value={String(doc.id)}>{doc.name} - {doc.location}</SelectItem>)
                      ) : (
                          <div className="p-2 text-sm text-muted-foreground text-center">No referring doctors found.</div>
                      )}
                      </SelectContent>
                  </Select>
                  <Link href="/referring-doctors/form" passHref>
                      <Button variant="outline" size="icon" aria-label="Add new referring doctor" title="Add New Referring Doctor">
                          <UserPlus className="h-4 w-4" />
                      </Button>
                  </Link>
                </div>
              </div>
              {referredPatientsList.length > 0 && (
                <Card className="mt-2 p-3 bg-muted/50">
                    <CardHeader className="p-0 mb-2">
                        <CardTitle className="text-sm font-medium flex items-center">
                            <List className="mr-2 h-4 w-4 text-primary"/>
                            Select Patients Referred by this Doctor (for this payment)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 max-h-48 overflow-y-auto text-sm space-y-2">
                        {referredPatientsList.map(patient => (
                            <div key={patient.id} className="flex items-center space-x-2 p-1.5 border-b last:border-b-0">
                                <Checkbox
                                    id={`patient-${patient.id}`}
                                    checked={selectedPatientIdsForPayment.includes(patient.id)}
                                    onCheckedChange={(checked) => handlePatientSelectionForPayment(patient.id, checked)}
                                />
                                <Label htmlFor={`patient-${patient.id}`} className="text-sm font-normal cursor-pointer">
                                    {patient.firstName} {patient.lastName} (ID: {patient.id.toString().padStart(3,'0')})
                                    <span className="block text-xs text-muted-foreground">Reason: {patient.reasonForVisit || "N/A"}</span>
                                </Label>
                            </div>
                        ))}
                    </CardContent>
                </Card>
              )}
               {paymentType === "Referral/CC" && payeeId && referredPatientsList.length === 0 && (
                 <p className="text-sm text-muted-foreground mt-1">No patients found referred by this doctor.</p>
               )}
            </>
          )}

          {paymentType === "Salary" && (
            <div>
              <Label htmlFor="staffMemberPayee">Staff Member *</Label>
               <div className="flex items-center gap-2">
                <Select onValueChange={setPayeeId} value={payeeId}>
                    <SelectTrigger id="staffMemberPayee" className="flex-grow">
                    <SelectValue placeholder="Select Staff Member" />
                    </SelectTrigger>
                    <SelectContent>
                    {staffMembersList.length > 0 ? (
                        staffMembersList.map(staff => <SelectItem key={staff.id} value={String(staff.id)}>{staff.name} ({staff.role})</SelectItem>)
                    ) : (
                        <div className="p-2 text-sm text-muted-foreground text-center">No staff members found.</div>
                    )}
                    </SelectContent>
                </Select>
                 <Link href="/staff/form" passHref>
                    <Button variant="outline" size="icon" aria-label="Add new staff member" title="Add New Staff Member">
                        <Briefcase className="h-4 w-4" />
                    </Button>
                </Link>
              </div>
            </div>
          )}

          {(paymentType === "Material" || paymentType === "Pharmacy") && (
            <div>
              <Label htmlFor="vendorPayee">Vendor *</Label>
              <div className="flex items-center gap-2">
                <Select onValueChange={setSelectedVendorId} value={selectedVendorId}>
                  <SelectTrigger id="vendorPayee" className="flex-grow">
                    <SelectValue placeholder="Select Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVendors.length > 0 ? (
                      availableVendors.map(vendor => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground text-center">No vendors found. <Link href="/vendors/form" className="underline text-primary">Add one?</Link></div>
                    )}
                  </SelectContent>
                </Select>
                <Link href="/vendors/form" passHref>
                  <Button variant="outline" size="icon" aria-label="Add new vendor" title="Add New Vendor">
                    <Truck className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {paymentType === "Other" && (
             <div>
              <Label htmlFor="payeeNameInputOther">Payee Name *</Label>
              <Input id="payeeNameInputOther" value={payeeNameInput} onChange={(e) => setPayeeNameInput(e.target.value)} placeholder="Enter payee name"/>
            </div>
          )}
          
          <div>
            <Label htmlFor="description">Description * (Reason for payment)</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Payment for Jan referral, Office supplies purchase, Pharmacy Order #123"/>
          </div>

          {paymentType === "Pharmacy" && (
            <Card className="p-4 bg-muted/50">
              <CardHeader className="p-0 mb-3 flex flex-row justify-between items-center">
                <CardTitle className="text-md">Purchased Medications</CardTitle>
                 <Link href="/medications/form" passHref>
                    <Button variant="outline" size="sm">
                        <PillIcon className="mr-2 h-4 w-4" /> Add New to Catalog
                    </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                {currentPurchasedMedications.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 pb-2 border-b last:border-b-0 items-end">
                    <div className="col-span-4 md:col-span-1">
                      <Label htmlFor={`medName-${index}`}>Medication *</Label>
                      <Select
                        value={item.medicationId}
                        onValueChange={(value) => handlePurchasedMedicationChange(index, 'medicationId', value)}
                      >
                        <SelectTrigger id={`medName-${index}`}>
                          <SelectValue placeholder="Select Medication" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMedications.map(med => (
                            <SelectItem key={med.id} value={med.id}>
                              {med.name} (List: ₹{(med.listPrice || 0).toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`medQty-${index}`}>Qty *</Label>
                      <Input
                        id={`medQty-${index}`}
                        type="number"
                        value={item.quantityPurchased}
                        onChange={(e) => handlePurchasedMedicationChange(index, 'quantityPurchased', e.target.value)}
                        className="w-20 text-center"
                        min="1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`medPrice-${index}`}>Actual Unit Price</Label>
                      <Input
                        id={`medPrice-${index}`}
                        type="number"
                        value={item.unitPriceAtPurchase ?? ""}
                        onChange={(e) => handlePurchasedMedicationChange(index, 'unitPriceAtPurchase', e.target.value)}
                        className="w-28 text-right"
                        placeholder={`List: ${(item.listPriceSnapshot || 0).toFixed(2)}`}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePurchasedMedicationItem(index)} className="text-destructive hover:bg-destructive/10 self-end mb-1" title="Remove Item">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={handleAddPurchasedMedicationItem} className="mt-2 w-full md:w-auto">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Medication Item
                </Button>
              </CardContent>
            </Card>
          )}

          {paymentType === "Material" && (
            <Card className="p-4 bg-muted/50">
              <CardHeader className="p-0 mb-3 flex flex-row justify-between items-center">
                <CardTitle className="text-md">Purchased Materials</CardTitle>
                <Link href="/materials/form" passHref>
                  <Button variant="outline" size="sm">
                    <Archive className="mr-2 h-4 w-4" /> Add New to Catalog
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                {currentPurchasedMaterials.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 pb-2 border-b last:border-b-0 items-end">
                    <div className="col-span-4 md:col-span-1">
                      <Label htmlFor={`matName-${index}`}>Material *</Label>
                      <Select
                        value={item.materialId}
                        onValueChange={(value) => handlePurchasedMaterialChange(index, 'materialId', value)}
                      >
                        <SelectTrigger id={`matName-${index}`}>
                          <SelectValue placeholder="Select Material" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMaterials.map(mat => (
                            <SelectItem key={mat.id} value={mat.id}>
                              {mat.name} (List: ₹{(mat.listPrice || 0).toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`matQty-${index}`}>Qty *</Label>
                      <Input
                        id={`matQty-${index}`}
                        type="number"
                        value={item.quantityPurchased}
                        onChange={(e) => handlePurchasedMaterialChange(index, 'quantityPurchased', e.target.value)}
                        className="w-20 text-center"
                        min="1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`matPrice-${index}`}>Actual Unit Price</Label>
                      <Input
                        id={`matPrice-${index}`}
                        type="number"
                        value={item.unitPriceAtPurchase ?? ""}
                        onChange={(e) => handlePurchasedMaterialChange(index, 'unitPriceAtPurchase', e.target.value)}
                        className="w-28 text-right"
                        placeholder={`List: ${(item.listPriceSnapshot || 0).toFixed(2)}`}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePurchasedMaterialItem(index)} className="text-destructive hover:bg-destructive/10 self-end mb-1" title="Remove Item">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={handleAddPurchasedMaterialItem} className="mt-2 w-full md:w-auto">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Material Item
                </Button>
              </CardContent>
            </Card>
          )}


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Total Amount Paid (₹) *</Label>
              <Input 
                id="amount" 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="e.g., 5000.00" 
                min="0.01" 
                step="0.01"
                readOnly={isPharmacyPaymentWithItems || isMaterialPaymentWithItems}
                className={(isPharmacyPaymentWithItems || isMaterialPaymentWithItems) ? "bg-muted" : ""}
              />
               {(isPharmacyPaymentWithItems || isMaterialPaymentWithItems) && <p className="text-xs text-muted-foreground mt-1">Total calculated from items.</p>}
            </div>
            <div>
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select onValueChange={(value) => setPaymentMethod(value as PaymentMethodSpent)} value={paymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS_SPENT.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="transactionId">Transaction ID / Cheque No. (Optional)</Label>
            <Input id="transactionId" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="e.g., CHQ12345, UPI Ref XXXXX"/>
          </div>

          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any other relevant details..."/>
          </div>

          {isEditMode && currentPaymentAuditLog.length > 0 && (
            <Accordion type="single" collapsible className="w-full mt-2">
                <AccordionItem value="payment-audit-log">
                    <AccordionTrigger className="text-sm hover:no-underline flex items-center text-muted-foreground">
                         Payment History / Audit Log ({currentPaymentAuditLog.length})
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {currentPaymentAuditLog.sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()).map((log) => (
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
          <Button variant="outline" onClick={() => router.push('/payments')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" /> {isEditMode ? "Save Changes" : "Record Payment"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
