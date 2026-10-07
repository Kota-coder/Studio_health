"use client";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StaffMember } from '@/types/staff';

// Who processed a bill or payment. Everyone is recorded as themselves; the Super Admin can
// pick another staff member (the database enforces the same rule).
export function ProcessedByField({ id, value, onChange, staff, canAssign, displayName }: {
  id: string;
  value: string; // staff id
  onChange: (staffId: string) => void;
  staff: StaffMember[];
  canAssign: boolean;
  displayName?: string | null; // shown when the person can't change it
}) {
  const known = staff.some(s => String(s.id) === value);
  return (
    <div>
      <Label htmlFor={id}>Processed by</Label>
      {canAssign ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue placeholder="Choose staff member" /></SelectTrigger>
          <SelectContent>
            {!known && value && <SelectItem value={value}>{displayName || `Staff #${value}`}</SelectItem>}
            {staff.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input id={id} value={displayName || '—'} readOnly disabled />
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {canAssign ? 'As Super Admin you can record this for another staff member.' : 'Recorded automatically. Only the Super Admin can change it.'}
      </p>
    </div>
  );
}
