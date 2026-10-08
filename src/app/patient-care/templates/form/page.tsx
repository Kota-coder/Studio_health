"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, PlusCircle, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import type { TreatmentTemplate, TreatmentTemplateField, TreatmentTemplateFieldOption } from '@/config/treatmentTemplates';
import { treatmentTemplates as templatesRepo } from '@/lib/data';

const FIELD_TYPES: TreatmentTemplateField['fieldType'][] = ['text', 'textarea', 'number', 'select'];
const newFieldId = () => `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const emptyField = (): TreatmentTemplateField => ({ fieldId: newFieldId(), label: '', fieldType: 'text', required: false, options: [] });

// Create or edit a care note template: a name and the fields a care note asks for.
// Access is checked by PageGuard.
export default function CareNoteTemplateFormPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const editId = searchParams.get('id');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<TreatmentTemplateField[]>(() => (editId ? [] : [emptyField()]));
  const [isLoading, setIsLoading] = useState(!!editId);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    templatesRepo.get(editId).then(template => {
      if (!template) {
        toast({ title: 'Template not found', variant: 'destructive' });
        router.push('/patient-care');
        return;
      }
      setName(template.name);
      setDescription(template.description || '');
      setFields(template.careNoteFields.map(f => ({ ...f, options: f.options || [] })));
    }).catch(() => toast({ title: 'Could not load the template', variant: 'destructive' }))
      .finally(() => setIsLoading(false));
  }, [editId, router, toast]);

  const updateField = (index: number, patch: Partial<TreatmentTemplateField>) =>
    setFields(prev => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const setFieldType = (index: number, fieldType: TreatmentTemplateField['fieldType']) => {
    const current = fields[index].options ?? [];
    // A list needs at least one choice; other types have none.
    updateField(index, { fieldType, options: fieldType === 'select' ? (current.length ? current : [{ label: '', value: '' }]) : [] });
  };

  const removeField = (index: number) => {
    if (fields.length > 1) setFields(prev => prev.filter((_, i) => i !== index));
    else toast({ title: 'A template needs at least one field' });
  };

  const updateOption = (fieldIndex: number, optionIndex: number, patch: Partial<TreatmentTemplateFieldOption>) =>
    updateField(fieldIndex, { options: (fields[fieldIndex].options ?? []).map((o, i) => (i === optionIndex ? { ...o, ...patch } : o)) });

  const addOption = (fieldIndex: number) =>
    updateField(fieldIndex, { options: [...(fields[fieldIndex].options ?? []), { label: '', value: '' }] });

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const options = fields[fieldIndex].options ?? [];
    if (options.length > 1) updateField(fieldIndex, { options: options.filter((_, i) => i !== optionIndex) });
    else toast({ title: 'A list needs at least one choice' });
  };

  const handleSubmit = async () => {
    const invalid = (title: string, text: string) => toast({ title, description: text, variant: 'destructive' });
    if (!name.trim()) return invalid('Enter the template name', 'Template name is required.');
    if (fields.some(f => !f.label.trim())) return invalid('Check the fields', 'Every field needs a label.');
    if (fields.some(f => f.fieldType === 'select' && (!f.options?.length || f.options.some(o => !o.label.trim() || !o.value.trim())))) {
      return invalid('Check the fields', 'Every list field needs at least one choice, each with a label and a value.');
    }
    const data: Omit<TreatmentTemplate, 'id'> = {
      name: name.trim(),
      description: description.trim(),
      careNoteFields: fields.map(f => ({ ...f, fieldId: f.fieldId || newFieldId() })),
    };
    setIsSaving(true);
    try {
      if (editId) await templatesRepo.update(editId, data);
      else await templatesRepo.create(data);
      toast({ title: 'Saved', description: editId ? 'Template updated.' : 'Template created.' });
      router.push('/patient-care');
    } catch {
      toast({ title: 'Could not save the template', description: 'Please check your connection and try again.', variant: 'destructive' });
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <PageBody width="medium">
      <PageHeader icon={FileText} back={{ href: '/patient-care', label: t('Care Note Templates') }}
        title={editId ? t('Edit Template') : t('Add Template')}
        description={t('A template sets the fields a care note asks for.')} />
      <Card>
        <CardContent className="grid gap-6 pt-6">
          <div>
            <Label htmlFor="templateName">Template name *</Label>
            <Input id="templateName" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Cardiac Stress Test Follow-up" />
          </div>
          <div>
            <Label htmlFor="templateDescription">Description (optional)</Label>
            <Textarea id="templateDescription" value={description} onChange={e => setDescription(e.target.value)} placeholder="What this template is for" />
          </div>

          <Card className="bg-muted/50">
            <CardHeader className="pb-3"><CardTitle className="text-lg">{t('Fields')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.fieldId || index} className="space-y-3 rounded-md border bg-background p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Field {index + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeField(index)} className="text-destructive hover:bg-destructive/10" aria-label={`Remove field ${index + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor={`fieldLabel-${index}`}>Label * (what staff see)</Label>
                    <Input id={`fieldLabel-${index}`} value={field.label} onChange={e => updateField(index, { label: e.target.value })} placeholder="e.g., Blood Pressure, Medication Dosage" />
                  </div>
                  <div>
                    <Label htmlFor={`fieldType-${index}`}>Type *</Label>
                    <Select value={field.fieldType} onValueChange={v => setFieldType(index, v as TreatmentTemplateField['fieldType'])}>
                      <SelectTrigger id={`fieldType-${index}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(type => <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {field.fieldType === 'select' && (
                    <div className="space-y-2 border-l-2 border-primary/50 pl-3 sm:pl-4">
                      <p className="text-sm font-medium">Choices</p>
                      {(field.options ?? []).map((option, optIndex) => (
                        <div key={optIndex} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                          <Input value={option.label} onChange={e => updateOption(index, optIndex, { label: e.target.value })} placeholder={`Choice ${optIndex + 1} label`} className="h-9 min-w-0 text-sm" aria-label={`Choice ${optIndex + 1} label`} />
                          <Input value={option.value} onChange={e => updateOption(index, optIndex, { value: e.target.value })} placeholder={`Choice ${optIndex + 1} value`} className="h-9 min-w-0 text-sm" aria-label={`Choice ${optIndex + 1} value`} />
                          <Button variant="ghost" size="icon" onClick={() => removeOption(index, optIndex)} className="h-9 w-9 text-destructive hover:bg-destructive/10" aria-label={`Remove choice ${optIndex + 1}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => addOption(index)}>
                        <PlusCircle className="mr-2 h-3 w-3" /> Add choice
                      </Button>
                    </div>
                  )}

                  <div>
                    <Label htmlFor={`fieldPlaceholder-${index}`}>Placeholder (optional)</Label>
                    <Input id={`fieldPlaceholder-${index}`} value={field.placeholder || ''} onChange={e => updateField(index, { placeholder: e.target.value })} placeholder="e.g., Weight in kg" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id={`fieldRequired-${index}`} checked={!!field.required} onCheckedChange={checked => updateField(index, { required: checked === true })} />
                    <Label htmlFor={`fieldRequired-${index}`} className="text-sm font-normal">Required</Label>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={() => setFields(prev => [...prev, emptyField()])} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> {t('Add Field')}
              </Button>
            </CardContent>
          </Card>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" asChild><Link href="/patient-care">{t('Cancel')}</Link></Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : editId ? t('Save Changes') : t('Add Template')}
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
