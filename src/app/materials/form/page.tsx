"use client";

import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { TREATMENT_TEMPLATES } from '@/config/treatmentTemplates';
import { materials as materialsRepo, treatmentTemplates as templatesRepo } from '@/lib/data';
import type { Material } from '@/types/material';

const NO_TEMPLATE = '__none__'; // the "None" option (Select items cannot have an empty value)

// Add or edit a material. Access is checked by PageGuard.
export default function MaterialFormPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const editId = searchParams.get('id');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [notes, setNotes] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [templateNames, setTemplateNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // "General Note (No Template)" is left out: "None" covers it.
    const named = (list: { id: string; name: string }[]) => [...new Set(list.filter(tpl => tpl.id !== 'none').map(tpl => tpl.name))];
    const loadTemplates = templatesRepo.list()
      .then(custom => setTemplateNames(named([...TREATMENT_TEMPLATES, ...custom])))
      .catch(() => {
        setTemplateNames(named(TREATMENT_TEMPLATES));
        toast({ title: 'Could not load custom treatment templates' });
      });
    const loadItem = editId
      ? materialsRepo.get(editId).then(mat => {
          if (!mat) {
            toast({ title: 'Material not found', variant: 'destructive' });
            router.push('/materials');
            return;
          }
          setName(mat.name);
          setCategory(mat.category || '');
          setUnitOfMeasure(mat.unitOfMeasure);
          setListPrice(mat.listPrice != null ? String(mat.listPrice) : '');
          setTemplateName(mat.associatedTreatmentTemplateName || '');
          setNotes(mat.notes || '');
          setReorderLevel(mat.reorderLevel != null ? String(mat.reorderLevel) : '');
        }).catch(() => toast({ title: 'Could not load the material', variant: 'destructive' }))
      : Promise.resolve();
    Promise.all([loadTemplates, loadItem]).finally(() => setIsLoading(false));
  }, [editId, router, toast]);

  const invalid = (title: string, description: string) => toast({ title, description, variant: 'destructive' });

  const handleSubmit = async () => {
    if (!name.trim()) return invalid('Enter the name', 'Material name is required.');
    if (!unitOfMeasure.trim()) return invalid('Enter the unit', 'Unit of measure is required.');
    let price: number | undefined;
    if (listPrice.trim() !== '') {
      price = Number(listPrice);
      if (!Number.isFinite(price) || price < 0) return invalid('Check the price', 'List price must be 0 or more, or left empty.');
    }
    const reorderValue = reorderLevel.trim() === '' ? null : Number(reorderLevel);
    if (reorderValue !== null && (!Number.isFinite(reorderValue) || reorderValue < 0)) return invalid('Check the refill level', 'Enter 0 or more, or leave it empty.');

    const data: Omit<Material, 'id'> = {
      name: name.trim(),
      category: category.trim() || undefined,
      unitOfMeasure: unitOfMeasure.trim(),
      listPrice: price,
      associatedTreatmentTemplateName: templateName || undefined,
      notes: notes.trim() || undefined,
      reorderLevel: reorderValue,
    };
    setIsSaving(true);
    try {
      if (editId) await materialsRepo.update(editId, data);
      else await materialsRepo.create(data);
      toast({ title: 'Saved', description: editId ? 'Material updated.' : 'Material added.' });
      router.push('/materials');
    } catch {
      toast({ title: 'Could not save the material', description: 'Please check your connection and try again.', variant: 'destructive' });
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  const templateOptions = templateName && !templateNames.includes(templateName) ? [templateName, ...templateNames] : templateNames;

  return (
    <PageBody width="narrow">
      <PageHeader icon={Package} back={{ href: '/materials', label: t('Materials') }}
        title={editId ? t('Edit Material') : t('Add Material')}
        description={editId ? t('Update the details of this material.') : t('Fill in the details of the new material.')} />
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <div>
            <Label htmlFor="name">Material name *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Sutures 3-0 Silk, Gauze Pads Large" />
          </div>
          <div>
            <Label htmlFor="category">Category (optional)</Label>
            <Input id="category" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Surgical Supplies, Consumables" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="unitOfMeasure">Unit of measure *</Label>
              <Input id="unitOfMeasure" value={unitOfMeasure} onChange={e => setUnitOfMeasure(e.target.value)} placeholder="e.g., pack, box, each, roll" />
            </div>
            <div>
              <Label htmlFor="listPrice">List price (₹) per unit (optional)</Label>
              <Input id="listPrice" type="number" inputMode="decimal" value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="e.g., 250.00" min="0" step="0.01" />
            </div>
          </div>
          <div>
            <Label htmlFor="reorderLevel">Refill when stock falls to (optional)</Label>
            <Input id="reorderLevel" type="number" inputMode="decimal" min="0" step="any" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} placeholder="e.g., 10" />
            <p className="mt-1 text-xs text-muted-foreground">In the unit above. The Inventory page lists the item under &quot;Needs refill&quot; at or below this.</p>
          </div>
          <div>
            <Label htmlFor="templateName">Treatment template (optional)</Label>
            <Select value={templateName || NO_TEMPLATE} onValueChange={v => setTemplateName(v === NO_TEMPLATE ? '' : v)}>
              <SelectTrigger id="templateName"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEMPLATE}>None</SelectItem>
                {templateOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Additional notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Supplier, storage instructions" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" asChild><Link href="/materials">{t('Cancel')}</Link></Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : editId ? t('Save Changes') : t('Add Material')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
