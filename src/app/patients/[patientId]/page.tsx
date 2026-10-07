
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Datepicker from "@/components/ui/datepicker";
import { Patient, CareNote, TestEntry, TestFieldData, PatientCondition, PatientAdmissionCondition, AuditLogEntry } from '@/types/patient';
import { StaffMember } from '@/types/staff';
import { ReferringDoctor } from '@/types/referringDoctor';
import { Bill, BillItem } from '@/types/billing';
import { Medication } from '@/types/medication';
import type { MedicalTestCatalogItem } from '@/types/medicalTestCatalogItem';
import { useToast } from '@/hooks/use-toast';
import { format, parse, parseISO, isValid as isValidDate } from 'date-fns';
import { ArrowLeft, Download, PlusCircle, Users, ChevronsUpDown, Edit, Paperclip, FlaskConical, CalendarDays, UserCircle as UserCircleIcon, CreditCard, Eye, Activity, Edit3Icon, AlertTriangle, Files, ClipboardList, BriefcaseMedical, CheckCircle2, HelpCircle, Info, Phone, Mail, Home, User, UserSquare2, FileText, CheckCircle, AlertCircle, Pill, Trash2, ShoppingCart, ShieldCheck, History, Camera as CameraIcon, UploadCloud, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEST_DEFINITIONS, TestTypeDef } from '@/config/testTypes';
import { TREATMENT_TEMPLATES, TreatmentTemplate } from '@/config/treatmentTemplates';
import { useAuth } from '@/context/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription as AlertDesc, AlertTitle as AlertTitleComponent } from '@/components/ui/alert';
import { compressImageFiles } from '@/lib/images';
import { uploadNewImages } from '@/lib/storage';
import { StoredImage } from '@/components/stored-image';
import { CareTeamCard } from '@/components/care-team-card';
import { PATIENT_DATA_REQUESTS_ENABLED } from '@/config/features';
import { downloadPatientData, erasePatientData } from '@/lib/patient-data';
import {
  bills as billsRepo, medications as medicationsRepo, patients as patientsRepo, referringDoctors as referringDoctorsRepo,
  staff as staffRepo, testCatalog as testCatalogRepo, treatmentTemplates as treatmentTemplatesRepo,
} from '@/lib/data';



const CONDITION_CONFIG: Record<PatientCondition, { icon: React.ElementType, badgeColor: string, textColor: string, title: string }> = {
  "Critical": { icon: AlertTriangle, badgeColor: "bg-red-100", textColor: "text-red-700", title: "Critical Condition" },
  "Medium": { icon: Activity, badgeColor: "bg-yellow-100", textColor: "text-yellow-700", title: "Medium Condition" },
  "Low": { icon: ShieldCheck, badgeColor: "bg-green-100", textColor: "text-green-700", title: "Low Condition" },
  "Discharged": { icon: CheckCircle2, badgeColor: "bg-sky-100", textColor: "text-sky-700", title: "Discharged" },
  "Unassigned": { icon: HelpCircle, badgeColor: "bg-gray-100", textColor: "text-gray-700", title: "Condition Unassigned" },
};



export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const patientIdParam = params.patientId ? params.patientId as string : null;

  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [availableReferringDoctors, setAvailableReferringDoctors] = useState<ReferringDoctor[]>([]);
  const [testCatalog, setTestCatalog] = useState<MedicalTestCatalogItem[]>([]);
  const [referredDoctorName, setReferredDoctorName] = useState<string | null>(null);
  const [patientBills, setPatientBills] = useState<Bill[]>([]);
  const [availableMedications, setAvailableMedications] = useState<Medication[]>([]);

  const [newNote, setNewNote] = useState<string>("");
  const [newNoteAttachments, setNewNoteAttachments] = useState<string[]>([]);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isHandlingDataRequest, setIsHandlingDataRequest] = useState(false);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const newNoteAttachmentInputRef = useRef<HTMLInputElement>(null);


  const [allTreatmentTemplates, setAllTreatmentTemplates] = useState<TreatmentTemplate[]>([]);
  const [selectedTreatmentTemplateId, setSelectedTreatmentTemplateId] = useState<string>('none');
  const [currentTreatmentTemplate, setCurrentTreatmentTemplate] = useState<TreatmentTemplate | null>(TREATMENT_TEMPLATES.find(t => t.id === 'none') || null);
  const [dynamicTemplateFieldValues, setDynamicTemplateFieldValues] = useState<Record<string, string | number | boolean>>({});

  const [currentNoteMedications, setCurrentNoteMedications] = useState<Array<{medicationId: string; medicationName: string; dosage?: string; notes?: string}>>([]);
  const [isMedicationModalOpen, setIsMedicationModalOpen] = useState(false);
  const [selectedMedicationForModal, setSelectedMedicationForModal] = useState<string>("");
  const [modalDosage, setModalDosage] = useState<string>("");
  const [modalMedicationNotes, setModalMedicationNotes] = useState<string>("");


  const [showAddTestForm, setShowAddTestForm] = useState(false);
  const [selectedTestTypeId, setSelectedTestTypeId] = useState<string>("");
  const [currentTestDefinition, setCurrentTestDefinition] = useState<TestTypeDef | null>(null);
  const [dynamicTestFieldValues, setDynamicTestFieldValues] = useState<TestFieldData>({});

  const [newTestAttachments, setNewTestAttachments] = useState<string[]>([]);
  const newTestAttachmentInputRef = useRef<HTMLInputElement>(null);


  const [newTestDate, setNewTestDate] = useState<Date | null>(null);
  const [newTestDateInput, setNewTestDateInput] = useState<string>("");
  const [newTestOverallResults, setNewTestOverallResults] = useState("");
  const [newTestNotes, setNewTestNotes] = useState("");
  const [selectedStaffForTest, setSelectedStaffForTest] = useState<string>("");
  const [noteToBill, setNoteToBill] = useState<CareNote | null>(null);


  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);


  const fetchPatientAndRelatedData = useCallback(async () => {
    if (patientIdParam === null || !currentUser) {
      setIsLoading(false);
      return;
    }
    const numericPatientId = parseInt(patientIdParam, 10);
    if (isNaN(numericPatientId)) {
        toast({ title: "Error", description: "Invalid Patient ID format.", variant: "destructive" });
        router.push('/dashboard');
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    try {
      const [currentPatientData, staffArray, referringDoctorsArray, billList, catalog, userDefinedTemplates, meds] = await Promise.all([
        patientsRepo.get(numericPatientId),
        staffRepo.list(),
        referringDoctorsRepo.list(),
        billsRepo.list({ patientId: numericPatientId }),
        testCatalogRepo.list(),
        treatmentTemplatesRepo.list(),
        medicationsRepo.list(),
      ]);

      if (!currentPatientData) {
        toast({ title: "Error", description: "Patient not found.", variant: "destructive" });
        router.push('/dashboard');
        setIsLoading(false);
        return;
      }
      setPatient(currentPatientData);
      setAvailableStaff(staffArray);
      setAvailableReferringDoctors(referringDoctorsArray);
      if (currentPatientData.referredDoctorId) {
        const doctor = referringDoctorsArray.find(doc => doc.id === currentPatientData.referredDoctorId);
        setReferredDoctorName(doctor ? `${doctor.name} (${doctor.location})` : "N/A");
      } else {
        setReferredDoctorName(null);
      }
      setPatientBills(billList);
      setTestCatalog(catalog);

      const combinedTemplates = [...TREATMENT_TEMPLATES, ...userDefinedTemplates];
      setAllTreatmentTemplates(combinedTemplates);
      const defaultTemplate = combinedTemplates.find(t => t.id === 'none');
      setCurrentTreatmentTemplate(defaultTemplate || null);
      setAvailableMedications(meds);
    } catch (error) {
      console.error("Error loading patient data:", error);
      toast({ title: "Error", description: "Could not load patient or related data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [patientIdParam, toast, currentUser, router]);

  useEffect(() => {
     if (!authIsLoading && currentUser) {
        fetchPatientAndRelatedData();
    }
  }, [fetchPatientAndRelatedData, authIsLoading, currentUser]);

  const handleDownloadPatientData = useCallback(async () => {
    if (!patient) return;
    setIsHandlingDataRequest(true);
    try {
      await downloadPatientData(patient.id);
      toast({ title: "Download Ready", description: "Patient data downloaded." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Could not export patient data.", variant: "destructive" });
    } finally {
      setIsHandlingDataRequest(false);
    }
  }, [patient, toast]);

  const handleErasePatientData = useCallback(async () => {
    if (!patient) return;
    setIsHandlingDataRequest(true);
    try {
      await erasePatientData(patient.id);
      toast({ title: "Patient Data Erased", description: "The patient's data has been erased." });
      router.push('/dashboard');
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Could not erase patient data.", variant: "destructive" });
      setIsHandlingDataRequest(false);
    }
  }, [patient, toast, router]);

  // Re-reads the patient (with notes, tests and audit trail) after a change is saved.
  const reloadPatient = useCallback(async (patientId: number) => {
    const fresh = await patientsRepo.get(patientId);
    if (fresh) setPatient(fresh);
  }, []);

  const reloadBills = useCallback(async (patientId: number) => {
    setPatientBills(await billsRepo.list({ patientId }));
  }, []);

  const handleTreatmentTemplateChange = useCallback((templateId: string) => {
    setSelectedTreatmentTemplateId(templateId);
    const template = allTreatmentTemplates.find(t => t.id === templateId);
    setCurrentTreatmentTemplate(template || null);
    setDynamicTemplateFieldValues({});
  }, [allTreatmentTemplates]);

  const handleDynamicTemplateFieldChange = useCallback((fieldId: string, value: string | number | boolean) => {
    setDynamicTemplateFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleAddMedicationToCurrentNote = useCallback(() => {
    if (!selectedMedicationForModal) {
        toast({ title: "Error", description: "Please select a medication.", variant: "destructive" });
        return;
    }
    const medicationDetails = availableMedications.find(med => med.id === selectedMedicationForModal);
    if (!medicationDetails) {
        toast({ title: "Error", description: "Selected medication not found.", variant: "destructive" });
        return;
    }
    setCurrentNoteMedications(prev => [
        ...prev,
        {
            medicationId: medicationDetails.id,
            medicationName: medicationDetails.name,
            dosage: modalDosage.trim() || undefined,
            notes: modalMedicationNotes.trim() || undefined,
        }
    ]);
    setSelectedMedicationForModal("");
    setModalDosage("");
    setModalMedicationNotes("");
    setIsMedicationModalOpen(false);
  }, [availableMedications, modalDosage, modalMedicationNotes, selectedMedicationForModal, toast]);

  const handleRemoveMedicationFromCurrentNote = useCallback((index: number) => {
    setCurrentNoteMedications(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleNoteFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
        const newAttachments = await compressImageFiles(files);
        setNewNoteAttachments(prev => [...prev, ...newAttachments]);
        if (newAttachments.length > 0) {
            toast({ title: "Attachments Added", description: `${newAttachments.length} file(s) uploaded successfully.` });
        }
        if (event.target) event.target.value = "";
    }
  }, [toast]);

  const clearNoteAttachment = useCallback(() => {
    setNewNoteAttachments([]);
    if (newNoteAttachmentInputRef.current) {
        newNoteAttachmentInputRef.current.value = "";
    }
  }, []);

  const removeNoteAttachment = useCallback((index: number) => {
    setNewNoteAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);


  const handleAddNote = useCallback(async () => {
    if ((!newNote.trim() && selectedTreatmentTemplateId === 'none') || !patient || !currentUser) {
        toast({ title: "Error", description: "Note text is required for general notes, or select a template.", variant: "destructive" });
        return;
    }

    const isAssigned = patient.assignedStaffIds && patient.assignedStaffIds.length > 0
                       ? patient.assignedStaffIds.includes(currentUser.id)
                       : true;

    if (!isAssigned && patient.assignedStaffIds && patient.assignedStaffIds.length > 0) {
        toast({ title: "Permission Denied", description: "You are not assigned to this patient to add care notes.", variant: "destructive" });
        return;
    }

    if (currentTreatmentTemplate && currentTreatmentTemplate.id !== 'none') {
      for (const field of currentTreatmentTemplate.careNoteFields) {
        if (field.required && (dynamicTemplateFieldValues[field.fieldId] === undefined || String(dynamicTemplateFieldValues[field.fieldId]).trim() === "" || (field.fieldType === 'select' && String(dynamicTemplateFieldValues[field.fieldId]).trim() === ""))) {
          toast({ title: "Validation Error", description: `${field.label} is required for this template.`, variant: "destructive" });
          return;
        }
      }
    }

    setIsSavingNote(true);
    try {
      await patientsRepo.addCareNote(patient.id, {
        text: newNote.trim(),
        staffId: currentUser.id,
        staffName: currentUser.name,
        templateId: selectedTreatmentTemplateId !== 'none' ? selectedTreatmentTemplateId : undefined,
        templateName: selectedTreatmentTemplateId !== 'none' ? currentTreatmentTemplate?.name : undefined,
        templateFieldsData: selectedTreatmentTemplateId !== 'none' ? { ...dynamicTemplateFieldValues } : undefined,
        medicationsMentioned: [...currentNoteMedications],
        attachments: await uploadNewImages(newNoteAttachments, `patients/${patient.id}/care-notes`),
      });
      await reloadPatient(patient.id);
    } catch (e) {
      console.error("Failed to save care note:", e);
      toast({ title: "Save Error", description: e instanceof Error ? e.message : "Could not save the note.", variant: "destructive" });
      return;
    } finally {
      setIsSavingNote(false);
    }
    toast({ title: "Success", description: "Note added." });
    setNewNote("");
    setSelectedTreatmentTemplateId('none');
    const defaultTemplate = allTreatmentTemplates.find(t => t.id === 'none');
    setCurrentTreatmentTemplate(defaultTemplate || null);
    setDynamicTemplateFieldValues({});
    setCurrentNoteMedications([]);
    clearNoteAttachment();
  }, [newNote, selectedTreatmentTemplateId, patient, currentUser, currentTreatmentTemplate, dynamicTemplateFieldValues, currentNoteMedications, newNoteAttachments, toast, reloadPatient, allTreatmentTemplates, clearNoteAttachment]);

  const handleCreatePharmacyBillFromNote = useCallback(async (note: CareNote) => {
    if (!patient || !note.medicationsMentioned || note.medicationsMentioned.length === 0 || !currentUser) {
      toast({ title: "Info", description: "No medications in this note to bill or user not available.", variant: "default" });
      return;
    }

    const billItems: BillItem[] = note.medicationsMentioned.map(medMention => {
      const medicationInfo = availableMedications.find(m => m.id === medMention.medicationId);
      const originalPrice = medicationInfo ? medicationInfo.listPrice : 0;
      return {
        id: `${medMention.medicationId}-${Date.now()}`,
        description: medMention.medicationName,
        quantity: 1,
        originalUnitPrice: originalPrice,
        unitPrice: originalPrice,
        total: originalPrice * 1,
      };
    });

    if (billItems.some(item => item.originalUnitPrice === 0 && item.description)) {
      toast({ title: "Warning", description: "Some medications could not be priced or have a list price of 0. Please check medication list.", variant: "default"});
    }

    const totalAmount = billItems.reduce((sum, item) => sum + item.total, 0);

    try {
      const newBill = await billsRepo.create({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        billDate: format(new Date(), 'dd/MM/yyyy'),
        billType: "Pharmacy",
        items: billItems,
        totalAmount: totalAmount,
        paymentMethod: "",
        paymentStatus: "Unpaid",
        notes: `Pharmacy items from care note dated ${format(parseISO(note.createdAt), "dd/MM/yyyy")}. Dosages: ${note.medicationsMentioned.map(m => `${m.medicationName} - ${m.dosage || 'N/A'}`).join('; ')}`,
      }, "Pharmacy bill created from care note.");
      await reloadBills(patient.id);
      toast({ title: "Success", description: `Pharmacy bill ${newBill.id} created.` });
      setNoteToBill(null);
    } catch (e) {
      console.error("Failed to create pharmacy bill:", e);
      toast({ title: "Save Error", description: "Could not create pharmacy bill.", variant: "destructive" });
    }
  }, [patient, availableMedications, currentUser, toast, reloadBills]);


  const handleStaffAssignmentChange = useCallback((staffId: number) => {
    if (!patient || !currentUser) return;

    const previouslyAssignedStaffIds = patient.assignedStaffIds || [];
    let newAssignedStaffIds: number[];
    let actionDetail = "";

    if (previouslyAssignedStaffIds.includes(staffId)) {
      newAssignedStaffIds = previouslyAssignedStaffIds.filter(id => id !== staffId);
      const staffMember = availableStaff.find(s => s.id === staffId);
      actionDetail = `Unassigned: ${staffMember ? staffMember.name : `Staff ID ${staffId}`}.`;
    } else {
      newAssignedStaffIds = [...previouslyAssignedStaffIds, staffId];
      const staffMember = availableStaff.find(s => s.id === staffId);
      actionDetail = `Assigned: ${staffMember ? staffMember.name : `Staff ID ${staffId}`}.`;
    }

    // Update the screen straight away; roll back if the save fails.
    setPatient({ ...patient, assignedStaffIds: newAssignedStaffIds });
    patientsRepo.update(patient.id, { assignedStaffIds: newAssignedStaffIds }, { actionType: "Staff Assignment Changed", details: actionDetail })
      .then(() => reloadPatient(patient.id))
      .then(() => toast({ title: "Success", description: "Staff assignment updated." }))
      .catch(e => {
        console.error("Failed to update staff assignment:", e);
        setPatient(patient);
        toast({ title: "Save Error", description: "Could not update staff assignment.", variant: "destructive" });
      });
  }, [patient, currentUser, availableStaff, reloadPatient, toast]);

  const getAssignedStaffNames = useCallback(() => {
    if (!patient || !patient.assignedStaffIds || patient.assignedStaffIds.length === 0) {
      return "No staff assigned.";
    }
    return patient.assignedStaffIds
      .map(id => availableStaff.find(staff => staff.id === id)?.name)
      .filter(name => name)
      .join(', ') || "No staff assigned.";
  }, [patient, availableStaff]);

  const handleTestDateInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewTestDateInput(val);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        try {
            const parsedDate = parse(val, 'dd/MM/yyyy', new Date());
            if (isValidDate(parsedDate)) {
                setNewTestDate(parsedDate);
            } else {
                setNewTestDate(null);
            }
        } catch {
            setNewTestDate(null);
        }
    } else {
        setNewTestDate(null);
    }
  }, []);

  const handleTestDateSelect = useCallback((selectedDate: Date | undefined) => {
    setNewTestDate(selectedDate || null);
    if (selectedDate) {
        setNewTestDateInput(format(selectedDate, 'dd/MM/yyyy'));
    } else {
        setNewTestDateInput("");
    }
  }, []);

  const handleTestTypeChange = useCallback((typeId: string) => {
    setSelectedTestTypeId(typeId);
    // Catalog tests (ids like "test_cat_3") use the matching built-in form by name, e.g. "ECG".
    const catalogName = testCatalog.find(t => t.id === typeId)?.name.trim().toLowerCase();
    const definition = TEST_DEFINITIONS.find(def => def.id === typeId || def.name.toLowerCase() === catalogName);
    setCurrentTestDefinition(definition || null);
    setDynamicTestFieldValues({});
  }, [testCatalog]);

  const handleDynamicTestFieldChange = useCallback((fieldId: string, value: string | number) => {
    setDynamicTestFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleTestFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
        const newAttachments = await compressImageFiles(files);
        setNewTestAttachments(prev => [...prev, ...newAttachments]);
        if (newAttachments.length > 0) {
            toast({ title: "Attachments Added", description: `${newAttachments.length} file(s) uploaded successfully.` });
        }
        if (event.target) event.target.value = "";
    }
  }, [toast]);

  const clearTestAttachment = useCallback(() => {
    setNewTestAttachments([]);
    if (newTestAttachmentInputRef.current) {
        newTestAttachmentInputRef.current.value = "";
    }
  }, []);

  const removeTestAttachment = useCallback((index: number) => {
    setNewTestAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);


  const handleAddTest = useCallback(async () => {
    if (!selectedTestTypeId || !patient || !currentUser) {
        toast({ title: "Validation Error", description: "Please select a Test Type.", variant: "destructive" });
        return;
    }
    if (!newTestDate && !newTestDateInput) {
      toast({ title: "Validation Error", description: "Test Date is required.", variant: "destructive" });
      return;
    }

    let finalTestDateString = "";
    if (newTestDate) {
        finalTestDateString = format(newTestDate, 'dd/MM/yyyy');
    } else if (newTestDateInput) {
        try {
            const parsed = parse(newTestDateInput, 'dd/MM/yyyy', new Date());
            if(!isValidDate(parsed) || format(parsed, 'dd/MM/yyyy') !== newTestDateInput) {
                 toast({ title: "Validation Error", description: "Test Date must be in dd/MM/yyyy format.", variant: "destructive" }); return;
            }
            finalTestDateString = newTestDateInput;
        } catch {
            toast({ title: "Validation Error", description: "Test Date must be in dd/MM/yyyy format.", variant: "destructive" }); return;
        }
    }

    if (currentTestDefinition) {
      for (const field of currentTestDefinition.fields) {
        if (field.required && (dynamicTestFieldValues[field.id] === undefined || String(dynamicTestFieldValues[field.id]).trim() === "")) {
          toast({ title: "Validation Error", description: `${field.label} is required for this test type.`, variant: "destructive" });
          return;
        }
      }
    }

    let performedByStaffDetails = null;
    if(selectedStaffForTest){
        performedByStaffDetails = availableStaff.find(s => s.id.toString() === selectedStaffForTest);
    }

    setIsSavingTest(true);
    try {
      await patientsRepo.addTest(patient.id, {
        testTypeId: selectedTestTypeId,
        testTypeName: testCatalog.find(t => t.id === selectedTestTypeId)?.name || currentTestDefinition?.name || "Unknown Test",
        datePerformed: finalTestDateString,
        testData: { ...dynamicTestFieldValues },
        overallResults: newTestOverallResults.trim() || undefined,
        notes: newTestNotes.trim() || undefined,
        performedByStaffId: performedByStaffDetails ? performedByStaffDetails.id : currentUser.id,
        performedByStaffName: performedByStaffDetails ? performedByStaffDetails.name : currentUser.name,
        attachments: await uploadNewImages(newTestAttachments, `patients/${patient.id}/tests`),
      });
      await reloadPatient(patient.id);
    } catch (e) {
      console.error("Failed to save test:", e);
      toast({ title: "Save Error", description: e instanceof Error ? e.message : "Could not save the test.", variant: "destructive" });
      return;
    } finally {
      setIsSavingTest(false);
    }
    toast({ title: "Success", description: "Test entry added." });

    setSelectedTestTypeId("");
    setCurrentTestDefinition(null);
    setDynamicTestFieldValues({});
    setNewTestDate(null);
    setNewTestDateInput("");
    setNewTestOverallResults("");
    setNewTestNotes("");
    setSelectedStaffForTest("");
    setShowAddTestForm(false);
    clearTestAttachment();
  }, [selectedTestTypeId, patient, currentUser, newTestDate, newTestDateInput, currentTestDefinition, dynamicTestFieldValues, newTestOverallResults, newTestNotes, selectedStaffForTest, newTestAttachments, toast, reloadPatient, availableStaff, clearTestAttachment, testCatalog]);

  const handleCreateTestBill = useCallback(async (test: TestEntry) => {
    if (!patient) return;
    const testCatalogItem = testCatalog.find(t => t.id === test.testTypeId)
      ?? testCatalog.find(t => t.name.trim().toLowerCase() === test.testTypeName.trim().toLowerCase());
    const billItem: BillItem = {
      id: `${test.id}-${Date.now()}`,
      description: test.testTypeName,
      quantity: 1,
      originalUnitPrice: testCatalogItem?.defaultPrice || 0,
      unitPrice: testCatalogItem?.defaultPrice || 0,
      total: testCatalogItem?.defaultPrice || 0,
    };
    try {
      const newBill = await billsRepo.create({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        billDate: format(new Date(), 'dd/MM/yyyy'),
        billType: "Treatment",
        items: [billItem],
        totalAmount: billItem.total,
        paymentMethod: "",
        paymentStatus: "Unpaid",
        notes: `Bill for test: ${test.testTypeName} performed on ${test.datePerformed}`,
      }, "Treatment bill created for test.");
      await reloadBills(patient.id);
      toast({ title: "Success", description: `Bill ${newBill.id} created for test.` });
    } catch (e) {
      console.error("Failed to create test bill:", e);
      toast({ title: "Save Error", description: "Could not create test bill.", variant: "destructive" });
    }
  }, [patient, testCatalog, reloadBills, toast]);

  const formatDateSafe = useCallback((dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    let parsedDate;
    try {
      parsedDate = parseISO(dateString);
      if (isValidDate(parsedDate)) return format(parsedDate, 'dd/MM/yyyy');
    } catch (e) { /* ignore */ }

    try {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            parsedDate = parse(dateString, "dd/MM/yyyy", new Date());
            if (isValidDate(parsedDate)) return format(parsedDate, "dd/MM/yyyy");
        }
    } catch (e) { /* ignore */ }

    return dateString;
  }, []);

  const billSummary = useMemo(() => {
    return patientBills.reduce((acc, bill) => {
      if (bill.paymentStatus === "Unpaid") {
        acc.unpaidCount++;
        acc.unpaidTotal += bill.totalAmount;
      } else if (bill.paymentStatus === "Partially Paid") {
        acc.partiallyPaidCount++;
        acc.partiallyPaidTotal += bill.totalAmount; // This could be more nuanced if partial amounts were tracked
      } else if (bill.paymentStatus === "Paid") {
        acc.paidCount++;
      }
      return acc;
    }, { unpaidCount: 0, unpaidTotal: 0, partiallyPaidCount: 0, partiallyPaidTotal: 0, paidCount: 0 });
  }, [patientBills]);

  const billSummaryText = useMemo(() => {
    let text = `${patientBills.length} bill(s) on record. View Details`;
    if (billSummary.unpaidCount > 0) {
      text = `${billSummary.unpaidCount} Unpaid Bill(s) (Total: ₹${billSummary.unpaidTotal.toFixed(2)}). View all ${patientBills.length}.`;
    } else if (billSummary.partiallyPaidCount > 0) {
       text = `${billSummary.partiallyPaidCount} Partially Paid. View all ${patientBills.length}.`;
    } else if (patientBills.length > 0) {
      text = `All ${patientBills.length} bill(s) accounted for. View details.`;
    }
    return text;
  }, [patientBills, billSummary]);



  if (isLoading || authIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading patient details...</p></div>;
  }

  if (!currentUser && !authIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Redirecting to login...</p></div>;
  }

  if (!patient && !isLoading) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Patient Not Found</h1>
        <Link href="/dashboard" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!patient) {
      return <div className="flex justify-center items-center min-h-screen"><p>Loading patient data...</p></div>;
  }


  const DetailItem = ({ label, value, icon: Icon, className }: { label: string; value?: string | null | React.ReactNode; icon?: React.ElementType; className?: string }) => (
    value || typeof value === 'number' ?
    <div className={cn("text-sm flex items-start", className)}>
      {Icon && <Icon className="mr-2 h-4 w-4 mt-0.5 text-muted-foreground shrink-0"/>}
      <div>
        <span className="font-medium text-muted-foreground">{label}: </span>
        {typeof value === 'string' ? value : <>{value}</>}
      </div>
    </div>
    : null
  );

  const FormattedDateItem = ({ label, dateString, icon = CalendarDays }: { label: string, dateString?: string | null, icon?: React.ElementType}) => {
    if (!dateString) return null;
    let displayDate = dateString;
    try {
        const dateISO = parseISO(dateString);
        if (isValidDate(dateISO)) {
            displayDate = format(dateISO, "dd/MM/yyyy, HH:mm");
        } else {
            const dateDDMMYYYY = parse(dateString, "dd/MM/yyyy", new Date());
            if (isValidDate(dateDDMMYYYY)) {
                displayDate = format(dateDDMMYYYY, "dd/MM/yyyy");
            }
        }
    } catch (e) { /* ignore, use original string */ }
    return <DetailItem label={label} value={displayDate} icon={icon}/>;
  };

  const getLatestCareNoteSummary = (currentPatient: Patient): string => {
    if (!currentPatient.careNotes || currentPatient.careNotes.length === 0) {
      return "No recent activity";
    }
    const sortedNotes = [...currentPatient.careNotes].sort((a, b) =>
      parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()
    );
    const latestNote = sortedNotes[0];
    let summary = "";
    if (latestNote.templateName && latestNote.templateName !== 'General Note (No Template)') {
      summary = latestNote.templateName;
    } else if (latestNote.text) {
      summary = latestNote.text.substring(0, 30) + (latestNote.text.length > 30 ? "..." : "");
    } else {
       summary = "General note entry";
    }
    try {
        const formattedDate = format(parseISO(latestNote.createdAt), "dd/MM/yy");
        return `${summary} (on ${formattedDate})`;
    } catch (e) {
        return summary;
    }
  };

  const latestNoteSummary = getLatestCareNoteSummary(patient);
  const conditionLevel = patient.condition || "Unassigned";
  const currentCondConfig = CONDITION_CONFIG[conditionLevel];
  const CondIcon = currentCondConfig.icon;


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/patients/${patient.id.toString().padStart(3, '0')}/summary`}><FileText className="mr-2 h-4 w-4" /> Treatment Summary</Link>
          </Button>
          {PATIENT_DATA_REQUESTS_ENABLED && currentUser?.role === "Super Admin" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadPatientData} disabled={isHandlingDataRequest}>
                <Download className="mr-2 h-4 w-4" /> Download Patient Data
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isHandlingDataRequest}>
                    <Trash2 className="mr-2 h-4 w-4" /> Erase Patient Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Erase all data for {patient.firstName} {patient.lastName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the patient&apos;s details, care notes, tests, images and history. Bills are kept for the clinic&apos;s accounts but no longer show who they were for. This cannot be undone. Download the patient&apos;s data first if they asked for a copy.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleErasePatientData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Erase Permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{`${patient.firstName} ${patient.lastName}`}</h1>
                <div className="flex items-center gap-3 mt-1">
                    <p className="flex items-center text-sm text-muted-foreground">
                        <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate" title={latestNoteSummary}>Latest: {latestNoteSummary}</span>
                    </p>
                    {currentCondConfig && (
                        <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${currentCondConfig.badgeColor} ${currentCondConfig.textColor}`}>
                            <CondIcon className="mr-1 h-3 w-3" />
                            {conditionLevel}
                        </span>
                    )}
                </div>
            </div>
            {patient.patientPhotos && patient.patientPhotos.length > 0 && (
                <StoredImage
                    path={patient.patientPhotos[0]}
                    linked
                    alt={`Photo of ${patient.firstName}`}
                    className="rounded-md border w-24 h-24 object-cover mt-2 sm:mt-0 shadow-md"
                />
            )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6"> {/* Main content area */}
            <Card className="shadow-lg">
                <CardHeader className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 space-y-0">
                    <CardTitle className="flex items-center"><User className="mr-2 h-5 w-5 text-primary"/>Patient Details</CardTitle>
                    <div className="flex flex-wrap gap-2">
                        <Link href={`/?editPatientId=${patient.id.toString().padStart(3,'0')}`} passHref>
                            <Button variant="outline" size="sm">
                                <Edit3Icon className="mr-2 h-3 w-3" /> Edit Basic Info
                            </Button>
                        </Link>
                        <Link href={`/patients/${patient.id.toString().padStart(3,'0')}/admission`} passHref>
                            <Button variant="outline" size="sm"><Edit className="mr-2 h-3 w-3"/> Edit Admission</Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                        <DetailItem label="Gender" value={patient.gender} icon={Users} />
                        <FormattedDateItem label="Date of Birth" dateString={patient.dateOfBirth} icon={CalendarDays}/>
                        <DetailItem label="Reason for Visit" value={patient.reasonForVisit || "N/A"} icon={FileText}/>
                        <DetailItem label="Referred By" value={referredDoctorName || "N/A"} icon={BriefcaseMedical}/>
                        <DetailItem label="Emergency Contact" value={patient.emergencyContactName} icon={UserCircleIcon}/>
                        <DetailItem label="Emergency Mobile" value={patient.emergencyContactNumber} icon={Phone}/>
                    </div>
                    <Accordion type="single" collapsible className="w-full pt-2">
                        <AccordionItem value="full-patient-admission-details">
                            <AccordionTrigger className="text-sm hover:no-underline">View Full Patient &amp; Admission Info</AccordionTrigger>
                            <AccordionContent className="space-y-3 pt-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                    <DetailItem label="Patient Mobile" value={patient.mobileNumber || "N/A"} icon={Phone}/>
                                    <DetailItem label="Patient Email" value={patient.emailAddress || "N/A"} icon={Mail}/>
                                    <DetailItem label="Address" value={patient.address || "N/A"} icon={Home} className="sm:col-span-2"/>
                                    <DetailItem label="ID Card Type" value={patient.idCardType || "N/A"} icon={UserSquare2}/>
                                    <DetailItem label="ID Number" value={patient.idNumber || "N/A"} icon={UserSquare2}/>
                                    <FormattedDateItem label="Admission Date" dateString={patient.admissionDate} />
                                    <DetailItem label="Condition at Admission" value={patient.admissionCondition || "N/A"} icon={Activity} />
                                </div>

                                {patient.initialObservationsText && (
                                    <DetailItem label="Initial Observations" value={patient.initialObservationsText} icon={FileText} className="sm:col-span-2"/>
                                )}

                                {patient.idCardImages && patient.idCardImages.length > 0 && (
                                    <div className="mt-2 sm:col-span-2">
                                        <Label className="text-sm font-medium text-muted-foreground">Scanned ID Card:</Label>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                                {patient.idCardImages.map((path, index) => (
                                                    <StoredImage key={path} path={path} linked alt={`ID card ${index + 1}`} className="h-24 w-24 sm:h-32 sm:w-32 rounded border object-cover" />
                                                ))}
                                            </div>
                                    </div>
                                )}
                                {patient.initialObservationAttachments && patient.initialObservationAttachments.length > 0 && (
                                    <div className="mt-2 sm:col-span-2">
                                        <Label className="text-sm font-medium text-muted-foreground">Admission Attachments:</Label>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                                {patient.initialObservationAttachments.map((path, index) => (
                                                    <StoredImage key={path} path={path} linked alt={`Admission attachment ${index + 1}`} className="h-24 w-24 sm:h-32 sm:w-32 rounded border object-cover" />
                                                ))}
                                            </div>
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                  <CardTitle className="flex items-center"><ClipboardList className="mr-2 h-5 w-5 text-primary"/>Care Notes</CardTitle>
                  <CardDescription>Add and view notes for this patient. Notes will be attributed to you ({currentUser?.name}).</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="space-y-3 mb-4">
                    <div>
                        <Label htmlFor="treatmentTemplate">Treatment Template</Label>
                        <Select onValueChange={handleTreatmentTemplateChange} value={selectedTreatmentTemplateId}>
                            <SelectTrigger id="treatmentTemplate">
                                <SelectValue placeholder="Select a Treatment Template or General Note" />
                            </SelectTrigger>
                            <SelectContent>
                                {allTreatmentTemplates.map(template => (
                                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {currentTreatmentTemplate && currentTreatmentTemplate.careNoteFields.map(field => (
                        <div key={field.fieldId}>
                            <Label htmlFor={`templateField-${field.fieldId}`}>{field.label}{field.required ? " *" : ""}</Label>
                            {field.fieldType === 'textarea' ? (
                                <Textarea
                                    id={`templateField-${field.fieldId}`}
                                    value={(dynamicTemplateFieldValues[field.fieldId] as string) || ""}
                                    onChange={(e) => handleDynamicTemplateFieldChange(field.fieldId, e.target.value)}
                                    placeholder={field.placeholder}
                                    rows={3}
                                />
                            ) : field.fieldType === 'select' && field.options ? (
                                <Select
                                    onValueChange={(value) => handleDynamicTemplateFieldChange(field.fieldId, value)}
                                    value={dynamicTemplateFieldValues[field.fieldId] as string || ""}
                                >
                                    <SelectTrigger id={`templateField-${field.fieldId}`}>
                                        <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {field.options.map(option => (
                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id={`templateField-${field.fieldId}`}
                                    type={field.fieldType}
                                    value={String(dynamicTemplateFieldValues[field.fieldId] ?? "")}
                                    onChange={(e) => handleDynamicTemplateFieldChange(field.fieldId, field.fieldType === 'number' ? parseFloat(e.target.value) || "" : e.target.value)}
                                    placeholder={field.placeholder}
                                    min={field.fieldType === 'number' ? 0 : undefined}
                                />
                            )}
                        </div>
                    ))}

                    <div>
                      <Label htmlFor="newNote">General Note Text (Optional if template used)</Label>
                      <Textarea
                          id="newNote"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder={`Add general notes for ${patient.firstName}...`}
                          rows={3}
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="font-medium">Medications for this Note Entry</Label>
                            <Dialog open={isMedicationModalOpen} onOpenChange={setIsMedicationModalOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        setSelectedMedicationForModal("");
                                        setModalDosage("");
                                        setModalMedicationNotes("");
                                        setIsMedicationModalOpen(true);
                                    }}>
                                        <Pill className="mr-2 h-4 w-4" /> Add Medication
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Add Medication to Note</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div>
                                            <Label htmlFor="medicationSelectModal">Medication *</Label>
                                            <Select onValueChange={setSelectedMedicationForModal} value={selectedMedicationForModal}>
                                                <SelectTrigger id="medicationSelectModal">
                                                    <SelectValue placeholder="Select Medication" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableMedications.length > 0 ? availableMedications.map(med => (
                                                        <SelectItem key={med.id} value={med.id}>{med.name}</SelectItem>
                                                    )) : <div className="p-2 text-sm text-muted-foreground text-center">No medications found. <Link href="/medications/form" className="underline">Add one?</Link></div>}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="medicationDosageModal">Dosage (Optional)</Label>
                                            <Input id="medicationDosageModal" value={modalDosage} onChange={e => setModalDosage(e.target.value)} placeholder="e.g., 500mg twice daily"/>
                                        </div>
                                        <div>
                                            <Label htmlFor="medicationNotesModal">Notes (Optional)</Label>
                                            <Textarea id="medicationNotesModal" value={modalMedicationNotes} onChange={e => setModalMedicationNotes(e.target.value)} placeholder="e.g., Take with food, Adjust based on BP"/>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button type="button" variant="outline">Cancel</Button>
                                        </DialogClose>
                                        <Button type="button" onClick={handleAddMedicationToCurrentNote}>Add to Note</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        {currentNoteMedications.length > 0 ? (
                            <div className="space-y-2 border p-2 rounded-md bg-muted/30">
                                {currentNoteMedications.map((med, index) => (
                                    <div key={index} className="flex justify-between items-start text-sm p-1.5 border-b last:border-b-0">
                                        <div>
                                            <p className="font-semibold">{med.medicationName}</p>
                                            {med.dosage && <p className="text-xs text-muted-foreground">Dosage: {med.dosage}</p>}
                                            {med.notes && <p className="text-xs text-muted-foreground">Notes: {med.notes}</p>}
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveMedicationFromCurrentNote(index)} className="h-6 w-6 text-destructive hover:bg-destructive/10">
                                            <Trash2 className="h-3.5 w-3.5"/>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">No medications added to this specific note entry yet.</p>
                        )}
                    </div>

                    <div className="mt-3">
                        <Label htmlFor="newNoteAttachment">Attachments (Optional, images are resized automatically)</Label>
                        <div className="flex items-center gap-3 mt-1">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleNoteFileUpload}
                                ref={newNoteAttachmentInputRef}
                                className="hidden"
                            />
                            <Button type="button" variant="outline" onClick={() => newNoteAttachmentInputRef.current?.click()} className="flex-1">
                                <UploadCloud className="mr-2 h-4 w-4"/> {newNoteAttachments.length > 0 ? `Add More (${newNoteAttachments.length})` : "Upload Files"}
                            </Button>
                            {newNoteAttachments.length > 0 && (
                                <Button type="button" variant="ghost" size="sm" onClick={clearNoteAttachment} className="text-xs text-destructive">
                                    Clear All
                                </Button>
                            )}
                        </div>
                        {newNoteAttachments.length > 0 && (
                            <div className="mt-2 grid grid-cols-3 gap-2">
                                {newNoteAttachments.map((attachment, index) => (
                                    <div key={index} className="relative border rounded-md p-1">
                                        <StoredImage path={attachment} alt={`Attachment ${index + 1}`} className="rounded-md w-full h-20 object-cover" />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                                            onClick={() => removeNoteAttachment(index)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>


                    <Button onClick={handleAddNote} disabled={!currentUser || isSavingNote} className="w-full mt-3">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Note
                    </Button>
                  </div>
                  <hr className="my-4" />
                  <h3 className="text-md font-semibold mb-2">Existing Notes:</h3>
                  {(patient.careNotes && patient.careNotes.length > 0) ? (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="care-notes-list">
                        <AccordionTrigger className="text-sm py-2 hover:no-underline">
                            View Recorded Notes ({patient.careNotes.length})
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {patient.careNotes.sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()).map((note) => (
                                <Card key={note.id} className="bg-muted/50 p-3 text-sm">
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs text-muted-foreground mb-1">
                                        {format(parseISO(note.createdAt), "dd/MM/yyyy, HH:mm")}
                                        {note.staffName && (
                                            <>
                                            {' by '}
                                            <span className="font-semibold text-foreground">{note.staffName}</span>
                                            </>
                                        )}
                                        </p>
                                        {note.medicationsMentioned && note.medicationsMentioned.length > 0 && (
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm" onClick={() => setNoteToBill(note)}>
                                                    <ShoppingCart className="mr-2 h-3 w-3" /> Bill Meds
                                                </Button>
                                            </AlertDialogTrigger>
                                            {noteToBill && noteToBill.id === note.id && (
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Create Pharmacy Bill?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will create a new bill for the medications listed in this care note.
                                                            Medications: {note.medicationsMentioned.map(m => m.medicationName).join(', ')}.
                                                            Are you sure you want to proceed?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setNoteToBill(null)}>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleCreatePharmacyBillFromNote(note)}>
                                                            Create Bill
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            )}
                                          </AlertDialog>
                                        )}
                                    </div>
                                    {note.templateName && <p className="font-semibold text-sm mb-1">Template: {note.templateName}</p>}
                                    {note.text && <p className="whitespace-pre-wrap mb-1"><span className="font-medium">General Note:</span> {note.text}</p>}

                                    {note.templateId && note.templateFieldsData && Object.keys(note.templateFieldsData).length > 0 && (
                                        <div className="mt-1.5 space-y-0.5">
                                            <p className="text-xs font-medium">Template Specific Data:</p>
                                            {allTreatmentTemplates.find(t => t.id === note.templateId)?.careNoteFields.map(fieldDef => {
                                                const value = note.templateFieldsData?.[fieldDef.fieldId];
                                                if (value !== undefined && String(value).trim() !== "") {
                                                    let displayValue = String(value);
                                                    if (fieldDef.fieldType === 'select') {
                                                        displayValue = fieldDef.options?.find(opt => opt.value === value)?.label || String(value);
                                                    }
                                                    return (
                                                        <p key={fieldDef.fieldId} className="text-xs pl-2">
                                                            <span className="font-medium">{fieldDef.label}:</span> {displayValue}
                                                        </p>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </div>
                                    )}
                                     {note.medicationsMentioned && note.medicationsMentioned.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs font-medium flex items-center"><Pill className="mr-1 h-3 w-3 text-blue-600"/>Medications Mentioned:</p>
                                            <ul className="list-disc list-inside pl-4 text-xs space-y-0.5">
                                                {note.medicationsMentioned.map((med, index) => (
                                                    <li key={index}>
                                                        <span className="font-semibold">{med.medicationName}</span>
                                                        {med.dosage && <span className="text-muted-foreground"> - Dosage: {med.dosage}</span>}
                                                        {med.notes && <span className="text-muted-foreground"> - Notes: {med.notes}</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {note.attachments && note.attachments.length > 0 && (
                                        <div className="mt-2">
                                            <Label className="text-xs font-medium">Attachments:</Label>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {note.attachments.map((path, index) => (
                                                    <StoredImage key={path} path={path} linked alt={`Care note attachment ${index + 1}`} className="max-h-32 max-w-[200px] rounded border object-cover" />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  ) : (
                  <p className="text-sm text-muted-foreground italic">No care notes added yet.</p>
                  )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="flex flex-row flex-wrap justify-between items-center gap-2 space-y-0">
                <CardTitle className="flex items-center"><FlaskConical className="mr-2 h-5 w-5 text-primary"/>Tests Performed</CardTitle>
                {!showAddTestForm && (
                    <Button variant="outline" size="sm" onClick={() => {
                        setShowAddTestForm(true);
                        setSelectedTestTypeId("");
                        setCurrentTestDefinition(null);
                        setDynamicTestFieldValues({});
                        setNewTestDate(null);
                        setNewTestDateInput("");
                        setNewTestOverallResults("");
                        setNewTestNotes("");
                        setSelectedStaffForTest("");
                        clearTestAttachment();
                    }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Test
                    </Button>
                )}
              </CardHeader>
              <CardContent>
                {showAddTestForm && (
                  <div className="space-y-4 border p-4 rounded-md mb-6 bg-muted/30">
                    <h3 className="text-lg font-semibold">Add New Test Entry</h3>
                    <div>
                      <Label htmlFor="selectedTestType">Test Type *</Label>
                      <Select onValueChange={handleTestTypeChange} value={selectedTestTypeId}>
                        <SelectTrigger id="selectedTestType"><SelectValue placeholder="Select Test Type" /></SelectTrigger>
                        <SelectContent>
                          {testCatalog.map(test => (
                            <SelectItem key={test.id} value={test.id}>{test.name} {test.defaultPrice ? `(₹${test.defaultPrice})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {currentTestDefinition && currentTestDefinition.fields.map(field => (
                        <div key={field.id}>
                            <Label htmlFor={`testField-${field.id}`}>{field.label}{field.required ? " *" : ""}</Label>
                            {field.type === 'textarea' ? (
                                <Textarea
                                    id={`testField-${field.id}`}
                                    value={(dynamicTestFieldValues[field.id] as string) || ""}
                                    onChange={(e) => handleDynamicTestFieldChange(field.id, e.target.value)}
                                    placeholder={field.placeholder}
                                    rows={3}
                                />
                            ) : (
                                <Input
                                    id={`testField-${field.id}`}
                                    type={field.type}
                                    value={String(dynamicTestFieldValues[field.id] ?? "")}
                                    onChange={(e) => handleDynamicTestFieldChange(field.id, field.type === 'number' ? parseFloat(e.target.value) || "" : e.target.value)}
                                    placeholder={field.placeholder}
                                    min={field.type === 'number' ? 0 : undefined}
                                />
                            )}
                        </div>
                    ))}

                    <div>
                      <Label htmlFor="newTestDate">Date Performed * (dd/MM/yyyy)</Label>
                       <div className="flex items-center">
                            <Input
                                type="text"
                                id="newTestDate"
                                placeholder="dd/MM/yyyy"
                                value={newTestDateInput}
                                onChange={handleTestDateInputChange}
                                className="rounded-r-none"
                                required
                            />
                            <Datepicker
                                selected={newTestDate}
                                onDateChange={handleTestDateSelect}
                                triggerClassName="rounded-l-none border-l-0 w-auto p-2.5"
                            />
                        </div>
                    </div>
                    <div>
                      <Label htmlFor="selectedStaffForTest">Performed/Logged By</Label>
                       <Select onValueChange={setSelectedStaffForTest} value={selectedStaffForTest}>
                         <SelectTrigger id="selectedStaffForTest">
                            <SelectValue placeholder={`Defaults to you (${currentUser?.name || 'Current User'})`} />
                         </SelectTrigger>
                         <SelectContent>
                           {availableStaff
                             .map(staff => (
                               <SelectItem key={staff.id} value={staff.id.toString()}>{staff.name} ({staff.role})</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                    </div>
                     <div>
                      <Label htmlFor="newTestOverallResults">Overall Results Summary (Optional)</Label>
                      <Textarea id="newTestOverallResults" value={newTestOverallResults} onChange={(e) => setNewTestOverallResults(e.target.value)} placeholder="Enter overall test results summary..." rows={3} />
                    </div>
                    <div>
                      <Label htmlFor="newTestNotes">General Notes (Optional)</Label>
                      <Textarea id="newTestNotes" value={newTestNotes} onChange={(e) => setNewTestNotes(e.target.value)} placeholder="Additional general notes for the test..." rows={2} />
                    </div>
                    <div>
                        <Label htmlFor="newTestAttachment">Attachments (Optional, images are resized automatically)</Label>
                        <div className="flex items-center gap-3 mt-1">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleTestFileUpload}
                                ref={newTestAttachmentInputRef}
                                className="hidden"
                            />
                            <Button type="button" variant="outline" onClick={() => newTestAttachmentInputRef.current?.click()} className="flex-1">
                                <UploadCloud className="mr-2 h-4 w-4"/> {newTestAttachments.length > 0 ? `Add More (${newTestAttachments.length})` : "Upload Files"}
                            </Button>
                            {newTestAttachments.length > 0 && (
                                <Button type="button" variant="ghost" size="sm" onClick={clearTestAttachment} className="text-xs text-destructive">
                                    Clear All
                                </Button>
                            )}
                        </div>
                        {newTestAttachments.length > 0 && (
                            <div className="mt-2 grid grid-cols-3 gap-2">
                                {newTestAttachments.map((attachment, index) => (
                                    <div key={index} className="relative border rounded-md p-1">
                                        <StoredImage path={attachment} alt={`Test Attachment ${index + 1}`} className="rounded-md w-full h-20 object-cover" />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                                            onClick={() => removeTestAttachment(index)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setShowAddTestForm(false)}>Cancel</Button>
                      <Button onClick={handleAddTest} disabled={isSavingTest}>{isSavingTest ? "Saving..." : "Save Test"}</Button>
                    </div>
                  </div>
                )}

                {(patient.tests && patient.tests.length > 0) ? (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="test-list">
                        <AccordionTrigger className="text-sm py-2 hover:no-underline">
                            View Recorded Tests ({patient.tests.length})
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {patient.tests.sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()).map((test) => (
                                <Card key={test.id} className="bg-muted/50 p-3">
                                    <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-primary-foreground flex items-center"><FlaskConical className="mr-2 h-4 w-4 text-accent"/>{test.testTypeName}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center"><CalendarDays className="mr-1.5 h-3 w-3"/>Performed on: {test.datePerformed}</p>
                                    {test.performedByStaffName && <p className="text-xs text-muted-foreground flex items-center"><UserCircleIcon className="mr-1.5 h-3 w-3"/>Logged by: {test.performedByStaffName}</p>}

                                    {test.testData && Object.keys(test.testData).length > 0 && (
                                        <div className="mt-1.5 space-y-0.5">
                                            <p className="text-xs font-medium">Test Specific Data:</p>
                                            {TEST_DEFINITIONS.find(def => def.id === test.testTypeId)?.fields.map(fieldDef => {
                                                const value = test.testData?.[fieldDef.id];
                                                return value !== undefined && String(value).trim() !== "" ? (
                                                    <p key={fieldDef.id} className="text-xs pl-2">
                                                        <span className="font-medium">{fieldDef.label}:</span> {String(value)}
                                                    </p>
                                                ) : null;
                                            })}
                                        </div>
                                    )}

                                    {test.overallResults && <div className="mt-1.5"><p className="text-xs font-medium">Overall Results:</p><p className="text-xs whitespace-pre-wrap">{test.overallResults}</p></div>}
                                    {test.notes && <div className="mt-1.5"><p className="text-xs font-medium">General Notes:</p><p className="text-xs whitespace-pre-wrap">{test.notes}</p></div>}
                                    <div className="mt-2 flex justify-end">
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="outline" size="sm">
                                            <ShoppingCart className="mr-2 h-3 w-3" /> Bill Test
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Create Test Bill?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This will create a new bill for the test: {test.testTypeName}.
                                              Are you sure you want to proceed?
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleCreateTestBill(test)}>
                                              Create Bill
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                    {test.attachments && test.attachments.length > 0 && (
                                        <div className="mt-2">
                                            <Label className="text-xs font-medium">Attachments:</Label>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {test.attachments.map((path, index) => (
                                                    <StoredImage key={path} path={path} linked alt={`Test attachment ${index + 1}`} className="max-h-32 max-w-[200px] rounded border object-cover" />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground/70 mt-1.5">Recorded: {format(parseISO(test.createdAt), "dd/MM/yyyy, HH:mm")}</p>
                                </Card>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground italic mt-3">No test entries added yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5 text-primary"/>Patient History & Audit Log</CardTitle>
                 <CardDescription>Record of changes made to this patient's profile and care.</CardDescription>
              </CardHeader>
              <CardContent>
                {(patient.auditLog && patient.auditLog.length > 0) ? (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="audit-log-list">
                      <AccordionTrigger className="text-sm py-2 hover:no-underline">
                        View Audit Log ({patient.auditLog.length} entr{patient.auditLog.length === 1 ? 'y' : 'ies'})
                      </AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {patient.auditLog.sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()).map((log) => (
                            <Card key={log.id} className="bg-muted/50 p-3 text-sm">
                              <p className="text-xs text-muted-foreground mb-1">
                                {format(parseISO(log.timestamp), "dd/MM/yyyy, HH:mm:ss")} by <span className="font-semibold text-foreground">{log.staffName}</span>
                              </p>
                              <p><span className="font-medium">{log.actionType}:</span> {log.changeDetails}</p>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No audit log entries yet.</p>
                )}
              </CardContent>
            </Card>


        </div>

        <div className="space-y-6"> {/* Sidebar area */}
            {currentUser && (
              <CareTeamCard patient={patient} staff={availableStaff} currentUser={currentUser} bills={patientBills} referringDoctors={availableReferringDoctors} onSaved={() => reloadPatient(patient.id)} />
            )}
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Assigned Staff</CardTitle>
                    <CardDescription>Manage staff responsible for this patient.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-3">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Currently Assigned:</h4>
                        <p className="text-sm">{getAssignedStaffNames()}</p>
                    </div>
                    {availableStaff.length > 0 ? (
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full">
                                <Users className="mr-2 h-4 w-4" /> Manage Assignments <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
                            <DropdownMenuLabel>Assign Staff</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {availableStaff.map((staff) => (
                            <DropdownMenuCheckboxItem
                                key={staff.id}
                                checked={patient.assignedStaffIds?.includes(staff.id)}
                                onCheckedChange={() => handleStaffAssignmentChange(staff.id)}
                            >
                                {staff.name} ({staff.role})
                            </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No staff members available to assign. Add staff in the Staff portal.</p>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader className="flex flex-row flex-wrap justify-between items-center gap-2 space-y-0">
                    <CardTitle className="flex items-center"><CreditCard className="mr-2 h-5 w-5 text-primary"/>Patient Bills</CardTitle>
                    <Link href={`/billing/form?patientId=${patient.id.toString().padStart(3,'0')}`} passHref>
                        <Button variant="outline" size="sm">
                            <PlusCircle className="mr-2 h-4 w-4" /> Create New Bill
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    {patientBills.length > 0 ? (
                         <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="bill-details">
                                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                    {billSummaryText}
                                </AccordionTrigger>
                                <AccordionContent className="pt-2">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Bill ID</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="hidden md:table-cell">Payment Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {patientBills.map(bill => (
                                                <TableRow key={bill.id}>
                                                    <TableCell className="font-medium">{bill.id}</TableCell>
                                                    <TableCell>{formatDateSafe(bill.billDate)}</TableCell>
                                                    <TableCell>₹{bill.totalAmount.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <span className={cn("font-semibold", {
                                                          'text-red-600': bill.paymentStatus === 'Unpaid',
                                                          'text-yellow-600': bill.paymentStatus === 'Partially Paid',
                                                          'text-emerald-600': bill.paymentStatus === 'Paid',
                                                          'text-gray-500': bill.paymentStatus === 'Cancelled',
                                                        })}>
                                                          {bill.paymentStatus || 'N/A'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                      {bill.paymentStatus === 'Paid' && bill.paymentDate ? formatDateSafe(bill.paymentDate) : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Link href={`/billing/form?billId=${bill.id}`} passHref>
                                                            <Button variant="ghost" size="sm">
                                                                <Eye className="mr-1 h-4 w-4" /> View/Edit
                                                            </Button>
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                     {patientBills.some(b => b.attachments && b.attachments.length > 0) && (
                                        <div className="mt-4">
                                            <p className="text-sm font-medium mb-2">Bill Attachments:</p>
                                            {patientBills.map(bill => bill.attachments && bill.attachments.length > 0 ? (
                                                <div key={`bill-attach-${bill.id}`} className="mb-2 text-sm">
                                                    <p className="flex items-center gap-2 text-muted-foreground"><Paperclip className="h-4 w-4"/> Bill {bill.id}</p>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                {bill.attachments.map((path, index) => (
                                                    <StoredImage key={path} path={path} linked alt={`Attachment for bill ${index + 1}`} className="h-16 w-16 rounded border object-cover" />
                                                ))}
                                            </div>
                                                </div>
                                            ) : null)}
                                        </div>
                                     )}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No bills found for this patient.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
