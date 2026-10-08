
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
import { compressImageFiles } from '@/lib/images';
import { getSignedImageUrl, uploadNewImages } from '@/lib/storage';
import { StoredImage } from '@/components/stored-image';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { isAadhaarCard, maskAadhaarNumber } from '@/lib/aadhaar';
import { patients as patientsRepo, type PatientFields } from '@/lib/data';


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

// Bump when the consent wording below changes, so records show which text was agreed to.
const CONSENT_VERSION = "2026-10-v1";
const CONSENT_TEXT = "The patient (or their guardian) consents to the clinic collecting and using their personal and health information for treatment, billing and follow-up, as required under the Digital Personal Data Protection Act, 2023.";

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
  const [displayPatientId, setDisplayPatientId] = useState<string>("Assigned when saved");
  const [consentGiven, setConsentGiven] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
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
      patientsRepo.get(numericIdToEdit).then(patientToEdit => {
      {
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
          setIdCardImages(patientToEdit.idCardImages || []);
          setPatientPhotos(patientToEdit.patientPhotos || []);
          setConsentGiven(!!patientToEdit.consentGivenAt);
          setIdCardType(patientToEdit.idCardType || "");
          setDisplayPatientId(patientToEdit.id.toString().padStart(3, '0'));
        } else {
          toast({ title: "Error", description: "Patient to edit not found.", variant: "destructive" });
          router.push('/');
        }
      }
      }).catch(error => {
        console.error("Error loading patient:", error);
        toast({ title: "Error", description: "Could not load patient.", variant: "destructive" });
      });
    } else {
      setIsEditMode(false);
      setEditingPatientId(null);
      resetForm();
    }
  }, [searchParams, router, toast]);


  // Adjusted resetForm to potentially take nextPatientNum
  const resetForm = () => {
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
    setConsentGiven(false);
    setFieldErrors({});

    if (!isEditMode) {
        // New patients get their number from the database when saved.
        setDisplayPatientId("Assigned when saved");
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
        const newImages = await compressImageFiles(files);
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
        const newPhotos = await compressImageFiles(files);
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

  // Extraction needs the image itself; images already saved are fetched back from storage.
  const toDataUrl = async (image: string): Promise<string> => {
    if (image.startsWith('data:')) return image;
    const url = await getSignedImageUrl(image);
    if (!url) throw new Error('Could not load the saved ID image.');
    const blob = await (await fetch(url)).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  };

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
        imageBase64: await toDataUrl(idCardImages[0]),
        idCardType: idCardType,
      });

      if (result.identityData) {
        setFirstName(result.identityData.name.split(' ')[0] || "");
        setLastName(result.identityData.name.split(' ').slice(1).join(' ') || "");
        setAddress(result.identityData.address || "");
        const extractedIdNumber = result.identityData.idNumber || "";
        setIdNumber(isAadhaarCard(idCardType) ? maskAadhaarNumber(extractedIdNumber) : extractedIdNumber);

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
    if (isAadhaarCard(idCardType)) {
      toast({ title: "Not Allowed", description: "Aadhaar card copies must not be stored. Only the masked number is kept.", variant: "destructive" });
      return;
    }
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


  const saveIdCardImageToFile = async (storedImage: string, currentIdCardType: string, currentFirstName: string) => {
    const currentImageSrc = storedImage.startsWith('data:') ? storedImage : await getSignedImageUrl(storedImage);
    if (!currentImageSrc) return;
    const extension = currentImageSrc.startsWith('data:image/png') ? 'png' : 'jpg';
    const filename = `${currentFirstName.replace(/ /g, '_')}_${currentIdCardType.replace(/ /g, '_')}_${Date.now()}.${extension}`;

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


  const clearFieldError = (field: string) =>
    setFieldErrors(prev => (prev[field] ? { ...prev, [field]: "" } : prev));

  const validateAndCreatePatientObject = (): Pick<PatientFields, 'firstName' | 'lastName' | 'gender' | 'dateOfBirth' | 'mobileNumber' | 'emailAddress' | 'address' | 'idNumber' | 'emergencyContactName' | 'emergencyContactNumber' | 'condition' | 'idCardType'> | null => {
    // Field id -> message, shown under the field and listed in the error message.
    const errors: Record<string, string> = {};
    if (!firstName.trim()) errors.firstName = "First Name is required.";
    if (!lastName.trim()) errors.lastName = "Last Name is required.";
    if (!gender) errors.gender = "Select a gender.";

    let finalDateOfBirthString = "";
    if (dateOfBirth) {
        finalDateOfBirthString = format(dateOfBirth, 'dd/MM/yyyy');
    } else if (dateOfBirthInput.trim()) {
        const parsed = parse(dateOfBirthInput.trim(), 'dd/MM/yyyy', new Date());
        if (isValid(parsed) && format(parsed, 'dd/MM/yyyy') === dateOfBirthInput.trim()) {
            finalDateOfBirthString = dateOfBirthInput.trim();
        } else {
            const parts = dateOfBirthInput.trim().split('/').map(Number);
            errors.dateOfBirth = parts.length === 3 && parts[0] <= 12 && parts[1] > 12
              ? `This looks like month/day/year. Enter the day first: ${String(parts[1]).padStart(2, '0')}/${String(parts[0]).padStart(2, '0')}/${parts[2]}.`
              : "Enter the date as day/month/year, e.g. 25/12/1980, or use the calendar.";
        }
    } else {
        errors.dateOfBirth = "Date of Birth is required.";
    }

    if (!isValidMobileNumber(mobileNumber)) errors.mobileNumber = "Mobile number must be 10 digits.";
    if (emailAddress && !isValidEmail(emailAddress)) errors.emailAddress = "Please enter a valid email address.";
    if (!idNumber.trim()) errors.idNumber = "ID Number is required.";
    if (!condition) errors.condition = "Select the patient's condition.";
    if (!emergencyContactName.trim()) errors.emergencyContactName = "Emergency contact name is required.";
    if (!isValidMobileNumber(emergencyContactNumber)) errors.emergencyContactNumber = "Emergency contact mobile must be 10 digits.";
    if (!isEditMode && !consentGiven) errors.consent = "Tick the box to record the patient's consent.";

    setFieldErrors(errors);
    setMobileError(errors.mobileNumber ?? null);
    setEmailError(errors.emailAddress ?? null);
    setEmergencyContactMobileError(errors.emergencyContactNumber ?? null);

    const messages = Object.values(errors);
    if (messages.length > 0) {
      toast({
        title: messages.length === 1 ? "Please fix this field" : `Please fix ${messages.length} fields`,
        description: messages.join(" "),
        variant: "destructive",
      });
      // Bring the first problem into view (useful on phones where it may be off-screen).
      const first = document.getElementById(Object.keys(errors)[0]);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.focus({ preventScroll: true });
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
      // Never keep a full Aadhaar number (UIDAI); only the last four digits.
      idNumber: isAadhaarCard(idCardType) ? maskAadhaarNumber(idNumber) : idNumber,
      emergencyContactName,
      emergencyContactNumber,
      condition: condition,
      idCardType: idCardType,
    };
  };

  // Uploads new images under the patient's folder. Aadhaar card images are never stored.
  const uploadPatientImages = async (patientId: number) => ({
    idCardImages: isAadhaarCard(idCardType) ? [] : await uploadNewImages(idCardImages, `patients/${patientId}/id-card`),
    patientPhotos: await uploadNewImages(patientPhotos, `patients/${patientId}/photo`),
  });

  const savePatient = async (proceedToAdmission: boolean) => {
    const patientData = validateAndCreatePatientObject();
    if (!patientData || !currentUser) return;

    setIsSaving(true);
    try {
      if (isEditMode && editingPatientId) {
        const patientIdToUpdate = parseInt(editingPatientId, 10);
        await patientsRepo.update(patientIdToUpdate, {
          ...patientData,
          ...(await uploadPatientImages(patientIdToUpdate)),
        }, proceedToAdmission
          ? { actionType: "Patient Details Updated & Proceeded to Admission", details: `Patient ${patientData.firstName} ${patientData.lastName} basic details updated, proceeding to admission.` }
          : { actionType: "Patient Details Updated", details: "Patient basic details updated." });

        const displayId = patientIdToUpdate.toString().padStart(3,'0');
        if (proceedToAdmission) {
          toast({ title: "Patient Updated", description: `Basic details for ${patientData.firstName} (ID: ${displayId}) updated. Proceeding to admission notes.` });
          router.push(`/patients/${displayId}/admission`);
        } else {
          toast({ title: "Success", description: `Patient ${patientData.firstName} ${patientData.lastName} (ID: ${displayId}) updated.` });
          router.push(`/patients/${displayId}`);
        }
      } else {
        const newPatient = await patientsRepo.create({
          ...patientData,
          assignedStaffIds: [],
          admissionCondition: "",
          consentGivenAt: new Date().toISOString(),
          consentVersion: CONSENT_VERSION,
          consentRecordedByStaffId: currentUser.id,
        }, proceedToAdmission
          ? { actionType: "Patient Registered & Proceeded to Admission", details: `Patient ${patientData.firstName} ${patientData.lastName} basic details saved, proceeding to admission.` }
          : { actionType: "Patient Registered", details: `New patient ${patientData.firstName} ${patientData.lastName} registered.` });

        // Images are filed under the patient's ID, which only exists after the insert.
        const images = await uploadPatientImages(newPatient.id);
        if (images.idCardImages.length > 0 || images.patientPhotos.length > 0) {
          await patientsRepo.update(newPatient.id, images, { actionType: "Images Added", details: "ID card and/or patient photos saved." });
        }

        const displayId = newPatient.id.toString().padStart(3,'0');
        resetForm();
        if (proceedToAdmission) {
          toast({ title: "Patient Saved", description: `Basic details for ${patientData.firstName} (ID: ${displayId}) saved. Proceeding to admission notes.` });
          router.push(`/patients/${displayId}/admission`);
        } else {
          toast({ title: "Success", description: `Patient ${patientData.firstName} ${patientData.lastName} (ID: ${displayId}) saved.` });
          router.push('/');
        }
      }
    } catch (e) {
      console.error("Failed to save patient", e);
      toast({
        title: "Save Error",
        description: e instanceof Error ? e.message : "Could not save patient data. An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePatient = () => savePatient(false);
  const handleSaveAndProceed = () => savePatient(true);

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
                    <StoredImage path={photo} alt={`Patient Photo ${index + 1}`} className="rounded-md w-full h-20 object-cover" />
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
                  <StoredImage path={image} alt={`ID Card ${index + 1}`} className="rounded-md w-full h-auto object-cover max-h-40" />
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

          {isAadhaarCard(idCardType) && (
            <Alert>
              <AlertTitle>Aadhaar privacy</AlertTitle>
              <AlertDescription>
                The Aadhaar card image is used only to read the details and is not saved. Only the last 4 digits of the Aadhaar number are stored.
              </AlertDescription>
            </Alert>
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

          {detailsExtracted && idCardImages.length > 0 && !isAadhaarCard(idCardType) && (
              <Button onClick={handleSaveIdCardImage} className="w-full bg-blue-500 text-white hover:bg-blue-600">
                Download First ID Image
              </Button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input type="text" id="firstName" value={firstName} onChange={(e) => { setFirstName(e.target.value); clearFieldError("firstName"); }} aria-invalid={!!fieldErrors.firstName} className={fieldErrors.firstName ? "border-destructive" : undefined} required />
              {fieldErrors.firstName && <p className="text-destructive text-sm mt-1">{fieldErrors.firstName}</p>}
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input type="text" id="lastName" value={lastName} onChange={(e) => { setLastName(e.target.value); clearFieldError("lastName"); }} aria-invalid={!!fieldErrors.lastName} className={fieldErrors.lastName ? "border-destructive" : undefined} required />
              {fieldErrors.lastName && <p className="text-destructive text-sm mt-1">{fieldErrors.lastName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="w-full">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select onValueChange={(value) => { setGender(value); clearFieldError("gender"); }} value={gender} required>
                      <SelectTrigger id="gender" aria-invalid={!!fieldErrors.gender} className={cn("w-full", fieldErrors.gender && "border-destructive")}>
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
                  {fieldErrors.gender && <p className="text-destructive text-sm mt-1">{fieldErrors.gender}</p>}
              </div>
              <div className="w-full">
                <Label htmlFor="dateOfBirth">Date of Birth (dd/MM/yyyy) *</Label>
                <div className="flex items-center">
                    <Input
                        type="text"
                        id="dateOfBirth"
                        placeholder="dd/MM/yyyy"
                        value={dateOfBirthInput}
                        onChange={(e) => { handleDateInputChange(e); clearFieldError("dateOfBirth"); }}
                        aria-invalid={!!fieldErrors.dateOfBirth}
                        className={cn("rounded-r-none", fieldErrors.dateOfBirth && "border-destructive")}
                        required
                    />
                    <Datepicker
                        selected={dateOfBirth}
                        onDateChange={(date) => { handleDateSelect(date); clearFieldError("dateOfBirth"); }}
                        defaultMonth={new Date(1980, 0, 1)}
                        triggerClassName="rounded-l-none border-l-0 w-auto p-2.5"
                    />
                </div>
                {fieldErrors.dateOfBirth
                  ? <p className="text-destructive text-sm mt-1">{fieldErrors.dateOfBirth}</p>
                  : dateOfBirth && <p className="text-xs text-muted-foreground mt-1">Reads as {format(dateOfBirth, 'd MMMM yyyy')}</p>}
              </div>
          </div>

           <div>
            <Label htmlFor="mobileNumber">Mobile Number *</Label>
             <Input
                type="tel"
                id="mobileNumber"
                aria-invalid={!!mobileError}
                className={mobileError ? "border-destructive" : undefined}
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
            <Input type="text" id="idNumber" value={idNumber} onChange={(e) => { setIdNumber(e.target.value); clearFieldError("idNumber"); }} aria-invalid={!!fieldErrors.idNumber} className={fieldErrors.idNumber ? "border-destructive" : undefined} onBlur={() => { if (isAadhaarCard(idCardType)) setIdNumber(maskAadhaarNumber(idNumber)); }} required />
            {isAadhaarCard(idCardType) && <p className="text-xs text-muted-foreground mt-1">Saved masked as XXXX XXXX 1234.</p>}
            {fieldErrors.idNumber && <p className="text-destructive text-sm mt-1">{fieldErrors.idNumber}</p>}
          </div>

          <div>
            <Label htmlFor="condition">Patient Condition *</Label>
            <Select onValueChange={(value) => { setCondition(value as PatientCondition); clearFieldError("condition"); }} value={condition} required>
                <SelectTrigger id="condition" aria-invalid={!!fieldErrors.condition} className={cn("w-full", fieldErrors.condition && "border-destructive")}>
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
            {fieldErrors.condition && <p className="text-destructive text-sm mt-1">{fieldErrors.condition}</p>}
          </div>

          <Card className="p-4 bg-muted">
            <CardTitle className="text-lg mb-2">Emergency Contact</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <Label htmlFor="emergencyContactName">Name *</Label>
                <Input type="text" id="emergencyContactName" value={emergencyContactName} onChange={(e) => { setEmergencyContactName(e.target.value); clearFieldError("emergencyContactName"); }} aria-invalid={!!fieldErrors.emergencyContactName} className={fieldErrors.emergencyContactName ? "border-destructive" : undefined} required />
                {fieldErrors.emergencyContactName && <p className="text-destructive text-sm mt-1">{fieldErrors.emergencyContactName}</p>}
                </div>
                <div>
                <Label htmlFor="emergencyContactNumber">Mobile *</Label>
                <Input
                    type="tel"
                    id="emergencyContactNumber"
                    aria-invalid={!!emergencyContactMobileError}
                    className={emergencyContactMobileError ? "border-destructive" : undefined}
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

          {!isEditMode && (
            <div className={cn("flex items-start space-x-3 rounded-md border p-4", fieldErrors.consent && "border-destructive")}>
              <Checkbox id="consent" checked={consentGiven} onCheckedChange={(checked) => { setConsentGiven(checked === true); clearFieldError("consent"); }} className="mt-0.5 h-5 w-5" />
              <Label htmlFor="consent" className="text-sm font-normal leading-snug">
                {CONSENT_TEXT} *
              </Label>
            </div>
          )}
          {fieldErrors.consent && <p className="text-destructive text-sm -mt-2">{fieldErrors.consent}</p>}

           <Button onClick={handleSavePatient} disabled={isSaving} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-3">
                <Save className="mr-2 h-5 w-5" /> {isEditMode ? "Update Patient Record" : "Save Patient Record"}
            </Button>

            <Button onClick={handleSaveAndProceed} disabled={isSaving} variant="default" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg py-3">
                 {isEditMode ? "Update & View Admission Notes" : "Save & Add Admission Notes"} <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
