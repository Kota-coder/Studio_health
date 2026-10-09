"use client";

import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FlaskConical, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { TestParametersEditor, fromDrafts, toDrafts, type ParameterDraft } from '@/components/test-parameters-editor';
import { builtinParameters } from '@/lib/test-templates';
import { useToast } from '@/hooks/use-toast';
import { testCatalog as testCatalogRepo } from '@/lib/data';
import type { MedicalTestCatalogItem } from '@/types/medicalTestCatalogItem';

// Add or edit a medical test: its price and its result template (the parameters the lab
// fills in). Access is checked by PageGuard.
export default function MedicalTestFormPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const editId = searchParams.get('id');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('');
  const [parameters, setParameters] = useState<ParameterDraft[]>([]);
  const [isLoading, setIsLoading] = useState(!!editId);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    testCatalogRepo.get(editId).then(item => {
      if (!item) {
        toast({ title: 'Medical test not found', variant: 'destructive' });
        router.push('/medical-tests');
        return;
      }
      setName(item.name);
      setCategory(item.category);
      setDescription(item.description || '');
      setDefaultPrice(item.defaultPrice != null ? String(item.defaultPrice) : '');
      // A test without its own template starts from the built-in one for its name, if any.
      setParameters(toDrafts(item.fields?.length ? item.fields : builtinParameters(item.name)));
    }).catch(() => toast({ title: 'Could not load the medical test', variant: 'destructive' }))
      .finally(() => setIsLoading(false));
  }, [editId, router, toast]);

  const invalid = (title: string, description: string) => toast({ title, description, variant: 'destructive' });

  const handleSubmit = async () => {
    if (!name.trim()) return invalid('Enter the name', 'Test name is required.');
    if (!category.trim()) return invalid('Enter the category', 'Category is required.');
    let price: number | undefined;
    if (defaultPrice.trim() !== '') {
      price = Number(defaultPrice);
      if (!Number.isFinite(price) || price < 0) return invalid('Check the price', 'Price must be 0 or more, or left empty.');
    }
    const fields = fromDrafts(parameters);
    if (typeof fields === 'string') return invalid('Check the result parameters', fields);
    const data: Omit<MedicalTestCatalogItem, 'id'> = {
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || undefined,
      defaultPrice: price,
      fields,
    };
    setIsSaving(true);
    try {
      if (editId) await testCatalogRepo.update(editId, data);
      else await testCatalogRepo.create(data);
      toast({ title: 'Saved', description: editId ? 'Medical test updated.' : 'Medical test added.' });
      router.push('/medical-tests');
    } catch {
      toast({ title: 'Could not save the medical test', description: 'Please check your connection and try again.', variant: 'destructive' });
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <PageBody width="narrow">
      <PageHeader icon={FlaskConical} back={{ href: '/medical-tests', label: t('Medical Tests') }}
        title={editId ? t('Edit Test') : t('Add Test')}
        description={editId ? t('Update the details of this test.') : t('Fill in the details of the new test.')} />
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <div>
            <Label htmlFor="testName">Test name *</Label>
            <Input id="testName" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Complete Blood Count (CBC)" />
          </div>
          <div>
            <Label htmlFor="category">Category *</Label>
            <Input id="category" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Blood Work, Imaging, Cardiology" />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What the test is for, or what it includes" />
          </div>
          <div>
            <Label htmlFor="defaultPrice">Price (₹) (optional)</Label>
            <Input id="defaultPrice" type="number" inputMode="decimal" value={defaultPrice} onChange={e => setDefaultPrice(e.target.value)} placeholder="e.g., 1200.00" min="0" step="0.01" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Result template')}</CardTitle>
          <CardDescription>{t('What the lab technician fills in for this test. Numbers can have a unit and a normal range; results outside it are marked High or Low.')}</CardDescription>
        </CardHeader>
        <CardContent>
          <TestParametersEditor value={parameters} onChange={setParameters} />
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" asChild><Link href="/medical-tests">{t('Cancel')}</Link></Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : editId ? t('Save Changes') : t('Add Test')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
