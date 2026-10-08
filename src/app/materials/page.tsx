"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit3, Package, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { CsvImport } from '@/components/csv-import';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { materials as materialsRepo } from '@/lib/data';
import { formatINR } from '@/lib/format';
import type { Material } from '@/types/material';

// Consumables and supplies used on wards and in procedures (stock on hand is under Inventory).
// Access and the feature switch are checked by PageGuard (src/config/navigation.ts).
export default function MaterialsPage() {
  const t = useT();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[] | null>(null);

  useEffect(() => {
    materialsRepo.list()
      .then(setMaterials)
      .catch(() => {
        toast({ title: 'Error', description: 'Could not load materials.', variant: 'destructive' });
        setMaterials([]);
      });
  }, [toast]);

  const importRows = async (rows: Record<string, string>[]) => {
    const valid: Omit<Material, 'id'>[] = [];
    for (const r of rows) {
      const listPrice = r.listprice ? Number(r.listprice) : undefined;
      if (!r.name || !r.unitofmeasure) continue;
      if (listPrice !== undefined && !(Number.isFinite(listPrice) && listPrice >= 0)) continue;
      valid.push({
        name: r.name,
        category: r.category ?? '',
        unitOfMeasure: r.unitofmeasure,
        listPrice,
        associatedTreatmentTemplateName: r.associatedtreatmenttemplatename ?? '',
        notes: r.notes ?? '',
      });
    }
    if (valid.length) {
      await materialsRepo.createMany(valid);
      setMaterials(await materialsRepo.list());
    }
    return { imported: valid.length, skipped: rows.length - valid.length };
  };

  if (!materials) return <PageLoading />;

  return (
    <PageBody>
      <PageHeader icon={Package} title={t('Materials')} description={t('Consumables and supplies used on wards and in procedures. Stock on hand is under Inventory.')}
        actions={<>
          <CsvImport what={t('materials')} importRows={importRows}
            columns={[
              { name: 'Name', required: true },
              { name: 'UnitOfMeasure', required: true, hint: 'e.g. pack, box, each' },
              { name: 'Category' },
              { name: 'ListPrice', hint: 'price per unit, e.g. 250' },
              { name: 'AssociatedTreatmentTemplateName', hint: 'exact name of a treatment template' },
              { name: 'Notes' },
            ]}
            example={'Name,Category,UnitOfMeasure,ListPrice,AssociatedTreatmentTemplateName,Notes\nSutures 3-0 Silk,Surgical Supplies,pack,250.00,Post-Op Knee Checkup,Pack of 12'} />
          <Button asChild><Link href="/materials/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Material')}</Link></Button>
        </>} />

      <Card>
        <CardContent className="pt-6">
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No materials yet. Add one, or import a list from a CSV file.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="hidden text-right md:table-cell">List price</TableHead>
                  <TableHead className="hidden lg:table-cell">Treatment template</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...materials].sort((a, b) => a.name.localeCompare(b.name)).map(mat => (
                  <TableRow key={mat.id}>
                    <TableCell className="font-medium">{mat.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{mat.category || '—'}</TableCell>
                    <TableCell>{mat.unitOfMeasure}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{mat.listPrice != null ? formatINR(mat.listPrice) : '—'}</TableCell>
                    <TableCell className="hidden max-w-xs truncate lg:table-cell">{mat.associatedTreatmentTemplateName || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild aria-label={`Edit ${mat.name}`}>
                        <Link href={`/materials/form?id=${mat.id}`}><Edit3 className="h-4 w-4" /></Link>
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
