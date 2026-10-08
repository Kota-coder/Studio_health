"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Save, UserPlus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateField, parseDMY } from '@/components/date-field';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { ImageAttachments } from '@/components/registration/image-attachments';
import type { ScannedDetails } from '@/components/registration/id-card-scan';
import { useT } from '@/components/language-provider';
import { useStaff } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isAadhaarCard, maskAadhaarNumber } from '@/lib/aadhaar';
import { patients as patientsRepo, type PatientFields } from '@/lib/data';
import { formatDate, patientDisplayId } from '@/lib/format';
import { uploadNewImages } from '@/lib/storage';
import { cn } from '@/lib/utils';
import type { PatientCondition } from '@/types/patient';

const ExtractButton = ({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) => (
  <Button type="button" onClick={onClick} disabled={disabled} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
    Extract Details from First ID Image
  </Button>
);

// The ID scan (and the AI server action it calls) is only downloaded once there is an image to scan.
const IdCardScan = dynamic(() => import('@/components/registration/id-card-scan'), {
  ssr: false,
  loading: () => <ExtractButton disabled />,
});

const ID_CARD_TYPES = ["Aadhar Card", "Driver's License", "PAN Card", "Voter ID", "Passport"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const PATIENT_CONDITIONS: PatientCondition[] = ["Critical", "Medium", "Low", "Unassigned"];

// Bump when the consent wording below changes, so records show which text was agreed to.
const CONSENT_VERSION = "2026-10-v1";
const CONSENT_TEXT = "The patient (or their guardian) consents to the clinic collecting and using their personal and health information for treatment, billing and follow-up, as required under the Digital Personal Data Protection Act, 2023.";

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidMobileNumber = (number: string) => /^[0-9]{10}$/.test(number);

type FormFields = Pick<PatientFields, 'firstName' | 'lastName' | 'gender' | 'dateOfBirth' | 'mobileNumber' | 'emailAddress' | 'address'
  | 'idCardType' | 'idNumber' | 'emergencyContactName' | 'emergencyContactNumber'> & { condition: PatientCondition; idCardType: string };

const EMPTY_FORM: FormFields = {
  firstName: '', lastName: '', gender: '', dateOfBirth: '', mobileNumber: '', emailAddress: '', address: '',
  idCardType: '', idNumber: '', emergencyContactName: '', emergencyContactNumber: '', condition: 'Unassigned',
};

// Registers a patient, or edits one with ?editPatientId=7. Records DPDP consent for new
// patients; Aadhaar card images are never stored and only the last 4 digits are kept.
export default function RegisterPatientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const t = useT();
  const currentUser = useStaff();

  const editParam = searchParams.get('editPatientId');
  const editingId = editParam ? parseInt(editParam, 10) : null;

  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [idCardImages, setIdCardImages] = useState<string[]>([]);
  const [patientPhotos, setPatientPhotos] = useState<string[]>([]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(editingId !== null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFieldErrors({});
    if (editingId === null) {
      setForm(EMPTY_FORM);
      setIdCardImages([]);
      setPatientPhotos([]);
      setConsentGiven(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    patientsRepo.get(editingId).then(patient => {
      if (!patient) {
        toast({ title: "Error", description: "Patient to edit not found.", variant: "destructive" });
        router.push('/dashboard');
        return;
      }
      setForm({
        firstName: patient.firstName,
        lastName: patient.lastName,
        gender: patient.gender,
        dateOfBirth: patient.dateOfBirth || '',
        mobileNumber: patient.mobileNumber,
        emailAddress: patient.emailAddress || '',
        address: patient.address || '',
        idCardType: patient.idCardType || '',
        idNumber: patient.idNumber,
        emergencyContactName: patient.emergencyContactName,
        emergencyContactNumber: patient.emergencyContactNumber,
        condition: patient.condition || 'Unassigned',
      });
      setIdCardImages(patient.idCardImages || []);
      setPatientPhotos(patient.patientPhotos || []);
      setConsentGiven(!!patient.consentGivenAt);
    }).catch(error => {
      console.error("Error loading patient:", error);
      toast({ title: "Error", description: "Could not load patient.", variant: "destructive" });
    }).finally(() => setIsLoading(false));
  }, [editingId, router, toast]);

  // Sets a field and clears its error.
  const set = <K extends keyof FormFields>(field: K, value: FormFields[K], error = '') => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => (prev[field] || error ? { ...prev, [field]: error } : prev));
  };

  const applyScan = (details: ScannedDetails) => {
    setForm(prev => ({ ...prev, ...details }));
  };

  const validate = (): FormFields | null => {
    // Field id -> message, shown under the field and listed in the error message.
    const errors: Record<string, string> = {};
    const dob = form.dateOfBirth.trim();
    if (!form.firstName.trim()) errors.firstName = "First Name is required.";
    if (!form.lastName.trim()) errors.lastName = "Last Name is required.";
    if (!form.gender) errors.gender = "Select a gender.";
    if (!dob) {
      errors.dateOfBirth = "Date of Birth is required.";
    } else if (!parseDMY(dob)) {
      const parts = dob.split('/').map(Number);
      errors.dateOfBirth = parts.length === 3 && parts[0] <= 12 && parts[1] > 12
        ? `This looks like month/day/year. Enter the day first: ${String(parts[1]).padStart(2, '0')}/${String(parts[0]).padStart(2, '0')}/${parts[2]}.`
        : "Enter the date as day/month/year, e.g. 25/12/1980, or use the calendar.";
    }
    if (!isValidMobileNumber(form.mobileNumber)) errors.mobileNumber = "Mobile number must be 10 digits.";
    if (form.emailAddress && !isValidEmail(form.emailAddress)) errors.emailAddress = "Please enter a valid email address.";
    if (!form.idNumber.trim()) errors.idNumber = "ID Number is required.";
    if (!form.condition) errors.condition = "Select the patient's condition.";
    if (!form.emergencyContactName.trim()) errors.emergencyContactName = "Emergency contact name is required.";
    if (!isValidMobileNumber(form.emergencyContactNumber)) errors.emergencyContactNumber = "Emergency contact mobile must be 10 digits.";
    if (editingId === null && !consentGiven) errors.consent = "Tick the box to record the patient's consent.";

    setFieldErrors(errors);
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
    // Never keep a full Aadhaar number (UIDAI); only the last four digits.
    return { ...form, dateOfBirth: dob, idNumber: isAadhaarCard(form.idCardType) ? maskAadhaarNumber(form.idNumber) : form.idNumber };
  };

  // Uploads new images under the patient's folder. Aadhaar card images are never stored.
  const uploadPatientImages = async (patientId: number) => ({
    idCardImages: isAadhaarCard(form.idCardType) ? [] : await uploadNewImages(idCardImages, `patients/${patientId}/id-card`),
    patientPhotos: await uploadNewImages(patientPhotos, `patients/${patientId}/photo`),
  });

  const savePatient = async (proceedToAdmission: boolean) => {
    const patientData = validate();
    if (!patientData) return;
    const name = `${patientData.firstName} ${patientData.lastName}`;

    setIsSaving(true);
    try {
      let id: number;
      if (editingId !== null) {
        id = editingId;
        await patientsRepo.update(id, { ...patientData, ...(await uploadPatientImages(id)) }, proceedToAdmission
          ? { actionType: "Patient Details Updated & Proceeded to Admission", details: `Patient ${name} basic details updated, proceeding to admission.` }
          : { actionType: "Patient Details Updated", details: "Patient basic details updated." });
      } else {
        const newPatient = await patientsRepo.create({
          ...patientData,
          assignedStaffIds: [],
          admissionCondition: "",
          consentGivenAt: new Date().toISOString(),
          consentVersion: CONSENT_VERSION,
          consentRecordedByStaffId: currentUser.id,
        }, proceedToAdmission
          ? { actionType: "Patient Registered & Proceeded to Admission", details: `Patient ${name} basic details saved, proceeding to admission.` }
          : { actionType: "Patient Registered", details: `New patient ${name} registered.` });
        id = newPatient.id;
        // Images are filed under the patient's ID, which only exists after the insert.
        const images = await uploadPatientImages(id);
        if (images.idCardImages.length > 0 || images.patientPhotos.length > 0) {
          await patientsRepo.update(id, images, { actionType: "Images Added", details: "ID card and/or patient photos saved." });
        }
      }

      const displayId = patientDisplayId(id);
      const verb = editingId !== null ? 'updated' : 'saved';
      toast({
        title: editingId !== null ? "Patient updated" : "Patient saved",
        description: proceedToAdmission
          ? `Basic details for ${patientData.firstName} (ID: ${displayId}) ${verb}. Proceeding to admission notes.`
          : `Patient ${name} (ID: ${displayId}) ${verb}.`,
      });
      router.push(Number.isFinite(id) ? `/patients/${displayId}${proceedToAdmission ? '/admission' : ''}` : '/dashboard');
    } catch (e) {
      console.error("Failed to save patient", e);
      toast({ title: "Save error", description: e instanceof Error ? e.message : "Could not save patient data.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  const editing = editingId !== null;
  const aadhaar = isAadhaarCard(form.idCardType);
  const dob = parseDMY(form.dateOfBirth);
  const errorText = (field: string) => fieldErrors[field] && <p className="mt-1 text-sm text-destructive">{fieldErrors[field]}</p>;
  const textField = (field: 'firstName' | 'lastName' | 'emergencyContactName', label: string) => (
    <div>
      <Label htmlFor={field}>{label} *</Label>
      <Input id={field} value={form[field]} onChange={e => set(field, e.target.value)}
        aria-invalid={!!fieldErrors[field]} className={cn(fieldErrors[field] && 'border-destructive')} required />
      {errorText(field)}
    </div>
  );
  const mobileField = (field: 'mobileNumber' | 'emergencyContactNumber', label: string) => (
    <div>
      <Label htmlFor={field}>{label} *</Label>
      <Input type="tel" inputMode="numeric" id={field} value={form[field]} required
        aria-invalid={!!fieldErrors[field]} className={cn(fieldErrors[field] && 'border-destructive')}
        onChange={e => set(field, e.target.value, e.target.value && !isValidMobileNumber(e.target.value) ? "Please enter a valid 10-digit mobile number." : '')} />
      {errorText(field)}
    </div>
  );

  return (
    <PageBody width="narrow">
      <PageHeader icon={UserPlus} title={editing ? t('Edit Patient') : t('Register Patient')}
        description={editing ? `Patient ID ${patientDisplayId(editingId)}` : "The patient number is assigned when saved."}
        back={{ href: editing ? `/patients/${patientDisplayId(editingId)}` : '/dashboard' }} />

      <Card>
        <CardContent className="grid gap-4 pt-6">
          <div>
            <Label>Patient Photo(s)</Label>
            <div className="mt-1">
              <ImageAttachments images={patientPhotos} onChange={setPatientPhotos}
                itemLabel="Patient Photo" uploadedTitle="Patient photos added" />
            </div>
          </div>

          <h2 className="mt-4 font-semibold">{t('ID Card Details')}</h2>
          <ImageAttachments images={idCardImages} onChange={setIdCardImages}
            itemLabel="ID Card" uploadedTitle="ID card images added" large />

          {aadhaar && (
            <Alert>
              <AlertTitle>Aadhaar privacy</AlertTitle>
              <AlertDescription>
                The Aadhaar card image is used only to read the details and is not saved. Only the last 4 digits of the Aadhaar number are stored.
              </AlertDescription>
            </Alert>
          )}

          <Select onValueChange={v => set('idCardType', v)} value={form.idCardType} required>
            <SelectTrigger id="idCardType" className="w-full" aria-label="ID card type">
              <SelectValue placeholder="Select ID Card Type *" />
            </SelectTrigger>
            <SelectContent>
              {ID_CARD_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>

          {idCardImages.length > 0 && form.idCardType
            ? <IdCardScan images={idCardImages} idCardType={form.idCardType} firstName={form.firstName} onExtracted={applyScan} />
            : <ExtractButton disabled />}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {textField('firstName', 'First Name')}
            {textField('lastName', 'Last Name')}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="gender">Gender *</Label>
              <Select onValueChange={v => set('gender', v)} value={form.gender} required>
                <SelectTrigger id="gender" aria-invalid={!!fieldErrors.gender} className={cn('w-full', fieldErrors.gender && 'border-destructive')}>
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
              {errorText('gender')}
            </div>
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth (dd/mm/yyyy) *</Label>
              <DateField id="dateOfBirth" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)}
                defaultMonth={new Date(1980, 0, 1)} max={new Date()} required />
              {fieldErrors.dateOfBirth
                ? errorText('dateOfBirth')
                : dob && <p className="mt-1 text-xs text-muted-foreground">Reads as {formatDate(dob, 'd MMMM yyyy')}</p>}
            </div>
          </div>

          {mobileField('mobileNumber', 'Mobile Number')}

          <div>
            <Label htmlFor="emailAddress">Email Address</Label>
            <Input type="email" id="emailAddress" value={form.emailAddress ?? ''}
              onChange={e => set('emailAddress', e.target.value, e.target.value && !isValidEmail(e.target.value) ? "Please enter a valid email address." : '')} />
            {errorText('emailAddress')}
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
          </div>

          <div>
            <Label htmlFor="idNumber">ID Number (from card) *</Label>
            <Input id="idNumber" value={form.idNumber} onChange={e => set('idNumber', e.target.value)} required
              onBlur={() => { if (aadhaar) set('idNumber', maskAadhaarNumber(form.idNumber)); }}
              aria-invalid={!!fieldErrors.idNumber} className={cn(fieldErrors.idNumber && 'border-destructive')} />
            {aadhaar && <p className="mt-1 text-xs text-muted-foreground">Saved masked as XXXX XXXX 1234.</p>}
            {errorText('idNumber')}
          </div>

          <div>
            <Label htmlFor="condition">Patient Condition *</Label>
            <Select onValueChange={v => set('condition', v as PatientCondition)} value={form.condition} required>
              <SelectTrigger id="condition" aria-invalid={!!fieldErrors.condition} className={cn('w-full', fieldErrors.condition && 'border-destructive')}>
                <SelectValue placeholder="Select Patient Condition" />
              </SelectTrigger>
              <SelectContent>
                {PATIENT_CONDITIONS.map(level => <SelectItem key={level} value={level}>{t(level)}</SelectItem>)}
              </SelectContent>
            </Select>
            {errorText('condition')}
          </div>

          <Card className="bg-muted p-4">
            <CardTitle className="mb-2 text-lg">{t('Emergency Contact')}</CardTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {textField('emergencyContactName', 'Name')}
              {mobileField('emergencyContactNumber', 'Mobile')}
            </div>
          </Card>

          {!editing && (
            <div>
              <div className={cn('flex items-start gap-3 rounded-md border p-4', fieldErrors.consent && 'border-destructive')}>
                <Checkbox id="consent" checked={consentGiven} className="mt-0.5 h-5 w-5"
                  onCheckedChange={checked => { setConsentGiven(checked === true); setFieldErrors(prev => ({ ...prev, consent: '' })); }} />
                <Label htmlFor="consent" className="text-sm font-normal leading-snug">{CONSENT_TEXT} *</Label>
              </div>
              {errorText('consent')}
            </div>
          )}

          <Button onClick={() => savePatient(false)} disabled={isSaving} className="h-auto w-full whitespace-normal py-3 text-lg">
            <Save className="mr-2 h-5 w-5" /> {editing ? t('Update Patient Record') : t('Save Patient Record')}
          </Button>
          <Button onClick={() => savePatient(true)} disabled={isSaving} className="h-auto w-full whitespace-normal bg-accent py-3 text-lg text-accent-foreground hover:bg-accent/90">
            {editing ? t('Update & View Admission Notes') : t('Save & Add Admission Notes')} <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </CardContent>
      </Card>
    </PageBody>
  );
}
