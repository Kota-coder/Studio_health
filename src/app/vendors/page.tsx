"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit3, PlusCircle, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { CsvImport } from '@/components/csv-import';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { vendors as vendorsRepo } from '@/lib/data';
import type { Vendor } from '@/types/vendor';

// Suppliers of medicines and materials (chosen on Pharmacy and Material purchase payments).
// Access and the feature switch are checked by PageGuard (src/config/navigation.ts).
export default function VendorsPage() {
  const t = useT();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    vendorsRepo.list()
      .then(setVendors)
      .catch(() => {
        toast({ title: t('Error'), description: t('Could not load vendors.'), variant: 'destructive' });
        setVendors([]);
      });
  }, [toast, t]);

  const importRows = async (rows: Record<string, string>[]) => {
    const valid = rows.filter(r => r.name);
    await vendorsRepo.createMany(valid.map(r => ({
      name: r.name,
      contactPerson: r.contactperson || undefined,
      phoneNumber: r.phonenumber || undefined,
      email: r.email || undefined,
      address: r.address || undefined,
      notes: r.notes || undefined,
    })));
    setVendors(await vendorsRepo.list());
    return { imported: valid.length, skipped: rows.length - valid.length };
  };

  if (!vendors) return <PageLoading />;

  return (
    <PageBody>
      <PageHeader icon={Truck} title={t('Vendors')} description={t('Suppliers of medicines and materials, chosen when recording a purchase under Payments.')}
        actions={<>
          <CsvImport what={t('vendors')} importRows={importRows}
            columns={[{ name: 'Name', required: true }, { name: 'ContactPerson' }, { name: 'PhoneNumber' }, { name: 'Email' }, { name: 'Address' }, { name: 'Notes' }]}
            example={'Name,ContactPerson,PhoneNumber,Email,Address,Notes\nABC Medical Supplies,John Smith,9876543210,john@abc.com,"12 Main Rd, Hyderabad",Weekly delivery'} />
          <Button asChild><Link href="/vendors/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Vendor')}</Link></Button>
        </>} />

      <Card>
        <CardContent className="pt-6">
          {vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No vendors yet. Add one, or import a list from a CSV file.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Name')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('Contact person')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('Phone')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('Email')}</TableHead>
                  <TableHead className="text-right">{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...vendors].sort((a, b) => a.name.localeCompare(b.name)).map(vendor => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{vendor.contactPerson || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">{vendor.phoneNumber || '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{vendor.email || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild aria-label={t('Edit {name}', { name: vendor.name })}>
                        <Link href={`/vendors/form?id=${vendor.id}`}><Edit3 className="h-4 w-4" /></Link>
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
