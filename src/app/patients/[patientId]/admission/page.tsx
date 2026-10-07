
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Patient, PatientAdmissionCondition, AuditLogEntry } from '@/types/patient';
import { ReferringDoctor } from '@/types/referringDoctor'; // Updated to use ReferringDoctor
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Paperclip, UploadCloud, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { StaffMember } from '@/types/staff';
import { addAuditLogEntry } from '@/lib/audit';
import { imageFilesToDataUrls } from '@/lib/image';

const REASON_FOR_VISIT_OPTIONS: string[] = [
  "Routine Checkup",
  "New Symptom",
  "Follow-up",
  "Emergency",
  "Injury",
  "Pre-operative Assessment",
  "Post-operative Care",
  "Referral",
  "Second Opinion",
  "Medication Refill",
  "Other"
];

const PATIENT_ADMISSION_CONDITIONS: PatientAdmissionCondition[] = [
  "Stable",
  "Guarded",
  "Serious",
  "Critical",
  "Undetermined"
];

// Helper function to add audit log entries


export default function AdmissionNotesPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const patientId = params.patientId ? parseInt(params.patientId as string, 10) : null;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [selectedReferredDoctorId, setSelectedReferredDoctorId] = useState<string>(""); // To store ID of ReferringDoctor
  const [reasonForVisit, setReasonForVisit] = useState<string>("");
  const [admissionCondition, setAdmissionCondition] = useState<PatientAdmissionCondition>("");
  const [initialObservationsText, setInitialObservationsText] = useState<string>("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [initialObservationAttachments, setInitialObservationAttachments] = useState<string[]>([]);
  const [referringDoctorsList, setReferringDoctorsList] = useState<ReferringDoctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  useEffect(() => {
    if (!currentUser) {
        setIsLoading(false);
        return;
    }
    if (!patientId) {
      setIsLoading(false);
      toast({ title: "Error", description: "Patient ID is missing.", variant: "destructive" });
      router.push('/dashboard');
      return;
    }
    setIsLoading(true);
    try {
      const storedPatients = localStorage.getItem('patients');
      const storedExternalReferringDoctors = localStorage.getItem('referringDoctorsData'); // Use the correct key

      if (storedPatients) {
        const patientsArray: Patient[] = JSON.parse(storedPatients).map((p:any) => ({
          ...p,
          auditLog: Array.isArray(p.auditLog) ? p.auditLog : []
        }));
        const foundPatient = patientsArray.find(p => p.id === patientId);
        if (foundPatient) {
          setPatient(foundPatient);
          setSelectedReferredDoctorId(foundPatient.referredDoctorId?.toString() || "");
          setReasonForVisit(foundPatient.reasonForVisit || "");
          setAdmissionCondition(foundPatient.admissionCondition || "");
          setInitialObservationsText(foundPatient.initialObservationsText || "");
          setAttachmentPreview(foundPatient.initialObservationAttachmentDataUrl || null);
          setInitialObservationAttachments(foundPatient.initialObservationAttachments || []);
          setIsInitialLoad(!foundPatient.admissionDate);
        } else {
          toast({ title: "Error", description: "Patient not found.", variant: "destructive" });
          router.push('/dashboard');
        }
      } else {
        toast({ title: "Error", description: "No patient data found.", variant: "destructive" });
        router.push('/dashboard');
      }

      if (storedExternalReferringDoctors) {
        const doctors: ReferringDoctor[] = JSON.parse(storedExternalReferringDoctors);
        setReferringDoctorsList(doctors);
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      toast({ title: "Error", description: "Could not load data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [patientId, router, toast, currentUser]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        const fileArray = Array.from(files);
        const readers = imageFilesToDataUrls(fileArray);

        readers.then(results => {
            setInitialObservationAttachments(prev => [...prev, ...results]);
        });
    }
    if (event.target) event.target.value = "";
  };

  const removeInitialObservationAttachment = (index: number) => {
    setInitialObservationAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllInitialObservationAttachments = () => {
    setInitialObservationAttachments([]);
  };

  const handleSaveAdmissionDetails = async () => {
    if (!patient || !currentUser) {
      toast({ title: "Error", description: "Patient data not loaded or user not logged in.", variant: "destructive" });
      return;
    }
     if (!reasonForVisit.trim()) {
      toast({ title: "Validation Error", description: "Reason for visit is required.", variant: "destructive" });
      return;
    }
    if (!admissionCondition) {
       toast({ title: "Validation Error", description: "Patient condition at admission is required.", variant: "destructive" });
      return;
    }

    let updatedPatient: Patient = {
      ...patient,
      admissionDate: patient.admissionDate || new Date().toISOString(),
      referredDoctorId: selectedReferredDoctorId ? parseInt(selectedReferredDoctorId, 10) : undefined,
      reasonForVisit: reasonForVisit.trim(),
      admissionCondition: admissionCondition,
      initialObservationsText: initialObservationsText.trim(),
      initialObservationAttachmentDataUrl: initialObservationAttachments.length > 0 ? initialObservationAttachments[0] : null,
      initialObservationAttachments: initialObservationAttachments.length > 0 ? initialObservationAttachments : undefined,
    };

    const logActionType = isInitialLoad ? "Admission Details Recorded" : "Admission Details Updated";
    const logChangeDetails = isInitialLoad
      ? `Initial admission details recorded. Reason: ${updatedPatient.reasonForVisit}`
      : "Patient admission details updated.";

    updatedPatient = addAuditLogEntry(updatedPatient, logActionType, logChangeDetails, currentUser);


    try {
      const storedPatients = localStorage.getItem('patients');
      let patientsArray: Patient[] = storedPatients ? JSON.parse(storedPatients).map((p:any) => ({...p, auditLog: Array.isArray(p.auditLog) ? p.auditLog : []})) : [];
      const patientIndex = patientsArray.findIndex(p => p.id === patientId);

      if (patientIndex > -1) {
        patientsArray[patientIndex] = updatedPatient;
        localStorage.setItem('patients', JSON.stringify(patientsArray));
        setPatient(updatedPatient);
        toast({ title: "Success", description: "Admission details saved." });
        router.push(`/patients/${patientId}`);
      } else {
        toast({ title: "Error", description: "Failed to find patient to update.", variant: "destructive" });
      }
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        toast({
          title: "Storage Full",
          description: "Cannot save admission details. Local storage is full, likely due to image attachments. Please remove some images or contact support.",
          variant: "destructive",
        });
      } else {
        console.error("Error saving admission details:", e);
        toast({ title: "Storage Error", description: "Could not save admission details.", variant: "destructive" });
      }
    }
  };

  if (authIsLoading || isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading admission details form...</p></div>;
  }

  if (!currentUser) {
     return <div className="flex justify-center items-center min-h-screen"><p>Redirecting to login...</p></div>;
  }

  if (!patient && !isLoading) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Patient Not Found</h1>
        <p>Redirecting to dashboard...</p>
      </div>
    );
  }

  if (!patient) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading patient data...</p></div>;
  }


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-2xl mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Patient Admission Notes</CardTitle>
          <CardDescription>
            Record admission details for {patient.firstName} {patient.lastName} (ID: {patient.id.toString().padStart(3,'0')})
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div>
            <Label htmlFor="referredDoctor" className="mb-1 block">Referring Doctor</Label>
            <div className="flex items-center gap-2">
              <Select onValueChange={setSelectedReferredDoctorId} value={selectedReferredDoctorId || ""} >
                <SelectTrigger id="referredDoctor" className="flex-grow">
                  <SelectValue placeholder="Select a referring doctor" />
                </SelectTrigger>
                <SelectContent>
                  {referringDoctorsList.length > 0 ? (
                    referringDoctorsList.map(doc => (
                      <SelectItem key={doc.id} value={doc.id.toString()}>
                        {doc.name} - {doc.location}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground text-center">No referring doctors found. <Link href="/referring-doctors/form" className="underline text-primary">Add one?</Link></div>
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

          <div>
            <Label htmlFor="reasonForVisit">Reason for Visit *</Label>
            <Select onValueChange={setReasonForVisit} value={reasonForVisit}>
              <SelectTrigger id="reasonForVisit">
                <SelectValue placeholder="Select reason for visit" />
              </SelectTrigger>
              <SelectContent>
                {REASON_FOR_VISIT_OPTIONS.map(reason => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="admissionCondition">Patient Condition at Admission *</Label>
            <Select onValueChange={(value) => setAdmissionCondition(value as PatientAdmissionCondition)} value={admissionCondition}>
              <SelectTrigger id="admissionCondition">
                <SelectValue placeholder="Select patient condition" />
              </SelectTrigger>
              <SelectContent>
                {PATIENT_ADMISSION_CONDITIONS.map(condition => (
                  <SelectItem key={condition} value={condition}>{condition}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="initialObservationsText">Initial Observations</Label>
            <Textarea
              id="initialObservationsText"
              value={initialObservationsText}
              onChange={(e) => setInitialObservationsText(e.target.value)}
              placeholder="Enter any initial observations, symptoms, or notes..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="initialObservationAttachment">Initial Observation Attachments (Optional, images are resized automatically)</Label>
            <div className="flex items-center gap-3 mt-1">
                <Input
                id="initialObservationAttachment"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
                />
                <Button type="button" variant="outline" onClick={() => document.getElementById('initialObservationAttachment')?.click()} className="flex-1">
                    <UploadCloud className="mr-2 h-4 w-4" /> {initialObservationAttachments.length > 0 ? `Add More (${initialObservationAttachments.length})` : "Upload Files"}
                </Button>
                {initialObservationAttachments.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearAllInitialObservationAttachments} className="text-xs text-destructive">
                        Clear All
                    </Button>
                )}
            </div>

            {initialObservationAttachments.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {initialObservationAttachments.map((attachment, index) => (
                    <div key={index} className="relative border rounded-md p-1">
                        <img src={attachment} alt={`Observation Attachment ${index + 1}`} className="rounded-md w-full h-20 object-cover" data-ai-hint="medical document"/>
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                            onClick={() => removeInitialObservationAttachment(index)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => router.push(`/patients/${patientId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel & Back to Patient
          </Button>
          <Button onClick={handleSaveAdmissionDetails}>
            <Save className="mr-2 h-4 w-4" /> Save Admission Details
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
