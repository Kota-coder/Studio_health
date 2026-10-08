"use client";

import Link from 'next/link';
import { Activity, BriefcaseMedical, CalendarDays, Edit, Edit3, FileText, Home, Mail, Phone, User, UserCircle, Users, UserSquare2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StoredImage } from '@/components/stored-image';
import { useFormat, useT } from '@/components/language-provider';
import { AttachmentList } from '@/components/patient/attachment-picker';
import { patientDisplayId } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Patient } from '@/types/patient';

function Detail({ label, value, icon: Icon, className }: { label: string; value?: React.ReactNode; icon: React.ElementType; className?: string }) {
  if (!value) return null;
  return (
    <div className={cn('flex min-w-0 items-start text-sm', className)}>
      <Icon className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 break-words">
        <span className="font-medium text-muted-foreground">{label}: </span>{value}
      </div>
    </div>
  );
}

// Registration and admission details, with links to edit them.
// referredBy is undefined when the hospital doesn't use referrals.
export function PatientDetailsCard({ patient, referredBy }: { patient: Patient; referredBy?: string | null }) {
  const t = useT();
  const { date } = useFormat();
  const id = patientDisplayId(patient.id);
  const photo = patient.patientPhotos?.[0];

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center"><User className="mr-2 h-5 w-5 text-primary" />{t('Patient Details')}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/new?editPatientId=${id}`}><Edit3 className="mr-2 h-3 w-3" /> {t('Edit Basic Info')}</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${id}/admission`}><Edit className="mr-2 h-3 w-3" /> {t('Edit Admission')}</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Gender" value={patient.gender} icon={Users} />
            <Detail label="Date of Birth" value={patient.dateOfBirth && date(patient.dateOfBirth)} icon={CalendarDays} />
            <Detail label="Reason for Visit" value={patient.reasonForVisit || 'N/A'} icon={FileText} />
            {referredBy !== undefined && <Detail label="Referred By" value={referredBy || 'N/A'} icon={BriefcaseMedical} />}
            <Detail label="Emergency Contact" value={patient.emergencyContactName} icon={UserCircle} />
            <Detail label="Emergency Mobile" value={patient.emergencyContactNumber} icon={Phone} />
          </div>
          {photo && (
            <StoredImage path={photo} linked alt={`Photo of ${patient.firstName}`} className="h-20 w-20 shrink-0 rounded-md border object-cover shadow-md sm:h-24 sm:w-24" />
          )}
        </div>
        <Accordion type="single" collapsible className="w-full pt-2">
          <AccordionItem value="full-details">
            <AccordionTrigger className="text-sm hover:no-underline">View Full Patient &amp; Admission Info</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-3">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Detail label="Patient Mobile" value={patient.mobileNumber || 'N/A'} icon={Phone} />
                <Detail label="Patient Email" value={patient.emailAddress || 'N/A'} icon={Mail} />
                <Detail label="Address" value={patient.address || 'N/A'} icon={Home} className="sm:col-span-2" />
                <Detail label="ID Card Type" value={patient.idCardType || 'N/A'} icon={UserSquare2} />
                <Detail label="ID Number" value={patient.idNumber || 'N/A'} icon={UserSquare2} />
                <Detail label="Admission Date" value={patient.admissionDate && date(patient.admissionDate, 'dd MMM yyyy, HH:mm')} icon={CalendarDays} />
                <Detail label="Condition at Admission" value={patient.admissionCondition || 'N/A'} icon={Activity} />
              </div>
              <Detail label="Initial Observations" value={patient.initialObservationsText} icon={FileText} />
              <AttachmentList paths={patient.idCardImages} label="Scanned ID Card" size="h-24 w-24 sm:h-32 sm:w-32" />
              <AttachmentList paths={patient.initialObservationAttachments} label="Admission Attachments" size="h-24 w-24 sm:h-32 sm:w-32" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
