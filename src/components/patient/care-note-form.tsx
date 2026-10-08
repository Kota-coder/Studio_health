"use client";

import { useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/components/language-provider';
import { AddMedicationDialog, type NoteMedication } from '@/components/patient/add-medication-dialog';
import { AttachmentPicker } from '@/components/patient/attachment-picker';
import { useStaff } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import { useToast } from '@/hooks/use-toast';
import { patients as patientsRepo } from '@/lib/data';
import { uploadNewImages } from '@/lib/storage';
import type { TreatmentTemplate } from '@/config/treatmentTemplates';
import type { Medication } from '@/types/medication';
import type { Patient } from '@/types/patient';

type FieldValue = string | number | boolean;

// A new care note: optional template fields, free text, medications and images.
export function CareNoteForm({ patient, templates, medications, loadMedications, onSaved, onCancel }: {
  patient: Patient;
  templates: TreatmentTemplate[] | null;
  medications: Medication[] | null;
  loadMedications: () => void;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const { isOn } = useFeatures();
  const currentUser = useStaff();
  const [templateId, setTemplateId] = useState('none');
  const [fields, setFields] = useState<Record<string, FieldValue>>({});
  const [text, setText] = useState('');
  const [noteMedications, setNoteMedications] = useState<NoteMedication[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const template = templateId === 'none' ? null : templates?.find(tpl => tpl.id === templateId) ?? null;
  const setField = (fieldId: string, value: FieldValue) => setFields(prev => ({ ...prev, [fieldId]: value }));

  const save = async () => {
    if (!text.trim() && !template) {
      toast({ title: 'Note is empty', description: 'Note text is required for general notes, or select a template.', variant: 'destructive' });
      return;
    }
    const assigned = patient.assignedStaffIds ?? [];
    if (assigned.length > 0 && !assigned.includes(currentUser.id)) {
      toast({ title: 'Not assigned', description: 'You are not assigned to this patient to add care notes.', variant: 'destructive' });
      return;
    }
    const missing = template?.careNoteFields.find(field => field.required && String(fields[field.fieldId] ?? '').trim() === '');
    if (missing) {
      toast({ title: 'Missing details', description: `${missing.label} is required for this template.`, variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await patientsRepo.addCareNote(patient.id, {
        text: text.trim(),
        staffId: currentUser.id,
        staffName: currentUser.name,
        templateId: template?.id,
        templateName: template?.name,
        templateFieldsData: template ? { ...fields } : undefined,
        medicationsMentioned: [...noteMedications],
        attachments: await uploadNewImages(attachments, `patients/${patient.id}/care-notes`),
      });
      await onSaved();
      toast({ title: 'Note added' });
    } catch (e) {
      console.error('Failed to save care note:', e);
      toast({ title: 'Could not save the note', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mb-4 space-y-3 rounded-md border bg-muted/30 p-4">
      <div>
        <Label htmlFor="treatmentTemplate">Treatment Template</Label>
        <Select onValueChange={id => { setTemplateId(id); setFields({}); }} value={templateId} disabled={!templates}>
          <SelectTrigger id="treatmentTemplate"><SelectValue placeholder="Select a Treatment Template or General Note" /></SelectTrigger>
          <SelectContent>
            {(templates ?? []).map(tpl => <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {template?.careNoteFields.map(field => {
        const id = `templateField-${field.fieldId}`;
        return (
          <div key={field.fieldId}>
            <Label htmlFor={id}>{field.label}{field.required ? ' *' : ''}</Label>
            {field.fieldType === 'textarea' ? (
              <Textarea id={id} rows={3} placeholder={field.placeholder} value={String(fields[field.fieldId] ?? '')} onChange={e => setField(field.fieldId, e.target.value)} />
            ) : field.fieldType === 'select' && field.options ? (
              <Select onValueChange={value => setField(field.fieldId, value)} value={String(fields[field.fieldId] ?? '')}>
                <SelectTrigger id={id}><SelectValue placeholder={field.placeholder || `Select ${field.label}`} /></SelectTrigger>
                <SelectContent>
                  {field.options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input id={id} type={field.fieldType} placeholder={field.placeholder} min={field.fieldType === 'number' ? 0 : undefined}
                value={String(fields[field.fieldId] ?? '')}
                onChange={e => setField(field.fieldId, field.fieldType === 'number' ? parseFloat(e.target.value) || '' : e.target.value)} />
            )}
          </div>
        );
      })}

      <div>
        <Label htmlFor="newNote">General Note Text (Optional if template used)</Label>
        <Textarea id="newNote" value={text} onChange={e => setText(e.target.value)} placeholder={`Add general notes for ${patient.firstName}...`} rows={3} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="font-medium">Medications for this Note Entry</Label>
          {isOn('medications') && (
            <AddMedicationDialog medications={medications} onOpen={loadMedications} onAdd={med => setNoteMedications(prev => [...prev, med])} />
          )}
        </div>
        {noteMedications.length > 0 ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-2">
            {noteMedications.map((med, index) => (
              <div key={index} className="flex items-start justify-between border-b p-1.5 text-sm last:border-b-0">
                <div className="min-w-0 break-words">
                  <p className="font-semibold">{med.medicationName}</p>
                  {med.dosage && <p className="text-xs text-muted-foreground">Dosage: {med.dosage}</p>}
                  {med.notes && <p className="text-xs text-muted-foreground">Notes: {med.notes}</p>}
                </div>
                <Button variant="ghost" size="icon" aria-label={`Remove ${med.medicationName}`} className="h-6 w-6 text-destructive hover:bg-destructive/10"
                  onClick={() => setNoteMedications(prev => prev.filter((_, i) => i !== index))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">No medications added to this note yet.</p>
        )}
      </div>

      <AttachmentPicker id="newNoteAttachment" value={attachments} onChange={setAttachments} />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>{t('Cancel')}</Button>
        <Button onClick={save} disabled={isSaving}>
          <PlusCircle className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : t('Add Note')}
        </Button>
      </div>
    </div>
  );
}
