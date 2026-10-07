
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { extractPatientDetails } from "@/ai/flows/extract-patient-details";
import { useToast } from "@/hooks/use-toast";
import { Camera, Paperclip, Save, ChevronRight, UserCircle, Trash2, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Datepicker from "@/components/ui/datepicker";
import { format, parse, isValid } from 'date-fns';
import type { Patient, PatientCondition, AuditLogEntry } from '@/types/patient';
import { StaffMember } from '@/types/staff';
import { useAuth } from '@/context/AuthContext';


const ID_CARD_TYPES = [
  "Aadhar Card",
  "Driver's License",
  "PAN Card",
  "Voter ID",
  "Passport",
];

const GENDER_OPTIONS = [
    "Male",
    "Female",
    "Other",
];

const PATIENT_CONDITIONS: PatientCondition[] = ["Critical", "Medium", "Low", "Unassigned"];


interface SavedImage {
  filename: string;
  src: string;
}

const isValidEmail = (email: string) => {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidMobileNumber = (number: string) => {
  const mobileRegex = /^[0-9]{10}$/;
  return mobileRegex.test(number);
};

// Helper function to add audit log entries
function addAuditLogEntry(
  patientToUpdate: Patient,
  actionType: string,
  changeDetails: string,
  currentUser: StaffMember | null
): Patient {
  if (!currentUser) return patientToUpdate;

  const newLogEntry: AuditLogEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    staffId: currentUser.id,
    staffName: currentUser.name,
    actionType,
    changeDetails,
  };

  return {
    ...patientToUpdate,
    auditLog: [...(patientToUpdate.auditLog || []), newLogEntry],
  };
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  const [idCardImages, setIdCardImages] = useState<string[]>([]);
  const [patientPhotos, setPatientPhotos] = useState<string[]>([]);
  const [idCardType, setIdCardType] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [idNumber, setIdNumber] = useState<string>("");
  const [mobileNumber, setMobileNumber] = useState<string>("");
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [emergencyContactName, setEmergencyContactName] = useState<string>("");
  const [emergencyContactNumber, setEmergencyContactNumber] = useState<string>("");

  const [detailsExtracted, setDetailsExtracted] = useState(false);
  const [gender, setGender] = useState<string>("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [dateOfBirthInput, setDateOfBirthInput] = useState<string>("");
  const [patientNumber, setPatientNumber] = useState<number>(1);
  const [displayPatientId, setDisplayPatientId] = useState<string>("001");
  const [condition, setCondition] = useState<PatientCondition>("Unassigned");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [emergencyContactMobileError, setEmergencyContactMobileError] = useState<string | null>(null);

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  useEffect(() => {
    const patientIdToEditString = searchParams.get('editPatientId');
    if (patientIdToEditString) {
      setIsEditMode(true);
      const numericIdToEdit = parseInt(patientIdToEditString, 10);
      setEditingPatientId(numericIdToEdit.toString()); // Keep as string for consistency if used for display logic
      const storedPatients = localStorage.getItem('patients');
      if (storedPatients) {
        let rawPatients = JSON.parse(storedPatients);
        const patients: Patient[] = rawPatients.map((p: any) => ({
            ...p,
            id: parseInt(p.id, 10),
            careNotes: Array.isArray(p.careNotes) ? p.careNotes : [],
            assignedStaffIds: Array.isArray(p.assignedStaffIds) ? p.assignedStaffIds : [],
            tests: Array.isArray(p.tests) ? p.tests : [],
            auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
        }));

        const patientToEdit = patients.find(p => p.id === numericIdToEdit);
        if (patientToEdit) {
          setFirstName(patientToEdit.firstName);
          setLastName(patientToEdit.lastName);
          setGender(patientToEdit.gender);
          if (patientToEdit.dateOfBirth) {
            setDateOfBirthInput(patientToEdit.dateOfBirth);
            try {
              const parsedDate = parse(patientToEdit.dateOfBirth, 'dd/MM/yyyy', new Date());
              if (isValid(parsedDate)) {
                setDateOfBirth(parsedDate);
              }
            } catch (e) { console.error("Error parsing DOB for edit:", e); }
          }
          setMobileNumber(patientToEdit.mobileNumber);
          setEmailAddress(patientToEdit.emailAddress || "");
          setAddress(patientToEdit.address || "");
          setIdNumber(patientToEdit.idNumber);
          setEmergencyContactName(patientToEdit.emergencyContactName);
          setEmergencyContactNumber(patientToEdit.emergencyContactNumber);
          setCondition(patientToEdit.condition || "Unassigned");
          setIdCardImages(patientToEdit.imageSrc ? [patientToEdit.imageSrc] : []);
          setPatientPhotos(patientToEdit.patientPhotoDataUrl ? [patientToEdit.patientPhotoDataUrl] : []);
          setIdCardType(patientToEdit.idCardType || "");
          setDisplayPatientId(patientToEdit.id.toString().padStart(3, '0'));
        } else {
          toast({ title: "Error", description: "Patient to edit not found.", variant: "destructive" });
          router.push('/');
        }
      }
    } else {
      const storedPatientNumber = localStorage.getItem('nextPatientNumber');
      const nextNum = storedPatientNumber ? parseInt(storedPatientNumber, 10) : 1;
      setPatientNumber(nextNum);
      setDisplayPatientId(String(nextNum).padStart(3, '0'));
      setIsEditMode(false);
      setEditingPatientId(null);
      resetForm(nextNum); // Pass nextNum to resetForm
    }
  }, [searchParams, router, toast]);


  // Adjusted resetForm to potentially take nextPatientNum
  const resetForm = (nextPatientNum?: number) => {
    setIdCardImages([]);
    setPatientPhotos([]);
    setIdCardType("");
    setFirstName("");
    setLastName("");
    setGender("");
    setDateOfBirth(null);
    setDateOfBirthInput("");
    setMobileNumber("");
    setEmailAddress("");
    setAddress("");
    setIdNumber("");
    setEmergencyContactName("");
    setEmergencyContactNumber("");
    setCondition("Unassigned");
    setDetailsExtracted(false);
    setEmailError(null);
    setMobileError(null);
    setEmergencyContactMobileError(null);

    if (!isEditMode) {
        const numToSet = nextPatientNum || (localStorage.getItem('nextPatientNumber') ? parseInt(localStorage.getItem('nextPatientNumber')!, 10) : 1);
        setPatientNumber(numToSet);
        setDisplayPatientId(String(numToSet).padStart(3, '0'));
    } else if (editingPatientId) {
        setDisplayPatientId(editingPatientId.toString().padStart(3,'0'));
    }
  };


  const captureImageFromAttachment = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (event: any) => {
      const files = Array.from(event.target.files || []) as File[];
      if (files.length > 0) {
        const newImages: string[] = [];
        for (const file of files) {
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onload = (e) => {
              const result = e.target?.result;
              if (typeof result === 'string') {
                newImages.push(result);
              }
              resolve(null);
            };
            reader.readAsDataURL(file);
          });
        }
        setIdCardImages(prev => [...prev, ...newImages]);
        setDetailsExtracted(false);
        toast({ title: "ID Card Images Uploaded", description: `${files.length} image(s) added successfully.` });
      }
    };
    input.click();
  }, [toast]);

  const uploadPatientPhoto = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (event: any) => {
      const files = Array.from(event.target.files || []) as File[];
      if (files.length > 0) {
        const newPhotos: string[] = [];
        for (const file of files) {
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onload = (e) => {
              const result = e.target?.result;
              if (typeof result === 'string') {
                newPhotos.push(result);
              }
              resolve(null);
            };
            reader.readAsDataURL(file);
          });
        }
        setPatientPhotos(prev => [...prev, ...newPhotos]);
        toast({ title: "Patient Photos Uploaded", description: `${files.length} photo(s) added successfully.` });
      }
    };
    input.click();
  }, [toast]);

  const removeIdCardImage = useCallback((index: number) => {
    setIdCardImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removePatientPhoto = useCallback((index: number) => {
    setPatientPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleExtractDetails = async () => {
    if (idCardImages.length === 0 || !idCardType) {
      toast({
        title: "Error",
        description: "Please upload an ID card image and select ID card type.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({ title: "Extracting Details...", description: "Please wait while we process the first image." });
      const result = await extractPatientDetails({
        imageBase64: idCardImages[0],
        idCardType: idCardType,
      });

      if (result.identityData) {
        setFirstName(result.identityData.name.split(' ')[0] || "");
        setLastName(result.identityData.name.split(' ').slice(1).join(' ') || "");
        setAddress(result.identityData.address || "");
        setIdNumber(result.identityData.idNumber || "");

        if (result.identityData.dateOfBirth) {
            setDateOfBirthInput(result.identityData.dateOfBirth);
            try {
                const parsedDate = parse(result.identityData.dateOfBirth, 'dd/MM/yyyy', new Date());
                if (isValid(parsedDate)) {
                    setDateOfBirth(parsedDate);
                } else {
                    setDateOfBirth(null);
                    toast({ title: "Warning", description: "Extracted Date of Birth is invalid. Please verify. Format: dd/MM/yyyy", variant: "default" });
                }
            } catch (error) {
                console.error("Error parsing date from AI:", error);
                setDateOfBirth(null);
                setDateOfBirthInput(result.identityData.dateOfBirth);
                toast({ title: "Error", description: "Could not parse extracted Date of Birth. Please verify.", variant: "destructive" });
            }
        } else {
            setDateOfBirth(null);
            setDateOfBirthInput("");
        }

        toast({
            title: "Details Extracted",
            description: "Patient details extracted successfully. Review and save.",
        });
        setDetailsExtracted(true);
      } else {
        toast({
            title: "Extraction Failed",
            description: "Could not extract patient details from the image.",
            variant: "destructive",
        });
        setDetailsExtracted(false);
      }
    } catch (error) {
      console.error("Error extracting details:", error);
      toast({
        title: "Error",
        description: "Failed to extract details. Please try again.",
        variant: "destructive",
      });
      setDetailsExtracted(false);
    }
  };

  const handleSaveIdCardImage = () => {
    if (idCardImages.length === 0 || !idCardType) {
      toast({
        title: "Error",
        description: "Please upload an ID card image and select ID card type.",
        variant: "destructive",
      });
      return;
    }
    if (!firstName && detailsExtracted) {
        toast({
            title: "Missing Name",
            description: "Please ensure First Name is available or extracted before saving image.",
            variant: "destructive"
        });
        return;
    }
    saveIdCardImageToFile(idCardImages[0], idCardType, firstName || "Patient_IDScan");
  };


  const saveIdCardImageToFile = (currentImageSrc: string, currentIdCardType: string, currentFirstName: string) => {
    const filename = `${currentFirstName.replace(/ /g, '_')}_${currentIdCardType.replace(/ /g, '_')}_${Date.now()}.png`;

    const link = document.createElement('a');
    link.href = currentImageSrc;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "ID Card Image Saved",
      description: `ID Card image downloaded as ${filename}`,
    });
  };


  const validateAndCreatePatientObject = (): Omit<Patient, 'id' | 'careNotes' | 'assignedStaffIds' | 'admissionDate' | 'referredDoctorId' | 'reasonForVisit' | 'initialObservationsText' | 'initialObservationAttachmentDataUrl' | 'admissionCondition' | 'tests' | 'auditLog'> & { id?: number } | null => {
    let hasError = false;
    if (!firstName) { toast({ title: "Validation Error", description: "First Name is required.", variant: "destructive" }); hasError = true; }
    if (!lastName) { toast({ title: "Validation Error", description: "Last Name is required.", variant: "destructive" }); hasError = true; }
    if (!gender) { toast({ title: "Validation Error", description: "Gender is required.", variant: "destructive" }); hasError = true; }
    if (!condition) { toast({ title: "Validation Error", description: "Patient Condition is required.", variant: "destructive" }); hasError = true; }

    let finalDateOfBirthString = "";
    if (dateOfBirth) {
        finalDateOfBirthString = format(dateOfBirth, 'dd/MM/yyyy');
    } else if (dateOfBirthInput) {
         try {
            const parsed = parse(dateOfBirthInput, 'dd/MM/yyyy', new Date());
            if(!isValid(parsed) || format(parsed, 'dd/MM/yyyy') !== dateOfBirthInput) {
                 toast({ title: "Validation Error", description: "Date of Birth must be in dd/MM/yyyy format.", variant: "destructive" }); hasError = true;
            } else {
              finalDateOfBirthString = dateOfBirthInput;
            }
        } catch {
            toast({ title: "Validation Error", description: "Date of Birth must be in dd/MM/yyyy format.", variant: "destructive" }); hasError = true;
        }
    } else {
        toast({ title: "Validation Error", description: "Date of Birth is required.", variant: "destructive" }); hasError = true;
    }

    if (!isValidMobileNumber(mobileNumber)) {
        setMobileError("Mobile number must be 10 digits."); hasError = true;
    } else {
        setMobileError(null);
    }
    if (emailAddress && !isValidEmail(emailAddress)) {
        setEmailError("Please enter a valid email address."); hasError = true;
    } else {
        setEmailError(null);
    }
    if (!idNumber) { toast({ title: "Validation Error", description: "ID Number is required.", variant: "destructive" }); hasError = true; }
    if (!emergencyContactName) { toast({ title: "Validation Error", description: "Emergency Contact Name is required.", variant: "destructive" }); hasError = true; }
    if (!isValidMobileNumber(emergencyContactNumber)) {
        setEmergencyContactMobileError("Emergency contact mobile must be 10 digits."); hasError = true;
    } else {
        setEmergencyContactMobileError(null);
    }

    if (hasError) {
      toast({
            title: "Error",
            description: "Please correct the highlighted fields.",
            variant: "destructive",
        });
      return null;
    }

    return {
      firstName,
      lastName,
      gender,
      dateOfBirth: finalDateOfBirthString,
      mobileNumber,
      emailAddress: emailAddress || "",
      address: address || "",
      idNumber,
      emergencyContactName,
      emergencyContactNumber,
      condition: condition,
      imageSrc: idCardImages.length > 0 ? idCardImages[0] : null,
      patientPhotoDataUrl: patientPhotos.length > 0 ? patientPhotos[0] : null,
      idCardType: idCardType,
    };
  };

  const handleSavePatient = () => {
    const patientData = validateAndCreatePatientObject();
    if (!patientData || !currentUser) return;

    try {
      const existingPatientsJSON = localStorage.getItem('patients');
      let patients: Patient[] = existingPatientsJSON ? JSON.parse(existingPatientsJSON) : [];

      if (isEditMode && editingPatientId) {
        const patientIdToUpdate = parseInt(editingPatientId, 10);
        const patientIndex = patients.findIndex(p => p.id === patientIdToUpdate);
        if (patientIndex > -1) {
          let existingPatient = patients[patientIndex];
          existingPatient = {
            ...existingPatient,
            ...patientData,
            id: patientIdToUpdate
          };
          existingPatient = addAuditLogEntry(existingPatient, "Patient Details Updated", "Patient basic details updated.", currentUser);
          patients[patientIndex] = existingPatient;

          localStorage.setItem('patients', JSON.stringify(patients));
          toast({
            title: "Success",
            description: `Patient ${patientData.firstName} ${patientData.lastName} (ID: ${patientIdToUpdate.toString().padStart(3,'0')}) updated.`,
          });
          router.push(`/patients/${patientIdToUpdate.toString().padStart(3,'0')}`);
        } else {
          toast({ title: "Error", description: "Could not find patient to update.", variant: "destructive"});
        }
      } else {
        const currentPatientId = patientNumber;
        let newPatient: Patient = {
          ...patientData,
          id: currentPatientId,
          careNotes: [],
          assignedStaffIds: [],
          tests: [],
          auditLog: [],
          admissionDate: undefined,
          referredDoctorId: undefined,
          reasonForVisit: undefined,
          initialObservationsText: undefined,
          initialObservationAttachmentDataUrl: undefined,
          admissionCondition: "",
        };
        newPatient = addAuditLogEntry(newPatient, "Patient Registered", `New patient ${newPatient.firstName} ${newPatient.lastName} registered.`, currentUser);
        patients.push(newPatient);
        localStorage.setItem('patients', JSON.stringify(patients));
        toast({
            title: "Success",
            description: `Patient ${newPatient.firstName} ${newPatient.lastName} (ID: ${displayPatientId}) saved.`,
        });
        const nextNumForStorage = currentPatientId + 1;
        localStorage.setItem('nextPatientNumber', nextNumForStorage.toString());
        resetForm(nextNumForStorage); // Pass the next number to resetForm
        router.push('/');
      }
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        toast({
          title: "Storage Full",
          description: "Cannot save patient data. Local storage is full, likely due to many image attachments. Please remove some images or contact support.",
          variant: "destructive",
        });
      } else {
        console.error("Failed to save patient to localStorage", e);
        toast({
          title: "Storage Error",
          description: "Could not save patient data. An unexpected error occurred.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSaveAndProceed = () => {
    const patientData = validateAndCreatePatientObject();
    if (!patientData || !currentUser) return;

    try {
      const existingPatientsJSON = localStorage.getItem('patients');
      let patients: Patient[] = existingPatientsJSON ? JSON.parse(existingPatientsJSON) : [];
      let patientIdToProceedWithNumber: number;
      let actionType = "Patient Registered & Proceeded to Admission";
      let actionDetails = `Patient ${patientData.firstName} ${patientData.lastName} basic details saved, proceeding to admission.`;


      if (isEditMode && editingPatientId) {
         const patientIdToUpdate = parseInt(editingPatientId, 10);
         const patientIndex = patients.findIndex(p => p.id === patientIdToUpdate);
        if (patientIndex > -1) {
          let existingPatient = patients[patientIndex];
          existingPatient = {
            ...existingPatient,
            ...patientData,
            id: patientIdToUpdate
          };
          actionType = "Patient Details Updated & Proceeded to Admission";
          actionDetails = `Patient ${patientData.firstName} ${patientData.lastName} basic details updated, proceeding to admission.`;
          existingPatient = addAuditLogEntry(existingPatient, actionType, actionDetails, currentUser);
          patients[patientIndex] = existingPatient;

          patientIdToProceedWithNumber = patientIdToUpdate;
          localStorage.setItem('patients', JSON.stringify(patients));
          toast({
              title: "Patient Updated",
              description: `Basic details for ${patientData.firstName} (ID: ${patientIdToUpdate.toString().padStart(3,'0')}) updated. Proceeding to admission notes.`,
          });
        } else {
           toast({ title: "Error", description: "Could not find patient to update.", variant: "destructive"});
           return;
        }
      } else {
        const currentPatientId = patientNumber;
        let newPatient: Patient = {
          ...patientData,
          id: currentPatientId,
          careNotes: [],
          assignedStaffIds: [],
          tests: [],
          auditLog: [],
          admissionDate: undefined,
          referredDoctorId: undefined,
          reasonForVisit: undefined,
          initialObservationsText: undefined,
          initialObservationAttachmentDataUrl: undefined,
          admissionCondition: "",
        };
        newPatient = addAuditLogEntry(newPatient, actionType, actionDetails, currentUser);
        patients.push(newPatient);
        patientIdToProceedWithNumber = newPatient.id;
        localStorage.setItem('patients', JSON.stringify(patients));
        toast({
            title: "Patient Saved",
            description: `Basic details for ${newPatient.firstName} (ID: ${patientIdToProceedWithNumber.toString().padStart(3,'0')}) saved. Proceeding to admission notes.`,
        });
        const nextNumForStorage = currentPatientId + 1;
        localStorage.setItem('nextPatientNumber', nextNumForStorage.toString());
        resetForm(nextNumForStorage); // Pass the next number
      }

      router.push(`/patients/${patientIdToProceedWithNumber.toString().padStart(3,'0')}/admission`);

    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        toast({
          title: "Storage Full",
          description: "Cannot save patient data. Local storage is full, likely due to many image attachments. Please remove some images or contact support.",
          variant: "destructive",
        });
      } else {
        console.error("Failed to save patient to localStorage", e);
        toast({
          title: "Storage Error",
          description: "Could not save patient data. An unexpected error occurred.",
          variant: "destructive",
        });
      }
    }
  };


  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDateOfBirthInput(val);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        try {
            const parsedDate = parse(val, 'dd/MM/yyyy', new Date());
            if (isValid(parsedDate)) {
                setDateOfBirth(parsedDate);
            } else {
                setDateOfBirth(null);
            }
        } catch (error) {
            setDateOfBirth(null);
        }
    } else {
        setDateOfBirth(null);
    }
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDateOfBirth(selectedDate || null);
    if (selectedDate) {
        setDateOfBirthInput(format(selectedDate, 'dd/MM/yyyy'));
    } else {
        setDateOfBirthInput("");
    }
  };

  if (authIsLoading || !currentUser) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-lg space-y-4 bg-card rounded-lg shadow-xl p-6">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="text-2xl text-center">{isEditMode ? `Edit Patient: ${displayPatientId}` : "Patient Information Intake"}</CardTitle>
          <CardDescription className="text-center">
            {isEditMode ? "Update the patient's details below." : "Capture and enter patient details for efficient processing."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-0">

          <div>
              <Label htmlFor="patientNumber">{isEditMode ? "Patient ID" : "Next Patient Number"}</Label>
              <Input type="text" id="patientNumber" value={displayPatientId} readOnly className="bg-muted" />
          </div>

          <div>
            <Label htmlFor="patientPhoto">Patient Photo(s)</Label>
            <div className="flex items-center gap-3 mt-1">
              <Button type="button" variant="outline" onClick={uploadPatientPhoto} className="flex-1">
                <Paperclip className="mr-2 h-4 w-4" /> {patientPhotos.length > 0 ? `Add More (${patientPhotos.length})` : "Upload Photos"}
              </Button>
            </div>
            {patientPhotos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {patientPhotos.map((photo, index) => (
                  <div key={index} className="relative border rounded-md p-1">
                    <img src={photo} alt={`Patient Photo ${index + 1}`} className="rounded-md w-full h-20 object-cover" data-ai-hint="person portrait" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                      onClick={() => removePatientPhoto(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Label className="mt-4 font-semibold text-md">ID Card Details</Label>
          <div>
            <Button variant="outline" onClick={captureImageFromAttachment} className="w-full">
              <Paperclip className="mr-2 h-4 w-4" />
              {idCardImages.length > 0 ? `Add More ID Images (${idCardImages.length})` : "Upload ID Images"}
            </Button>
          </div>

          {idCardImages.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {idCardImages.map((image, index) => (
                <div key={index} className="relative border p-2 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">ID Card {index + 1}:</p>
                  <img src={image} alt={`ID Card ${index + 1}`} className="rounded-md w-full h-auto object-cover max-h-40" data-ai-hint="identity card" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => removeIdCardImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Select onValueChange={setIdCardType} value={idCardType} required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select ID Card Type *" />
            </SelectTrigger>
            <SelectContent>
              {ID_CARD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleExtractDetails} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={idCardImages.length === 0 || !idCardType}>
            Extract Details from First ID Image
          </Button>

          {detailsExtracted && idCardImages.length > 0 && (
              <Button onClick={handleSaveIdCardImage} className="w-full bg-blue-500 text-white hover:bg-blue-600">
                Download First ID Image
              </Button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="w-full">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select onValueChange={setGender} value={gender} required>
                      <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Gender" />
                      </SelectTrigger>
                      <SelectContent>
                          {GENDER_OPTIONS.map((genderOption) => (
                              <SelectItem key={genderOption} value={genderOption}>
                                  {genderOption}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
              <div className="w-full">
                <Label htmlFor="dateOfBirth">Date of Birth (dd/MM/yyyy) *</Label>
                <div className="flex items-center">
                    <Input
                        type="text"
                        id="dateOfBirth"
                        placeholder="dd/MM/yyyy"
                        value={dateOfBirthInput}
                        onChange={handleDateInputChange}
                        className="rounded-r-none"
                        required
                    />
                    <Datepicker
                        selected={dateOfBirth}
                        onDateChange={handleDateSelect}
                        triggerClassName="rounded-l-none border-l-0 w-auto p-2.5"
                    />
                </div>
              </div>
          </div>

           <div>
            <Label htmlFor="mobileNumber">Mobile Number *</Label>
             <Input
                type="tel"
                id="mobileNumber"
                value={mobileNumber}
                onChange={(e) => {
                    setMobileNumber(e.target.value);
                    if (e.target.value && !isValidMobileNumber(e.target.value)) {
                        setMobileError("Please enter a valid 10-digit mobile number.");
                    } else {
                        setMobileError(null);
                    }
                }}
                required
            />
            {mobileError && <p className="text-destructive text-sm mt-1">{mobileError}</p>}
          </div>

          <div>
            <Label htmlFor="emailAddress">Email Address</Label>
              <Input
                  type="email"
                  id="emailAddress"
                  value={emailAddress}
                  onChange={(e) => {
                      setEmailAddress(e.target.value);
                      if (e.target.value && !isValidEmail(e.target.value)) {
                          setEmailError("Please enter a valid email address.");
                      } else {
                          setEmailError(null);
                      }
                  }}
              />
              {emailError && <p className="text-destructive text-sm mt-1">{emailError}</p>}
          </div>


          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="idNumber">ID Number (from card) *</Label>
            <Input type="text" id="idNumber" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="condition">Patient Condition *</Label>
            <Select onValueChange={(value) => setCondition(value as PatientCondition)} value={condition} required>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Patient Condition" />
                </SelectTrigger>
                <SelectContent>
                    {PATIENT_CONDITIONS.filter(c => c !== 'Discharged').map((level) => (
                        <SelectItem key={level} value={level}>
                            {level}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          <Card className="p-4 bg-muted">
            <CardTitle className="text-lg mb-2">Emergency Contact</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <Label htmlFor="emergencyContactName">Name *</Label>
                <Input type="text" id="emergencyContactName" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} required />
                </div>
                <div>
                <Label htmlFor="emergencyContactNumber">Mobile *</Label>
                <Input
                    type="tel"
                    id="emergencyContactNumber"
                    value={emergencyContactNumber}
                    onChange={(e) => {
                        setEmergencyContactNumber(e.target.value);
                        if (e.target.value && !isValidMobileNumber(e.target.value)) {
                            setEmergencyContactMobileError("Please enter a valid 10-digit mobile number.");
                        } else {
                            setEmergencyContactMobileError(null);
                        }
                    }}
                    required
                />
                {emergencyContactMobileError && <p className="text-destructive text-sm mt-1">{emergencyContactMobileError}</p>}
                </div>
            </div>
          </Card>

           <Button onClick={handleSavePatient} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-3">
                <Save className="mr-2 h-5 w-5" /> {isEditMode ? "Update Patient Record" : "Save Patient Record"}
            </Button>

            <Button onClick={handleSaveAndProceed} variant="default" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg py-3">
                 {isEditMode ? "Update & View Admission Notes" : "Save & Add Admission Notes"} <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
