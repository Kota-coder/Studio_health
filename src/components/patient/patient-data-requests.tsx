"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { downloadPatientData, erasePatientData } from '@/lib/patient-data';
import type { Patient } from '@/types/patient';

// Data requests (DPDP Act) for Super Admins: download everything held about the patient,
// or erase it. Shown only when PATIENT_DATA_REQUESTS_ENABLED is on.
export function PatientDataRequests({ patient }: { patient: Patient }) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await downloadPatientData(patient.id);
      toast({ title: 'Patient data downloaded' });
    } catch (error) {
      toast({ title: 'Could not export patient data', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    setBusy(true);
    try {
      await erasePatientData(patient.id);
      toast({ title: 'Patient data erased' });
      router.push('/dashboard');
    } catch (error) {
      toast({ title: 'Could not erase patient data', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={download} disabled={busy}><Download className="mr-2 h-4 w-4" /> {t('Download Patient Data')}</Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={busy}><Trash2 className="mr-2 h-4 w-4" /> {t('Erase Patient Data')}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase all data for {patient.firstName} {patient.lastName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the patient&apos;s details, care notes, tests, images and history. Bills are kept for the clinic&apos;s accounts but no longer show who they were for. This cannot be undone. Download the patient&apos;s data first if they asked for a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={erase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Erase Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
