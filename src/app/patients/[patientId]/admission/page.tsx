"use client";

import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { useParams, useRouter } from 'next/navigation';
import { ClipboardPlus, Save, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { AttachmentPicker } from '@/components/patient/attachment-picker';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { patients as patientsRepo, referringDoctors as referringDoctorsRepo } from '@/lib/data';
import { patientDisplayId } from '@/lib/format';
import { uploadNewImages } from '@/lib/storage';
import type { Patient, PatientAdmissionCondition } from '@/types/patient';
import type { ReferringDoctor } from '@/types/referringDoctor';

const REASONS_FOR_VISIT = [
  'Routine Checkup', 'New Symptom', 'Follow-up', 'Emergency', 'Injury', 'Pre-operative Assessment',
  'Post-operative Care', 'Referral', 'Second Opinion', 'Medication Refill', 'Other',
];
const ADMISSION_CONDITIONS: PatientAdmissionCondition[] = ['Stable', 'Guarded', 'Serious', 'Critical', 'Undetermined'];

// Admission details for a patient: reason for visit, condition, referring doctor, observations.
// Access is checked by PageGuard (src/config/navigation.ts).
export default function AdmissionNotesPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const referralsOn = isOn('referringDoctors');
  const patientId = parseInt(String(params.patientId ?? ''), 10);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [referringDoctors, setReferringDoctors] = useState<ReferringDoctor[]>([]);
  const [referredDoctorId, setReferredDoctorId] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [admissionCondition, setAdmissionCondition] = useState<PatientAdmissionCondition>('');
  const [observations, setObservations] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (Number.isNaN(patientId)) {
      router.push('/dashboard');
      return;
    }
    let cancelled = false;
    Promise.all([patientsRepo.get(patientId), referralsOn ? referringDoctorsRepo.list() : Promise.resolve([])])
      .then(([found, doctors]) => {
        if (cancelled) return;
        if (!found) {
          toast({ title: 'Patient not found', variant: 'destructive' });
          router.push('/dashboard');
          return;
        }
        setReferringDoctors(doctors);
        setPatient(found);
        setReferredDoctorId(found.referredDoctorId?.toString() || '');
        setReasonForVisit(found.reasonForVisit || '');
        setAdmissionCondition(found.admissionCondition || '');
        setObservations(found.initialObservationsText || '');
        setAttachments(found.initialObservationAttachments || []);
      })
      .catch(error => {
        console.error('Error loading admission data:', error);
        toast({ title: 'Could not load the patient', variant: 'destructive' });
      });
    return () => { cancelled = true; };
  }, [patientId, referralsOn, router, toast]);

  if (!patient) return <PageLoading />;
  const patientPage = `/patients/${patientDisplayId(patient.id)}`;

  const save = async () => {
    if (!reasonForVisit.trim()) {
      toast({ title: 'Missing details', description: 'Reason for visit is required.', variant: 'destructive' });
      return;
    }
    if (!admissionCondition) {
      toast({ title: 'Missing details', description: 'Patient condition at admission is required.', variant: 'destructive' });
      return;
    }
    const firstRecord = !patient.admissionDate;
    setIsSaving(true);
    try {
      await patientsRepo.update(patient.id, {
        admissionDate: patient.admissionDate || new Date().toISOString(),
        referredDoctorId: referredDoctorId ? parseInt(referredDoctorId, 10) : null,
        reasonForVisit: reasonForVisit.trim(),
        admissionCondition,
        initialObservationsText: observations.trim(),
        initialObservationAttachments: await uploadNewImages(attachments, `patients/${patient.id}/admission`),
      }, {
        actionType: firstRecord ? 'Admission Details Recorded' : 'Admission Details Updated',
        details: firstRecord ? `Initial admission details recorded. Reason: ${reasonForVisit.trim()}` : 'Patient admission details updated.',
      });
      toast({ title: 'Admission details saved' });
      router.push(patientPage);
    } catch (e) {
      console.error('Error saving admission details:', e);
      toast({ title: 'Could not save admission details', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      setIsSaving(false);
    }
  };

  return (
    <PageBody width="narrow">
      <PageHeader icon={ClipboardPlus} title={t('Patient Admission Notes')}
        description={`${patient.firstName} ${patient.lastName} (ID: ${patientDisplayId(patient.id)})`}
        back={{ href: patientPage, label: `${patient.firstName} ${patient.lastName}` }} />

      <Card className="shadow-lg">
        <CardContent className="grid gap-6 pt-6">
          {referralsOn && (
            <div>
              <Label htmlFor="referredDoctor">Referring Doctor</Label>
              <div className="flex items-center gap-2">
                <Select onValueChange={setReferredDoctorId} value={referredDoctorId}>
                  <SelectTrigger id="referredDoctor" className="min-w-0 flex-1"><SelectValue placeholder="Select a referring doctor" /></SelectTrigger>
                  <SelectContent>
                    {referringDoctors.length > 0 ? referringDoctors.map(doc => (
                      <SelectItem key={doc.id} value={doc.id.toString()}>{doc.name} - {doc.location}</SelectItem>
                    )) : (
                      <div className="p-2 text-center text-sm text-muted-foreground">No referring doctors found. <Link href="/referring-doctors/form" className="text-primary underline">Add one?</Link></div>
                    )}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" asChild aria-label="Add new referring doctor" title="Add New Referring Doctor">
                  <Link href="/referring-doctors/form"><UserPlus className="h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="reasonForVisit">Reason for Visit *</Label>
            <Select onValueChange={setReasonForVisit} value={reasonForVisit}>
              <SelectTrigger id="reasonForVisit"><SelectValue placeholder="Select reason for visit" /></SelectTrigger>
              <SelectContent>
                {REASONS_FOR_VISIT.map(reason => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="admissionCondition">Patient Condition at Admission *</Label>
            <Select onValueChange={value => setAdmissionCondition(value as PatientAdmissionCondition)} value={admissionCondition}>
              <SelectTrigger id="admissionCondition"><SelectValue placeholder="Select patient condition" /></SelectTrigger>
              <SelectContent>
                {ADMISSION_CONDITIONS.map(condition => <SelectItem key={condition} value={condition}>{condition}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="initialObservationsText">Initial Observations</Label>
            <Textarea id="initialObservationsText" value={observations} onChange={e => setObservations(e.target.value)}
              placeholder="Enter any initial observations, symptoms, or notes..." rows={4} />
          </div>

          <AttachmentPicker id="initialObservationAttachment" label="Initial Observation Attachments (Optional, images are resized automatically)"
            value={attachments} onChange={setAttachments} />
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" asChild><Link href={patientPage}>{t('Cancel')}</Link></Button>
          <Button onClick={save} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : t('Save Admission Details')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
