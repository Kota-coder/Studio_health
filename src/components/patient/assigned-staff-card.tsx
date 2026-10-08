"use client";

import { ChevronsUpDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { patients as patientsRepo } from '@/lib/data';
import type { Patient } from '@/types/patient';
import type { StaffMember } from '@/types/staff';

// Staff assigned to the patient (only they may add care notes once anyone is assigned).
// The change shows straight away and is rolled back if the save fails.
export function AssignedStaffCard({ patient, staff, onChange, onSaved }: {
  patient: Patient;
  staff: StaffMember[];
  onChange: (patient: Patient) => void;
  onSaved: () => Promise<void>;
}) {
  const t = useT();
  const { toast } = useToast();
  const assigned = patient.assignedStaffIds ?? [];
  const names = assigned.map(id => staff.find(s => s.id === id)?.name).filter(Boolean).join(', ');

  const toggle = (staffId: number) => {
    const removing = assigned.includes(staffId);
    const next = removing ? assigned.filter(id => id !== staffId) : [...assigned, staffId];
    const name = staff.find(s => s.id === staffId)?.name ?? `Staff ID ${staffId}`;
    onChange({ ...patient, assignedStaffIds: next });
    patientsRepo.update(patient.id, { assignedStaffIds: next }, { actionType: 'Staff Assignment Changed', details: `${removing ? 'Unassigned' : 'Assigned'}: ${name}.` })
      .then(onSaved)
      .then(() => toast({ title: 'Staff assignment updated' }))
      .catch(e => {
        console.error('Failed to update staff assignment:', e);
        onChange(patient);
        toast({ title: 'Could not update staff assignment', variant: 'destructive' });
      });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" />{t('Assigned Staff')}</CardTitle>
        <CardDescription>Manage staff responsible for this patient.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <h4 className="mb-1 text-sm font-medium text-muted-foreground">Currently Assigned:</h4>
          <p className="text-sm">{names || 'No staff assigned.'}</p>
        </div>
        {staff.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full">
                <Users className="mr-2 h-4 w-4" /> {t('Manage Assignments')} <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-72 w-64 overflow-y-auto">
              <DropdownMenuLabel>Assign Staff</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {staff.map(member => (
                <DropdownMenuCheckboxItem key={member.id} checked={assigned.includes(member.id)} onCheckedChange={() => toggle(member.id)}>
                  {member.name} ({member.role})
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <p className="text-sm italic text-muted-foreground">No staff members available to assign. Add staff in the Staff portal.</p>
        )}
      </CardContent>
    </Card>
  );
}
