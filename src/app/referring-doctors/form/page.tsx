"use client";

import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { useRouter, useSearchParams } from 'next/navigation';
import { HeartHandshake, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { referringDoctors as referringDoctorsRepo } from '@/lib/data';
import type { ReferringDoctor } from '@/types/referringDoctor';

// Both optional: empty is fine.
const validEmail = (email: string) => !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validPhone = (phone: string) => !phone.trim() || /^[0-9\s\-()+]{7,15}$/.test(phone.trim());

// Add or edit a referring doctor. Access is checked by PageGuard.
export default function ReferringDoctorFormPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const idParam = searchParams.get('id');
  const editId = idParam ? Number.parseInt(idParam, 10) : null;

  const [name, setName] = useState('');
  const [clinic, setClinic] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [defaultReferralFee, setDefaultReferralFee] = useState('');
  const [defaultReferralPercent, setDefaultReferralPercent] = useState('');
  const [isLoading, setIsLoading] = useState(editId !== null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editId === null) return;
    referringDoctorsRepo.get(editId).then(doctor => {
      if (!doctor) {
        toast({ title: 'Referring doctor not found', variant: 'destructive' });
        router.push('/referring-doctors');
        return;
      }
      setName(doctor.name);
      setClinic(doctor.location);
      setPhoneNumber(doctor.phoneNumber || '');
      setEmail(doctor.email || '');
      setDefaultReferralFee(doctor.defaultReferralFee != null ? String(doctor.defaultReferralFee) : '');
      setDefaultReferralPercent(doctor.defaultReferralPercent != null ? String(doctor.defaultReferralPercent) : '');
    }).catch(() => toast({ title: 'Could not load the referring doctor', variant: 'destructive' }))
      .finally(() => setIsLoading(false));
  }, [editId, router, toast]);

  const phoneError = validPhone(phoneNumber) ? null : 'Please enter a valid phone number.';
  const emailError = validEmail(email) ? null : 'Please enter a valid email address.';

  const handleSubmit = async () => {
    const problems = [!name.trim() && 'Name is required.', !clinic.trim() && 'Hospital / clinic name is required.', phoneError, emailError].filter(Boolean);
    if (problems.length) {
      toast({ title: 'Check the form', description: problems.join(' '), variant: 'destructive' });
      return;
    }
    const referralFee = defaultReferralFee.trim() === '' ? null : Number(defaultReferralFee);
    if (referralFee !== null && (!Number.isFinite(referralFee) || referralFee < 0)) {
      toast({ title: 'Check the referral fee', description: 'The fee must be 0 or more, or left empty.', variant: 'destructive' });
      return;
    }
    const referralPercent = defaultReferralPercent.trim() === '' ? null : Number(defaultReferralPercent);
    if (referralPercent !== null && (!Number.isFinite(referralPercent) || referralPercent < 0 || referralPercent > 100)) {
      toast({ title: 'Check the referral percentage', description: 'It must be between 0 and 100, or left empty.', variant: 'destructive' });
      return;
    }
    const data: Omit<ReferringDoctor, 'id'> = {
      name: name.trim(),
      location: clinic.trim(),
      phoneNumber: phoneNumber.trim(),
      email: email.trim(),
      defaultReferralFee: referralFee,
      defaultReferralPercent: referralPercent,
    };
    setIsSaving(true);
    try {
      if (editId !== null) await referringDoctorsRepo.update(editId, data);
      else await referringDoctorsRepo.create(data);
      toast({ title: 'Saved', description: editId !== null ? 'Referring doctor updated.' : 'Referring doctor added.' });
      router.push('/referring-doctors');
    } catch {
      toast({ title: 'Could not save the referring doctor', description: 'Please check your connection and try again.', variant: 'destructive' });
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <PageBody width="narrow">
      <PageHeader icon={HeartHandshake} back={{ href: '/referring-doctors', label: t('Referring Doctors') }}
        title={editId !== null ? t('Edit Referring Doctor') : t('Add Referring Doctor')}
        description={editId !== null ? t('Update the details of this referring doctor.') : t('Fill in the details of the new referring doctor.')} />
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <div>
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Dr. Priya Sharma" />
          </div>
          <div>
            <Label htmlFor="clinic">Hospital / clinic name *</Label>
            <Input id="clinic" value={clinic} onChange={e => setClinic(e.target.value)} placeholder="e.g., City General Hospital" />
          </div>
          <div>
            <Label htmlFor="phoneNumber">Phone number (optional)</Label>
            <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="e.g., 98765 43210" aria-invalid={!!phoneError} />
            {phoneError && <p className="mt-1 text-sm text-destructive">{phoneError}</p>}
          </div>
          <div>
            <Label htmlFor="email">Email address (optional)</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" aria-invalid={!!emailError} />
            {emailError && <p className="mt-1 text-sm text-destructive">{emailError}</p>}
          </div>
          {isOn('referralFees') && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm text-muted-foreground">
                Referral fees are paid by the hospital to this doctor, not by the patient. Set either default; both can be changed for each patient.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="defaultReferralFee">Fixed fee per patient (₹, optional)</Label>
                  <Input id="defaultReferralFee" type="number" inputMode="decimal" min={0} value={defaultReferralFee} onChange={e => setDefaultReferralFee(e.target.value)} placeholder="e.g. 500" />
                </div>
                {isOn('billing') && (
                  <div>
                    <Label htmlFor="defaultReferralPercent">Or % of billed procedures (optional)</Label>
                    <Input id="defaultReferralPercent" type="number" inputMode="decimal" min={0} max={100} step="0.5" value={defaultReferralPercent} onChange={e => setDefaultReferralPercent(e.target.value)} placeholder="e.g. 10" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Paid through Payments → Referral/CC.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" asChild><Link href="/referring-doctors">{t('Cancel')}</Link></Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : editId !== null ? t('Save Changes') : t('Add Referring Doctor')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
