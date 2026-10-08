"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit3, HeartHandshake, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { CsvImport } from '@/components/csv-import';
import { useT } from '@/components/language-provider';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { referringDoctors as referringDoctorsRepo } from '@/lib/data';
import { formatINR } from '@/lib/format';
import type { ReferringDoctor } from '@/types/referringDoctor';

const validEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPhone = (phone: string) => !phone || /^[0-9\s\-()+]{7,15}$/.test(phone);

// Doctors outside the hospital who send patients here (and may be paid a referral fee).
// Access and the feature switch are checked by PageGuard (src/config/navigation.ts).
export default function ReferringDoctorsPage() {
  const t = useT();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const [doctors, setDoctors] = useState<ReferringDoctor[] | null>(null);

  useEffect(() => {
    referringDoctorsRepo.list()
      .then(setDoctors)
      .catch(() => {
        toast({ title: 'Error', description: 'Could not load referring doctors.', variant: 'destructive' });
        setDoctors([]);
      });
  }, [toast]);

  // Rows with a missing name or clinic, a bad phone or email, or a doctor already on the list are skipped.
  const importRows = async (rows: Record<string, string>[]) => {
    const key = (d: { name: string; location: string }) => `${d.name.toLowerCase()}|${d.location.toLowerCase()}`;
    const known = new Set((doctors ?? []).map(key));
    const valid: Omit<ReferringDoctor, 'id'>[] = [];
    for (const r of rows) {
      const doctor = { name: r.name ?? '', location: r['hospital/clinic name'] ?? '', phoneNumber: r.phonenumber ?? '', email: r.email ?? '' };
      if (!doctor.name || !doctor.location || !validPhone(doctor.phoneNumber) || !validEmail(doctor.email) || known.has(key(doctor))) continue;
      known.add(key(doctor));
      valid.push(doctor);
    }
    if (valid.length) {
      await referringDoctorsRepo.createMany(valid);
      setDoctors(await referringDoctorsRepo.list());
    }
    return { imported: valid.length, skipped: rows.length - valid.length };
  };

  if (!doctors) return <PageLoading />;

  const showFees = isOn('referralFees');
  const feeText = (d: ReferringDoctor) =>
    [d.defaultReferralFee != null ? formatINR(d.defaultReferralFee) : null, d.defaultReferralPercent != null ? `${d.defaultReferralPercent}%` : null].filter(Boolean).join(' or ') || '—';

  return (
    <PageBody>
      <PageHeader icon={HeartHandshake} title={t('Referring Doctors')} description={t('Doctors outside the hospital who send patients here.')}
        actions={<>
          <CsvImport what={t('referring doctors')} importRows={importRows}
            columns={[
              { name: 'Name', required: true },
              { name: 'Hospital/Clinic Name', required: true },
              { name: 'PhoneNumber' },
              { name: 'Email' },
            ]}
            example={'Name,Hospital/Clinic Name,PhoneNumber,Email\nDr. Emily Carter,City General Hospital,9876543210,emily.carter@cgh.com'} />
          <Button asChild><Link href="/referring-doctors/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Referring Doctor')}</Link></Button>
        </>} />

      <Card>
        <CardContent className="pt-6">
          {doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No referring doctors yet. Add one, or import a list from a CSV file.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Hospital / clinic</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  {showFees && <TableHead className="hidden text-right sm:table-cell">Referral fee</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...doctors].sort((a, b) => a.name.localeCompare(b.name)).map(doctor => (
                  <TableRow key={doctor.id}>
                    <TableCell>
                      <span className="font-medium">{doctor.name}</span>
                      <span className="block text-xs text-muted-foreground sm:hidden">{doctor.location}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{doctor.location}</TableCell>
                    <TableCell className="hidden md:table-cell">{doctor.phoneNumber || '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{doctor.email || '—'}</TableCell>
                    {showFees && <TableCell className="hidden text-right tabular-nums sm:table-cell">{feeText(doctor)}</TableCell>}
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild aria-label={`Edit ${doctor.name}`}>
                        <Link href={`/referring-doctors/form?id=${doctor.id}`}><Edit3 className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
