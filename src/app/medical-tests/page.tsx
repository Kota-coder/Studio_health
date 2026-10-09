"use client";

import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { Edit3, FlaskConical, PlusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { CsvImport } from '@/components/csv-import';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { testCatalog as testCatalogRepo } from '@/lib/data';
import { formatINR } from '@/lib/format';
import { parametersFor } from '@/lib/test-templates';
import type { MedicalTestCatalogItem } from '@/types/medicalTestCatalogItem';

// The tests the hospital offers, with their usual price.
// Access and the feature switch are checked by PageGuard (src/config/navigation.ts).
export default function MedicalTestsPage() {
  const t = useT();
  const { toast } = useToast();
  const [tests, setTests] = useState<MedicalTestCatalogItem[] | null>(null);
  const [toDelete, setToDelete] = useState<MedicalTestCatalogItem | null>(null);

  useEffect(() => {
    testCatalogRepo.list()
      .then(setTests)
      .catch(() => {
        toast({ title: 'Error', description: 'Could not load medical tests.', variant: 'destructive' });
        setTests([]);
      });
  }, [toast]);

  const deleteTest = async (item: MedicalTestCatalogItem) => {
    try {
      await testCatalogRepo.remove(item.id);
      setTests(prev => (prev ?? []).filter(i => i.id !== item.id));
      toast({ title: 'Deleted', description: `"${item.name}" was removed from the list.` });
    } catch {
      toast({ title: 'Could not delete the test', description: 'Please check your connection and try again.', variant: 'destructive' });
    }
  };

  const importRows = async (rows: Record<string, string>[]) => {
    const valid: Omit<MedicalTestCatalogItem, 'id'>[] = [];
    for (const r of rows) {
      const defaultPrice = r.defaultprice ? Number(r.defaultprice) : undefined;
      if (!r.name || !r.category) continue;
      if (defaultPrice !== undefined && !(Number.isFinite(defaultPrice) && defaultPrice >= 0)) continue;
      valid.push({ name: r.name, category: r.category, description: r.description ?? '', defaultPrice });
    }
    if (valid.length) {
      await testCatalogRepo.createMany(valid);
      setTests(await testCatalogRepo.list());
    }
    return { imported: valid.length, skipped: rows.length - valid.length };
  };

  if (!tests) return <PageLoading />;

  return (
    <PageBody>
      <PageHeader icon={FlaskConical} title={t('Medical Tests')} description={t('The tests the hospital offers, with their price and the results the lab records for each.')}
        actions={<>
          <CsvImport what={t('medical tests')} importRows={importRows}
            columns={[
              { name: 'Name', required: true },
              { name: 'Category', required: true, hint: 'e.g. Blood Work, Imaging' },
              { name: 'Description' },
              { name: 'DefaultPrice', hint: 'e.g. 1200' },
            ]}
            example={'Name,Category,Description,DefaultPrice\nComplete Blood Count (CBC),Blood Work,Standard panel of blood tests,1200.00'} />
          <Button asChild><Link href="/medical-tests/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Test')}</Link></Button>
        </>} />

      <Card>
        <CardContent className="pt-6">
          {tests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No medical tests yet. Add one, or import a list from a CSV file.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test name</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Result template</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...tests].sort((a, b) => a.name.localeCompare(b.name)).map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-medium">{item.name}</span>
                      <span className="block text-xs text-muted-foreground sm:hidden">{item.category}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{item.category}</TableCell>
                    <TableCell className="hidden max-w-xs truncate text-sm text-muted-foreground md:table-cell">
                      {parametersFor(item).map(p => p.label).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.defaultPrice != null ? formatINR(item.defaultPrice) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild aria-label={`Edit ${item.name}`}>
                          <Link href={`/medical-tests/form?id=${item.id}`}><Edit3 className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setToDelete(item)} aria-label={`Delete ${item.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={open => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete this test?')}</AlertDialogTitle>
            <AlertDialogDescription>&quot;{toDelete?.name}&quot; will be removed from the list of tests.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (toDelete) deleteTest(toDelete); }}>
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
