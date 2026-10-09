"use client";

import { useState } from 'react';
import { AlertTriangle, Edit3, NotebookPen, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { patients as patientsRepo } from '@/lib/data';
import type { Patient } from '@/types/patient';

type HistoryKey = 'allergies' | 'chronicConditions' | 'pastHistory' | 'familyHistory' | 'homeMedications';

export const HISTORY_FIELDS: Array<{ key: HistoryKey; label: string; placeholder: string }> = [
  { key: 'allergies', label: 'Allergies', placeholder: 'e.g., Penicillin (rash), peanuts. Write "None known" if there are none.' },
  { key: 'chronicConditions', label: 'Long-term conditions', placeholder: 'e.g., Type 2 diabetes since 2018, hypertension' },
  { key: 'pastHistory', label: 'Past illnesses, operations and hospital stays', placeholder: 'e.g., Appendectomy 2015; admitted for dengue 2021' },
  { key: 'familyHistory', label: 'Family history', placeholder: 'e.g., Father: heart attack at 55' },
  { key: 'homeMedications', label: 'Medicines taken at home', placeholder: 'e.g., Metformin 500 mg twice daily' },
];

// The patient's medical history: allergies, long-term conditions, past history, family
// history and the medicines they already take. Shown on the patient page's overview and on
// the Treatment Summary; anyone caring for the patient can update it.
export function MedicalHistoryCard({ patient, onSaved }: { patient: Patient; onSaved: () => Promise<void> }) {
  const t = useT();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<HistoryKey, string>>(() => blankDraft(patient));
  const [isSaving, setIsSaving] = useState(false);
  const recorded = HISTORY_FIELDS.filter(f => patient[f.key]?.trim());

  const startEditing = () => { setDraft(blankDraft(patient)); setEditing(true); };

  const save = async () => {
    const changes = Object.fromEntries(HISTORY_FIELDS.map(f => [f.key, draft[f.key].trim() || undefined]));
    const changed = HISTORY_FIELDS.filter(f => (patient[f.key] ?? '') !== (draft[f.key].trim())).map(f => f.label);
    if (changed.length === 0) { setEditing(false); return; }
    setIsSaving(true);
    try {
      await patientsRepo.update(patient.id, changes, { actionType: 'Medical History Updated', details: `Updated: ${changed.join(', ')}.` });
      await onSaved();
      setEditing(false);
      toast({ title: t('Medical history saved') });
    } catch (e) {
      toast({ title: t('Could not save the medical history'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center"><NotebookPen className="mr-2 h-5 w-5 text-primary" />{t('Medical History')}</CardTitle>
          <CardDescription>{t('Allergies, long-term conditions and past history.')}</CardDescription>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEditing}><Edit3 className="mr-2 h-4 w-4" /> {recorded.length ? t('Edit') : t('Add')}</Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            {HISTORY_FIELDS.map(f => (
              <div key={f.key}>
                <Label htmlFor={`history-${f.key}`}>{t(f.label)}</Label>
                <Textarea id={`history-${f.key}`} rows={2} value={draft[f.key]} placeholder={f.placeholder}
                  onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>{t('Cancel')}</Button>
              <Button onClick={save} disabled={isSaving}><Save className="mr-2 h-4 w-4" /> {isSaving ? t('Saving…') : t('Save')}</Button>
            </div>
          </div>
        ) : recorded.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t('No medical history recorded yet. Ask about allergies first.')}</p>
        ) : (
          <dl className="space-y-2 text-sm">
            {HISTORY_FIELDS.map(f => {
              const value = patient[f.key]?.trim();
              if (!value && f.key !== 'allergies') return null;
              const alert = f.key === 'allergies' && hasAllergies(value);
              return (
                <div key={f.key}>
                  <dt className="flex items-center gap-1 font-medium text-muted-foreground">
                    {alert && <AlertTriangle className="h-4 w-4 text-destructive" />}{t(f.label)}
                  </dt>
                  <dd className={alert ? 'whitespace-pre-wrap font-semibold text-destructive' : 'whitespace-pre-wrap'}>
                    {value || <span className="italic text-muted-foreground">{t('Not recorded')}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

// True when allergies are recorded and aren't "none known" (or the like).
export const hasAllergies = (allergies?: string | null) =>
  !!allergies?.trim() && !/^(none|nil|no\b|nkda|nka|not known)/i.test(allergies.trim());

const blankDraft = (patient: Patient) =>
  Object.fromEntries(HISTORY_FIELDS.map(f => [f.key, patient[f.key] ?? ''])) as Record<HistoryKey, string>;
