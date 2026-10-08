"use client";

import { useState } from 'react';
import Link from '@/components/app-link';
import { Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import type { CareNote } from '@/types/patient';
import type { Medication } from '@/types/medication';

export type NoteMedication = NonNullable<CareNote['medicationsMentioned']>[number];

// Picks a medicine from the pharmacy list, with dosage and notes, for a care note.
// The list is loaded when the dialog first opens (onOpen).
export function AddMedicationDialog({ medications, onOpen, onAdd }: {
  medications: Medication[] | null;
  onOpen: () => void;
  onAdd: (medication: NoteMedication) => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [medicationId, setMedicationId] = useState('');
  const [dosage, setDosage] = useState('');
  const [notes, setNotes] = useState('');

  const openChange = (next: boolean) => {
    if (next) { setMedicationId(''); setDosage(''); setNotes(''); onOpen(); }
    setOpen(next);
  };

  const add = () => {
    const medication = medications?.find(m => m.id === medicationId);
    if (!medication) {
      toast({ title: 'Choose a medication', description: 'Please select a medication.', variant: 'destructive' });
      return;
    }
    onAdd({ medicationId: medication.id, medicationName: medication.name, dosage: dosage.trim() || undefined, notes: notes.trim() || undefined });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pill className="mr-2 h-4 w-4" /> {t('Add Medication')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader><DialogTitle>{t('Add Medication')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label htmlFor="noteMedication">Medication *</Label>
            <Select onValueChange={setMedicationId} value={medicationId}>
              <SelectTrigger id="noteMedication"><SelectValue placeholder={medications ? 'Select Medication' : 'Loading...'} /></SelectTrigger>
              <SelectContent>
                {medications && medications.length > 0 ? medications.map(med => (
                  <SelectItem key={med.id} value={med.id}>{med.name}</SelectItem>
                )) : medications && (
                  <div className="p-2 text-center text-sm text-muted-foreground">No medications found. <Link href="/pharmacy/form" className="underline">Add one?</Link></div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="noteMedicationDosage">Dosage (Optional)</Label>
            <Input id="noteMedicationDosage" value={dosage} onChange={e => setDosage(e.target.value)} placeholder="e.g., 500mg twice daily" />
          </div>
          <div>
            <Label htmlFor="noteMedicationNotes">Notes (Optional)</Label>
            <Textarea id="noteMedicationNotes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Take with food, Adjust based on BP" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">{t('Cancel')}</Button></DialogClose>
          <Button type="button" onClick={add}>Add to Note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
