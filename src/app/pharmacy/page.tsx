"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit3, Pill, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { CsvImport } from '@/components/csv-import';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { medications as medicationsRepo } from '@/lib/data';
import { formatINR } from '@/lib/format';
import type { Medication } from '@/types/medication';

// Medicines and other items the pharmacy sells (stock on hand is under Inventory).
// Access and the feature switch are checked by PageGuard (src/config/navigation.ts).
export default function PharmacyPage() {
  const t = useT();
  const { toast } = useToast();
  const [items, setItems] = useState<Medication[] | null>(null);

  useEffect(() => {
    medicationsRepo.list()
      .then(setItems)
      .catch(() => {
        toast({ title: 'Error', description: 'Could not load pharmacy items.', variant: 'destructive' });
        setItems([]);
      });
  }, [toast]);

  const importRows = async (rows: Record<string, string>[]) => {
    const valid: Omit<Medication, 'id'>[] = [];
    for (const r of rows) {
      const listPrice = Number(r.listprice);
      const quantity = r.quantityinpackage ? Number(r.quantityinpackage) : undefined;
      if (!r.name || !r.unitofmeasure || r.listprice === '' || !Number.isFinite(listPrice) || listPrice < 0) continue;
      if (quantity !== undefined && !(Number.isInteger(quantity) && quantity > 0)) continue;
      valid.push({
        name: r.name,
        treatment: r.treatment || 'N/A',
        listPrice,
        quantityInPackage: quantity,
        unitOfMeasure: r.unitofmeasure,
        additionalNotes: r.additionalnotes ?? '',
      });
    }
    if (valid.length) {
      await medicationsRepo.createMany(valid);
      setItems(await medicationsRepo.list());
    }
    return { imported: valid.length, skipped: rows.length - valid.length };
  };

  if (!items) return <PageLoading />;

  const packageDetails = (med: Medication) =>
    med.quantityInPackage != null ? `${med.quantityInPackage} ${med.unitOfMeasure}` : med.unitOfMeasure;

  return (
    <PageBody>
      <PageHeader icon={Pill} title={t('Pharmacy')} description={t('Medicines and other items the pharmacy sells. Stock on hand is under Inventory.')}
        actions={<>
          <CsvImport what={t('pharmacy items')} importRows={importRows}
            columns={[
              { name: 'Name', required: true },
              { name: 'Treatment', hint: 'treatment template name' },
              { name: 'ListPrice', required: true, hint: 'price for the package, e.g. 150.75' },
              { name: 'QuantityInPackage', hint: 'whole number, e.g. 10' },
              { name: 'UnitOfMeasure', required: true, hint: 'e.g. tablet, ml, bottle' },
              { name: 'AdditionalNotes' },
            ]}
            example={'Name,Treatment,ListPrice,QuantityInPackage,UnitOfMeasure,AdditionalNotes\nAmoxicillin 500mg,Antibiotic,150.75,20,tablet,Take with food'} />
          <Button asChild><Link href="/pharmacy/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Pharmacy Item')}</Link></Button>
        </>} />

      <Card>
        <CardContent className="pt-6">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No pharmacy items yet. Add one, or import a list from a CSV file.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Treatment / purpose</TableHead>
                  <TableHead className="text-right">List price</TableHead>
                  <TableHead className="hidden md:table-cell">Package</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...items].sort((a, b) => a.name.localeCompare(b.name)).map(med => (
                  <TableRow key={med.id}>
                    <TableCell className="font-medium">{med.name}</TableCell>
                    <TableCell className="hidden max-w-xs truncate sm:table-cell">{med.treatment}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(med.listPrice)}</TableCell>
                    <TableCell className="hidden md:table-cell">{packageDetails(med)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild aria-label={`Edit ${med.name}`}>
                        <Link href={`/pharmacy/form?id=${med.id}`}><Edit3 className="h-4 w-4" /></Link>
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
