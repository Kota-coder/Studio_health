"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { vendors as vendorsRepo } from '@/lib/data';
import type { Vendor } from '@/types/vendor';

// Both optional: empty is fine.
const validEmail = (email: string) => !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validPhone = (phone: string) => !phone.trim() || /^[0-9\s\-()+]{7,15}$/.test(phone.trim());

// Add or edit a vendor. Access is checked by PageGuard.
export default function VendorFormPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const editId = searchParams.get('id');

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(!!editId);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    vendorsRepo.get(editId).then(vendor => {
      if (!vendor) {
        toast({ title: 'Vendor not found', variant: 'destructive' });
        router.push('/vendors');
        return;
      }
      setName(vendor.name);
      setContactPerson(vendor.contactPerson || '');
      setPhoneNumber(vendor.phoneNumber || '');
      setEmail(vendor.email || '');
      setAddress(vendor.address || '');
      setNotes(vendor.notes || '');
    }).catch(() => toast({ title: 'Could not load the vendor', variant: 'destructive' }))
      .finally(() => setIsLoading(false));
  }, [editId, router, toast]);

  const phoneError = validPhone(phoneNumber) ? null : 'Please enter a valid phone number.';
  const emailError = validEmail(email) ? null : 'Please enter a valid email address.';

  const handleSubmit = async () => {
    const problems = [!name.trim() && 'Vendor name is required.', phoneError, emailError].filter(Boolean);
    if (problems.length) {
      toast({ title: 'Check the form', description: problems.join(' '), variant: 'destructive' });
      return;
    }
    const data: Omit<Vendor, 'id'> = {
      name: name.trim(),
      contactPerson: contactPerson.trim() || undefined,
      phoneNumber: phoneNumber.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    setIsSaving(true);
    try {
      if (editId) await vendorsRepo.update(editId, data);
      else await vendorsRepo.create(data);
      toast({ title: 'Saved', description: editId ? 'Vendor details updated.' : 'Vendor added.' });
      router.push('/vendors');
    } catch {
      toast({ title: 'Could not save the vendor', description: 'Please check your connection and try again.', variant: 'destructive' });
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <PageBody width="narrow">
      <PageHeader icon={Truck} back={{ href: '/vendors', label: t('Vendors') }}
        title={editId ? t('Edit Vendor') : t('Add Vendor')}
        description={editId ? t('Update the details of this vendor.') : t('Fill in the details of the new vendor.')} />
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <div>
            <Label htmlFor="name">Vendor name *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., ABC Medical Supplies" />
          </div>
          <div>
            <Label htmlFor="contactPerson">Contact person (optional)</Label>
            <Input id="contactPerson" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="e.g., Ravi Kumar" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="phoneNumber">Phone number (optional)</Label>
              <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="e.g., 98765 43210" aria-invalid={!!phoneError} />
              {phoneError && <p className="mt-1 text-sm text-destructive">{phoneError}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email address (optional)</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g., orders@abcsupplies.in" aria-invalid={!!emailError} />
              {emailError && <p className="mt-1 text-sm text-destructive">{emailError}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="address">Address (optional)</Label>
            <Textarea id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g., 12 Main Road, Hyderabad" />
          </div>
          <div>
            <Label htmlFor="notes">Additional notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Payment terms, delivery schedule, products" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" asChild><Link href="/vendors">{t('Cancel')}</Link></Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : editId ? t('Save Changes') : t('Add Vendor')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
