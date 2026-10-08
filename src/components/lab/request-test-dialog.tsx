"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { testRequests } from '@/lib/data';
import type { MedicalTestCatalogItem } from '@/types/medicalTestCatalogItem';
import type { Patient } from '@/types/patient';
import type { LabTechnician, TestRequestPriority } from '@/types/testRequest';

const QUEUE = 'queue';

// Asks the lab for a test: which test, how urgent, and either the lab queue (the next
// available technician takes it) or a particular technician, on-duty ones first.
export function RequestTestDialog({ patient, catalog, open, onOpenChange, onRequested }: {
  patient: Patient;
  catalog: MedicalTestCatalogItem[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<LabTechnician[] | null>(null);
  const [testTypeId, setTestTypeId] = useState('');
  const [priority, setPriority] = useState<TestRequestPriority>('Routine');
  const [technician, setTechnician] = useState(QUEUE);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTestTypeId(''); setPriority('Routine'); setTechnician(QUEUE); setNotes('');
    testRequests.technicians().then(setTechnicians).catch(() => setTechnicians([]));
  }, [open]);

  const save = async () => {
    const test = catalog?.find(c => c.id === testTypeId);
    if (!test) {
      toast({ title: t('Choose a test'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      await testRequests.create({
        patientId: patient.id,
        testTypeId: test.id,
        testTypeName: test.name,
        priority,
        notes: notes.trim() || undefined,
        assignedToStaffId: technician === QUEUE ? undefined : Number(technician),
      });
      toast({ title: t('Test requested'), description: technician === QUEUE ? t('It is waiting in the lab queue.') : undefined });
      onOpenChange(false);
      onRequested();
    } catch (e) {
      toast({ title: t('Could not request the test'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Request Test')}</DialogTitle>
          <DialogDescription>{patient.firstName} {patient.lastName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="requestTestType">{t('Test')} *</Label>
            <Select value={testTypeId} onValueChange={setTestTypeId} disabled={!catalog}>
              <SelectTrigger id="requestTestType"><SelectValue placeholder={catalog ? t('Select Test Type') : t('Loading…')} /></SelectTrigger>
              <SelectContent>
                {(catalog ?? []).map(test => <SelectItem key={test.id} value={test.id}>{test.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('Priority')}</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(['Routine', 'Urgent'] as const).map(p => (
                <Button key={p} type="button" variant={priority === p ? (p === 'Urgent' ? 'destructive' : 'default') : 'outline'} onClick={() => setPriority(p)}>
                  {t(p)}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="requestTechnician">{t('Lab technician')}</Label>
            <Select value={technician} onValueChange={setTechnician}>
              <SelectTrigger id="requestTechnician"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={QUEUE}>{t('Next available technician (lab queue)')}</SelectItem>
                {(technicians ?? []).map(tech => (
                  <SelectItem key={tech.id} value={String(tech.id)}>
                    {tech.name} · {tech.onDuty ? t('On duty') : t('Off duty')}{tech.openRequests ? ` · ${t('{n} open', { n: tech.openRequests })}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {technicians?.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">{t('No lab technicians yet. Add staff with the Lab Technician role; until then any staff member can record the result.')}</p>
            )}
          </div>
          <div>
            <Label htmlFor="requestNotes">{t('Notes for the lab (optional)')}</Label>
            <Textarea id="requestNotes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={save} disabled={isSaving || !testTypeId}>{isSaving ? t('Saving…') : t('Request Test')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
