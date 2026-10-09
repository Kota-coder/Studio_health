"use client";

import { ArrowDown, ArrowUp, PlusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/components/language-provider';
import { parameterId } from '@/lib/test-templates';
import type { TestParameter } from '@/types/medicalTestCatalogItem';

// A parameter while it is being edited: numbers and options stay as typed.
export interface ParameterDraft {
  key: number;
  id?: string; // kept for existing parameters, so earlier results still match
  label: string;
  type: TestParameter['type'];
  unit: string;
  low: string;
  high: string;
  options: string; // comma separated
  required: boolean;
}

let nextKey = 1;
const blank = (): ParameterDraft => ({ key: nextKey++, label: '', type: 'number', unit: '', low: '', high: '', options: '', required: false });

export const toDrafts = (params: TestParameter[]): ParameterDraft[] => params.map(p => ({
  key: nextKey++, id: p.id, label: p.label, type: p.type, unit: p.unit ?? '',
  low: p.low != null ? String(p.low) : '', high: p.high != null ? String(p.high) : '',
  options: (p.options ?? []).join(', '), required: !!p.required,
}));

// The parameters to save, or an error message.
export function fromDrafts(drafts: ParameterDraft[]): TestParameter[] | string {
  const params: TestParameter[] = [];
  for (const d of drafts) {
    const label = d.label.trim();
    if (!label) return 'Every parameter needs a name (or remove the empty row).';
    const num = (text: string) => (text.trim() === '' ? undefined : Number(text));
    const low = d.type === 'number' ? num(d.low) : undefined;
    const high = d.type === 'number' ? num(d.high) : undefined;
    if ([low, high].some(n => n !== undefined && !Number.isFinite(n))) return `Check the normal range of "${label}".`;
    if (low !== undefined && high !== undefined && low > high) return `The normal range of "${label}" runs from low to high.`;
    const options = d.type === 'choice' ? d.options.split(',').map(o => o.trim()).filter(Boolean) : undefined;
    if (d.type === 'choice' && !options?.length) return `Add the choices for "${label}", separated by commas.`;
    params.push({
      id: d.id ?? parameterId(label, params.map(p => p.id).concat(drafts.flatMap(x => (x.id ? [x.id] : [])))),
      label, type: d.type,
      ...(d.type === 'number' && d.unit.trim() ? { unit: d.unit.trim() } : {}),
      ...(low !== undefined ? { low } : {}), ...(high !== undefined ? { high } : {}),
      ...(options ? { options } : {}),
      ...(d.required ? { required: true } : {}),
    });
  }
  return params;
}

const TYPES: Array<{ value: TestParameter['type']; label: string }> = [
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'choice', label: 'Choice' },
];

// The result parameters of a test template: name, kind of value, unit and normal range.
export function TestParametersEditor({ value, onChange }: { value: ParameterDraft[]; onChange: (drafts: ParameterDraft[]) => void }) {
  const t = useT();
  const update = (key: number, changes: Partial<ParameterDraft>) => onChange(value.map(d => (d.key === key ? { ...d, ...changes } : d)));
  const move = (index: number, by: number) => {
    const next = [...value];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && <p className="text-sm text-muted-foreground">{t('No parameters yet. Results will have a summary and notes only.')}</p>}
      {value.map((d, index) => (
        <div key={d.key} className="space-y-3 rounded-md border p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div>
              <Label htmlFor={`param-label-${d.key}`}>{t('Parameter')} *</Label>
              <Input id={`param-label-${d.key}`} value={d.label} onChange={e => update(d.key, { label: e.target.value })} placeholder="e.g., Hemoglobin" />
            </div>
            <div>
              <Label htmlFor={`param-type-${d.key}`}>{t('Type')}</Label>
              <Select value={d.type} onValueChange={v => update(d.key, { type: v as TestParameter['type'] })}>
                <SelectTrigger id={`param-type-${d.key}`}><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(type => <SelectItem key={type.value} value={type.value}>{t(type.label)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {d.type === 'number' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor={`param-unit-${d.key}`}>{t('Unit')}</Label>
                <Input id={`param-unit-${d.key}`} value={d.unit} onChange={e => update(d.key, { unit: e.target.value })} placeholder="g/dL" />
              </div>
              <div>
                <Label htmlFor={`param-low-${d.key}`}>{t('Normal from')}</Label>
                <Input id={`param-low-${d.key}`} type="number" inputMode="decimal" step="any" value={d.low} onChange={e => update(d.key, { low: e.target.value })} placeholder="12" />
              </div>
              <div>
                <Label htmlFor={`param-high-${d.key}`}>{t('Normal to')}</Label>
                <Input id={`param-high-${d.key}`} type="number" inputMode="decimal" step="any" value={d.high} onChange={e => update(d.key, { high: e.target.value })} placeholder="16" />
              </div>
            </div>
          )}
          {d.type === 'choice' && (
            <div>
              <Label htmlFor={`param-options-${d.key}`}>{t('Choices (separated by commas)')}</Label>
              <Input id={`param-options-${d.key}`} value={d.options} onChange={e => update(d.key, { options: e.target.value })} placeholder="Negative, Positive" />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={d.required} onCheckedChange={v => update(d.key, { required: v === true })} /> {t('Required')}
            </label>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('Move up')}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={t('Move down')}><ArrowDown className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => onChange(value.filter(x => x.key !== d.key))} aria-label={t('Remove')}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => onChange([...value, blank()])}><PlusCircle className="mr-2 h-4 w-4" /> {t('Add parameter')}</Button>
    </div>
  );
}
