"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pill, Save } from 'lucide-react';
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
import { medications as medicationsRepo, treatmentTemplates as templatesRepo } from '@/lib/data';
import type { Medication } from '@/types/medication';

// Add or edit a pharmacy item. Access is checked by PageGuard.
export default function PharmacyItemFormPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const editId = searchParams.get('id');

  const [name, setName] = useState('');
  const [treatment, setTreatment] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [quantityInPackage, setQuantityInPackage] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [templateNames, setTemplateNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadTemplates = templatesRepo.list()
      .then(custom => setTemplateNames([...new Set([...TREATMENT_TEMPLATES, ...custom].map(tpl => tpl.name))]))
      .catch(() => {
        setTemplateNames(TREATMENT_TEMPLATES.map(tpl => tpl.name));
        toast({ title: 'Could not load custom treatment templates' });
      });
    const loadItem = editId
      ? medicationsRepo.get(editId).then(med => {
          if (!med) {
            toast({ title: 'Pharmacy item not found', variant: 'destructive' });
            router.push('/pharmacy');
            return;
          }
          setName(med.name);
          setTreatment(med.treatment);
          setListPrice(String(med.listPrice));
          setQuantityInPackage(med.quantityInPackage != null ? String(med.quantityInPackage) : '');
          setUnitOfMeasure(med.unitOfMeasure);
          setAdditionalNotes(med.additionalNotes || '');
          setReorderLevel(med.reorderLevel != null ? String(med.reorderLevel) : '');
        }).catch(() => toast({ title: 'Could not load the pharmacy item', variant: 'destructive' }))
      : Promise.resolve();
    Promise.all([loadTemplates, loadItem]).finally(() => setIsLoading(false));
  }, [editId, router, toast]);

  const invalid = (title: string, description: string) => toast({ title, description, variant: 'destructive' });

  const handleSubmit = async () => {
    if (!name.trim()) return invalid('Enter the name', 'Name is required.');
    if (!treatment) return invalid('Choose the treatment / purpose', 'Select a treatment template.');
    const price = Number(listPrice);
    if (listPrice.trim() === '' || !Number.isFinite(price) || price < 0) return invalid('Check the price', 'List price must be 0 or more.');
    let quantity: number | undefined;
    if (quantityInPackage.trim() !== '') {
      quantity = Number(quantityInPackage);
      if (!Number.isInteger(quantity) || quantity <= 0) return invalid('Check the quantity', 'Quantity in package must be a whole number above 0.');
    }
    if (!unitOfMeasure.trim()) return invalid('Enter the unit', 'Unit of measure is required.');
    const reorderValue = reorderLevel.trim() === '' ? null : Number(reorderLevel);
    if (reorderValue !== null && (!Number.isFinite(reorderValue) || reorderValue < 0)) return invalid('Check the refill level', 'Enter 0 or more, or leave it empty.');

    const data: Omit<Medication, 'id'> = {
      name: name.trim(),
      treatment,
      listPrice: price,
      quantityInPackage: quantity,
      unitOfMeasure: unitOfMeasure.trim(),
      additionalNotes: additionalNotes.trim(),
      reorderLevel: reorderValue,
    };
    setIsSaving(true);
    try {
      if (editId) await medicationsRepo.update(editId, data);
      else await medicationsRepo.create(data);
      toast({ title: 'Saved', description: editId ? 'Pharmacy item updated.' : 'Pharmacy item added.' });
      router.push('/pharmacy');
    } catch {
      toast({ title: 'Could not save the pharmacy item', description: 'Please check your connection and try again.', variant: 'destructive' });
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  // An item imported with a treatment that is not a template still shows its value.
  const treatmentOptions = treatment && !templateNames.includes(treatment) ? [treatment, ...templateNames] : templateNames;

  return (
    <PageBody width="narrow">
      <PageHeader icon={Pill} back={{ href: '/pharmacy', label: t('Pharmacy') }}
        title={editId ? t('Edit Pharmacy Item') : t('Add Pharmacy Item')}
        description={editId ? t('Update the details of this pharmacy item.') : t('Fill in the details of the new pharmacy item.')} />
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <div>
            <Label htmlFor="name">Medicine / item name *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Amoxicillin 500mg" />
          </div>
          <div>
            <Label htmlFor="treatment">Treatment / purpose *</Label>
            <Select onValueChange={setTreatment} value={treatment}>
              <SelectTrigger id="treatment"><SelectValue placeholder="Select a treatment template" /></SelectTrigger>
              <SelectContent>
                {treatmentOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="listPrice">List price (₹) for the package *</Label>
              <Input id="listPrice" type="number" inputMode="decimal" value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="e.g., 150.75" min="0" step="0.01" />
            </div>
            <div>
              <Label htmlFor="quantityInPackage">Quantity in package (optional, whole number)</Label>
              <Input id="quantityInPackage" type="number" inputMode="numeric" value={quantityInPackage} onChange={e => setQuantityInPackage(e.target.value)} placeholder="e.g., 10, 100" min="0" step="1" />
            </div>
          </div>
          <div>
            <Label htmlFor="unitOfMeasure">Unit of measure *</Label>
            <Input id="unitOfMeasure" value={unitOfMeasure} onChange={e => setUnitOfMeasure(e.target.value)} placeholder="e.g., tablet, ml, bottle, strip" />
          </div>
          <div>
            <Label htmlFor="reorderLevel">Refill when stock falls to (optional)</Label>
            <Input id="reorderLevel" type="number" inputMode="decimal" min="0" step="any" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} placeholder="e.g., 10" />
            <p className="mt-1 text-xs text-muted-foreground">In the unit above (the unit the price is for). The Inventory page lists the item under &quot;Needs refill&quot; at or below this.</p>
          </div>
          <div>
            <Label htmlFor="additionalNotes">Additional notes (optional)</Label>
            <Textarea id="additionalNotes" value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder="e.g., Storage instructions, common side effects, manufacturer" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" asChild><Link href="/pharmacy">{t('Cancel')}</Link></Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : editId ? t('Save Changes') : t('Add Pharmacy Item')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
