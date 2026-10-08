"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateField, parseDMY } from '@/components/date-field';
import { useT } from '@/components/language-provider';
import { AttachmentPicker } from '@/components/patient/attachment-picker';
import { TEST_DEFINITIONS } from '@/config/testTypes';
import { useStaff } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { patients as patientsRepo } from '@/lib/data';
import { formatINR } from '@/lib/format';
import { uploadNewImages } from '@/lib/storage';
import type { MedicalTestCatalogItem } from '@/types/medicalTestCatalogItem';
import type { Patient, TestFieldData } from '@/types/patient';
import type { StaffMember } from '@/types/staff';

// The built-in result form for a test: by id, or for catalog tests (ids like "test_cat_3")
// by name, e.g. "ECG".
export function testDefinitionFor(testTypeId: string, testName?: string) {
  const name = testName?.trim().toLowerCase();
  return TEST_DEFINITIONS.find(def => def.id === testTypeId || def.name.toLowerCase() === name) ?? null;
}

// A new test result: type from the test catalog, its result fields, date, who did it, images.
export function TestForm({ patient, catalog, staff, onSaved, onCancel }: {
  patient: Patient;
  catalog: MedicalTestCatalogItem[] | null;
  staff: StaffMember[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const currentUser = useStaff();
  const [testTypeId, setTestTypeId] = useState('');
  const [fields, setFields] = useState<TestFieldData>({});
  const [testDate, setTestDate] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [results, setResults] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const catalogName = catalog?.find(test => test.id === testTypeId)?.name;
  const definition = testTypeId ? testDefinitionFor(testTypeId, catalogName) : null;
  const setField = (fieldId: string, value: string | number) => setFields(prev => ({ ...prev, [fieldId]: value }));

  const save = async () => {
    if (!testTypeId) {
      toast({ title: 'Choose a test', description: 'Please select a Test Type.', variant: 'destructive' });
      return;
    }
    if (!parseDMY(testDate)) {
      toast({ title: 'Check the date', description: 'Enter the test date as dd/mm/yyyy.', variant: 'destructive' });
      return;
    }
    const missing = definition?.fields.find(field => field.required && String(fields[field.id] ?? '').trim() === '');
    if (missing) {
      toast({ title: 'Missing details', description: `${missing.label} is required for this test type.`, variant: 'destructive' });
      return;
    }
    const by = staff.find(s => String(s.id) === performedBy) ?? currentUser;

    setIsSaving(true);
    try {
      await patientsRepo.addTest(patient.id, {
        testTypeId,
        testTypeName: catalogName || definition?.name || 'Unknown Test',
        datePerformed: testDate.trim(),
        testData: { ...fields },
        overallResults: results.trim() || undefined,
        notes: notes.trim() || undefined,
        performedByStaffId: by.id,
        performedByStaffName: by.name,
        attachments: await uploadNewImages(attachments, `patients/${patient.id}/tests`),
      });
      await onSaved();
      toast({ title: 'Test added' });
    } catch (e) {
      console.error('Failed to save test:', e);
      toast({ title: 'Could not save the test', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mb-6 space-y-4 rounded-md border bg-muted/30 p-4">
      <h3 className="text-lg font-semibold">{t('Add Test')}</h3>
      <div>
        <Label htmlFor="selectedTestType">Test Type *</Label>
        <Select onValueChange={id => { setTestTypeId(id); setFields({}); }} value={testTypeId} disabled={!catalog}>
          <SelectTrigger id="selectedTestType"><SelectValue placeholder={catalog ? 'Select Test Type' : 'Loading...'} /></SelectTrigger>
          <SelectContent>
            {(catalog ?? []).map(test => (
              <SelectItem key={test.id} value={test.id}>{test.name}{test.defaultPrice ? ` (${formatINR(test.defaultPrice)})` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {definition?.fields.map(field => {
        const id = `testField-${field.id}`;
        return (
          <div key={field.id}>
            <Label htmlFor={id}>{field.label}{field.required ? ' *' : ''}</Label>
            {field.type === 'textarea' ? (
              <Textarea id={id} rows={3} placeholder={field.placeholder} value={String(fields[field.id] ?? '')} onChange={e => setField(field.id, e.target.value)} />
            ) : (
              <Input id={id} type={field.type} placeholder={field.placeholder} min={field.type === 'number' ? 0 : undefined}
                value={String(fields[field.id] ?? '')}
                onChange={e => setField(field.id, field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)} />
            )}
          </div>
        );
      })}

      <div>
        <Label htmlFor="newTestDate">Date Performed *</Label>
        <DateField id="newTestDate" value={testDate} onChange={setTestDate} required />
      </div>
      <div>
        <Label htmlFor="selectedStaffForTest">Performed/Logged By</Label>
        <Select onValueChange={setPerformedBy} value={performedBy}>
          <SelectTrigger id="selectedStaffForTest"><SelectValue placeholder={`Defaults to you (${currentUser.name})`} /></SelectTrigger>
          <SelectContent>
            {staff.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="newTestOverallResults">Overall Results Summary (Optional)</Label>
        <Textarea id="newTestOverallResults" value={results} onChange={e => setResults(e.target.value)} placeholder="Enter overall test results summary..." rows={3} />
      </div>
      <div>
        <Label htmlFor="newTestNotes">General Notes (Optional)</Label>
        <Textarea id="newTestNotes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional general notes for the test..." rows={2} />
      </div>
      <AttachmentPicker id="newTestAttachment" value={attachments} onChange={setAttachments} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>{t('Cancel')}</Button>
        <Button onClick={save} disabled={isSaving}>{isSaving ? t('Saving…') : t('Save Test')}</Button>
      </div>
    </div>
  );
}
