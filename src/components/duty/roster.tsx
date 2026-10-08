"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { shifts as shiftsRepo } from '@/lib/data';
import { SHIFT_COLORS, SHIFT_PRESETS, SHIFT_TYPES, dateKey, formatHours, overlaps, shiftHours, shiftWindow, weekStartOf } from '@/lib/duty';
import { cn } from '@/lib/utils';
import type { Department, DepartmentMembers } from '@/types/department';
import type { ShiftType, StaffShift } from '@/types/duty';
import type { StaffMember } from '@/types/staff';

export type StaffGroup = 'all' | 'Doctor' | 'Nurse' | 'other' | 'me';
const NONE = 'none';
const ROLE_ORDER: Record<string, number> = { Doctor: 0, Nurse: 1 };

export function staffInGroup(person: StaffMember, group: StaffGroup, currentUserId: number) {
  if (group === 'all') return true;
  if (group === 'me') return person.id === currentUserId;
  if (group === 'other') return person.role !== 'Doctor' && person.role !== 'Nurse';
  return person.role === group;
}

export function sortStaff(list: StaffMember[]) {
  return [...list].sort((a, b) => (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2) || a.name.localeCompare(b.name));
}

interface Draft {
  id?: number;
  staffId: string;
  shiftDate: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  departmentId: string;
  notes: string;
  repeatDays: string[]; // extra dates (yyyy-MM-dd) to add the same shift on
}

interface RosterProps {
  staff: StaffMember[];
  departments: Department[];
  members: DepartmentMembers;
  canEdit: boolean;
  currentUserId: number;
  refreshKey: number;
}

// Weekly duty roster: one row per person, one column per day.
export function Roster({ staff, departments, members, canEdit, currentUserId, refreshKey }: RosterProps) {
  const t = useT();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [weekShifts, setWeekShifts] = useState<StaffShift[]>([]);
  const [group, setGroup] = useState<StaffGroup>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Phones show one day at a time.
  const [phoneDay, setPhoneDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [isSaving, setIsSaving] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = dateKey(days[0]);
  const to = dateKey(days[6]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // The day before too, so overnight shifts from Sunday are known when checking overlaps.
      setWeekShifts(await shiftsRepo.list(dateKey(addDays(weekStart, -1)), to));
    } catch (error) {
      toast({ title: 'Could not load the roster', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [weekStart, to, toast]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const departmentName = (id?: number | null) => departments.find(d => d.id === id)?.name;
  const visibleShifts = weekShifts.filter(s => s.shiftDate >= from);

  const rows = useMemo(() => {
    const inDepartment = (person: StaffMember) => departmentFilter === 'all'
      || (members[Number(departmentFilter)] ?? []).includes(person.id)
      || visibleShifts.some(s => s.staffId === person.id && String(s.departmentId) === departmentFilter);
    return sortStaff(staff.filter(p => staffInGroup(p, group, currentUserId) && inDepartment(p)));
  }, [staff, group, departmentFilter, members, visibleShifts, currentUserId]);

  const shiftsFor = (staffId: number, day: Date) =>
    visibleShifts.filter(s => s.staffId === staffId && s.shiftDate === dateKey(day))
      .filter(s => departmentFilter === 'all' || !s.departmentId || String(s.departmentId) === departmentFilter);

  const defaultDepartment = (staffId: number) => {
    const own = departments.filter(d => (members[d.id] ?? []).includes(staffId));
    if (departmentFilter !== 'all') return departmentFilter;
    return own.length === 1 ? String(own[0].id) : NONE;
  };

  const openAdd = (staffId: number, day: Date) => setDraft({
    staffId: String(staffId), shiftDate: dateKey(day), shiftType: 'Morning',
    startTime: SHIFT_PRESETS.Morning.start, endTime: SHIFT_PRESETS.Morning.end,
    departmentId: defaultDepartment(staffId), notes: '', repeatDays: [],
  });

  const openEdit = (shift: StaffShift) => setDraft({
    id: shift.id, staffId: String(shift.staffId), shiftDate: shift.shiftDate, shiftType: shift.shiftType,
    startTime: shift.startTime, endTime: shift.endTime,
    departmentId: shift.departmentId ? String(shift.departmentId) : NONE, notes: shift.notes ?? '', repeatDays: [],
  });

  const conflictsFor = (candidate: Pick<StaffShift, 'staffId' | 'shiftDate' | 'startTime' | 'endTime'>, ignoreId?: number) =>
    weekShifts.filter(s => s.staffId === candidate.staffId && s.id !== ignoreId && overlaps(shiftWindow(s), shiftWindow(candidate)));

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.staffId || !draft.shiftDate || !draft.startTime || !draft.endTime) {
      toast({ title: 'Missing details', description: 'Choose the person, date and times.', variant: 'destructive' });
      return;
    }
    const base = {
      staffId: Number(draft.staffId), shiftType: draft.shiftType, startTime: draft.startTime, endTime: draft.endTime,
      departmentId: draft.departmentId === NONE ? null : Number(draft.departmentId), notes: draft.notes.trim() || undefined,
    };
    const dates = [draft.shiftDate, ...draft.repeatDays.filter(d => d !== draft.shiftDate)];
    const clashes = dates.flatMap(shiftDate => conflictsFor({ ...base, shiftDate }, draft.id).map(c => `${format(parseISO(c.shiftDate), 'EEE d MMM')} ${c.startTime}–${c.endTime}`));
    if (clashes.length > 0) {
      toast({ title: 'Overlapping shift', description: `${staff.find(s => s.id === base.staffId)?.name ?? 'This person'} already has: ${clashes.join(', ')}.`, variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      if (draft.id) await shiftsRepo.update(draft.id, { ...base, shiftDate: draft.shiftDate, notes: base.notes ?? '' });
      else await shiftsRepo.createMany(dates.map(shiftDate => ({ ...base, shiftDate })));
      toast({ title: 'Roster updated', description: draft.id ? 'Shift saved.' : `${dates.length} shift${dates.length > 1 ? 's' : ''} added.` });
      setDraft(null);
      await load();
    } catch (error) {
      toast({ title: 'Could not save the shift', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft?.id || !confirm('Remove this shift from the roster?')) return;
    setIsSaving(true);
    try {
      await shiftsRepo.remove(draft.id);
      toast({ title: 'Shift removed' });
      setDraft(null);
      await load();
    } catch (error) {
      toast({ title: 'Could not remove the shift', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const copyPreviousWeek = async () => {
    if (!confirm(`Copy last week's shifts into the week of ${format(weekStart, 'd MMM')}? Shifts that would overlap existing ones are skipped.`)) return;
    try {
      const previous = await shiftsRepo.list(dateKey(addDays(weekStart, -7)), dateKey(addDays(weekStart, -1)));
      const planned: StaffShift[] = [...weekShifts];
      const toCreate: Omit<StaffShift, 'id'>[] = [];
      for (const shift of previous) {
        const copy = { staffId: shift.staffId, shiftDate: dateKey(addDays(parseISO(shift.shiftDate), 7)), shiftType: shift.shiftType,
          startTime: shift.startTime, endTime: shift.endTime, departmentId: shift.departmentId ?? null, notes: shift.notes };
        if (!staff.some(s => s.id === copy.staffId)) continue; // left the hospital
        if (planned.some(s => s.staffId === copy.staffId && overlaps(shiftWindow(s), shiftWindow(copy)))) continue;
        toCreate.push(copy);
        planned.push({ ...copy, id: -planned.length });
      }
      if (toCreate.length === 0) {
        toast({ title: 'Nothing to copy', description: previous.length ? 'Every shift from last week is already planned.' : 'Last week has no shifts.' });
        return;
      }
      await shiftsRepo.createMany(toCreate);
      toast({ title: 'Week copied', description: `${toCreate.length} shift${toCreate.length > 1 ? 's' : ''} added${previous.length > toCreate.length ? `, ${previous.length - toCreate.length} skipped` : ''}.` });
      await load();
    } catch (error) {
      toast({ title: 'Could not copy the week', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    }
  };

  const today = new Date();
  const draftCrossesMidnight = draft && draft.endTime <= draft.startTime;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekStart(d => addDays(d, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setWeekStart(weekStartOf(new Date()))}>{t('This week')}</Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekStart(d => addDays(d, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <span className="ml-1 font-medium">{format(days[0], 'd MMM')} – {format(days[6], 'd MMM yyyy')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div className="sm:w-40">
            <Label htmlFor="rosterGroup" className="text-xs">Show</Label>
            <Select value={group} onValueChange={v => setGroup(v as StaffGroup)}>
              <SelectTrigger id="rosterGroup"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                <SelectItem value="Doctor">Doctors</SelectItem>
                <SelectItem value="Nurse">Nurses</SelectItem>
                <SelectItem value="other">Other staff</SelectItem>
                <SelectItem value="me">Only me</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-44">
            <Label htmlFor="rosterDepartment" className="text-xs">Department</Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger id="rosterDepartment"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {canEdit && (
            <Button variant="outline" onClick={copyPreviousWeek} className="col-span-2 sm:col-span-1">
              <Copy className="mr-2 h-4 w-4" /> {t('Copy last week')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {SHIFT_TYPES.map(type => (
          <span key={type} className={cn('rounded border px-2 py-0.5', SHIFT_COLORS[type])}>
            {t(type)}{type !== 'Custom' ? ` ${SHIFT_PRESETS[type].start}–${SHIFT_PRESETS[type].end}` : ''}
          </span>
        ))}
      </div>

      <div className="space-y-3 sm:hidden">
        <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="Day">
          {days.map((day, index) => {
            const count = visibleShifts.filter(s => s.shiftDate === dateKey(day) && rows.some(p => p.id === s.staffId)).length;
            return (
              <button key={day.toISOString()} type="button" role="tab" aria-selected={phoneDay === index} onClick={() => setPhoneDay(index)}
                className={cn('flex min-h-12 flex-col items-center justify-center rounded-md border text-xs',
                  phoneDay === index ? 'border-primary bg-primary text-primary-foreground' : isSameDay(day, today) ? 'border-primary text-primary' : '')}>
                <span>{format(day, 'EEE')}</span>
                <span className="font-semibold">{format(day, 'd')}</span>
                {count > 0 && <span className="text-[10px] opacity-80">{count}</span>}
              </button>
            );
          })}
        </div>
        {isLoading ? <p className="py-6 text-center text-muted-foreground">Loading roster…</p> : (() => {
          const day = days[phoneDay];
          const onDay = rows.flatMap(person => shiftsFor(person.id, day).map(shift => ({ person, shift })))
            .sort((a, b) => a.shift.startTime.localeCompare(b.shift.startTime));
          return (
            <>
              <p className="text-sm font-medium">{format(day, 'EEEE d MMMM')}</p>
              {onDay.length === 0 ? <p className="text-sm text-muted-foreground">No shifts planned{rows.length < staff.length ? ' for these filters' : ''}.</p> : (
                <ul className="space-y-2">
                  {onDay.map(({ person, shift }) => {
                    const inner = (
                      <>
                        <span className="min-w-0">
                          <span className="block font-medium">{person.name}</span>
                          <span className="block text-xs opacity-80">{person.role}{shift.departmentId ? ` · ${departmentName(shift.departmentId)}` : ''}{shift.notes ? ` · ${shift.notes}` : ''}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-medium">{t(shift.shiftType)}</span>
                          <span className="block tabular-nums text-xs">{shift.startTime}–{shift.endTime}</span>
                        </span>
                      </>
                    );
                    const cls = cn('flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm', SHIFT_COLORS[shift.shiftType]);
                    return (
                      <li key={shift.id}>
                        {canEdit
                          ? <button type="button" className={cls} onClick={() => openEdit(shift)} aria-label={`Edit shift: ${person.name}, ${shift.shiftType} ${shift.startTime}–${shift.endTime}`}>{inner}</button>
                          : <div className={cls}>{inner}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canEdit && rows.length > 0 && (
                <Button variant="outline" className="w-full" onClick={() => openAdd(rows[0].id, day)}>
                  <Plus className="mr-2 h-4 w-4" /> {t('Add shift on {day}', { day: format(day, 'EEE d') })}
                </Button>
              )}
            </>
          );
        })()}
      </div>

      <div className="hidden overflow-x-auto rounded-md border sm:block">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 w-40 bg-muted px-3 py-2 text-left font-medium">Staff</th>
              {days.map(day => (
                <th key={day.toISOString()} className={cn('px-2 py-2 text-left font-medium', isSameDay(day, today) && 'bg-primary/10 text-primary')}>
                  {format(day, 'EEE d')}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">Hours</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Loading roster…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No staff match these filters.</td></tr>
            ) : rows.map(person => {
              const hours = visibleShifts.filter(s => s.staffId === person.id).reduce((sum, s) => sum + shiftHours(s), 0);
              return (
                <tr key={person.id} className="border-t align-top">
                  <th scope="row" className="sticky left-0 z-10 w-40 bg-background px-3 py-2 text-left font-normal">
                    <span className="block font-medium leading-tight">{person.name}</span>
                    <span className="text-xs text-muted-foreground">{person.role}</span>
                  </th>
                  {days.map(day => (
                    <td key={day.toISOString()} className={cn('px-1.5 py-1.5', isSameDay(day, today) && 'bg-primary/5')}>
                      <div className="flex min-h-10 flex-col gap-1">
                        {shiftsFor(person.id, day).map(shift => {
                          const label = `${shift.shiftType} ${shift.startTime}–${shift.endTime}${shift.departmentId ? ` · ${departmentName(shift.departmentId) ?? ''}` : ''}${shift.notes ? ` · ${shift.notes}` : ''}`;
                          const content = (
                            <>
                              <span className="block font-medium">{t(shift.shiftType)}</span>
                              <span className="block tabular-nums">{shift.startTime}–{shift.endTime}</span>
                              {shift.departmentId && <span className="block truncate opacity-80">{departmentName(shift.departmentId)}</span>}
                            </>
                          );
                          return canEdit ? (
                            <button key={shift.id} type="button" title={label} aria-label={`Edit shift: ${person.name}, ${label}`} onClick={() => openEdit(shift)}
                              className={cn('rounded border px-1.5 py-1 text-left text-xs hover:ring-2 hover:ring-ring', SHIFT_COLORS[shift.shiftType])}>
                              {content}
                            </button>
                          ) : (
                            <div key={shift.id} title={label} className={cn('rounded border px-1.5 py-1 text-xs', SHIFT_COLORS[shift.shiftType])}>{content}</div>
                          );
                        })}
                        {canEdit && (
                          <button type="button" onClick={() => openAdd(person.id, day)} aria-label={`Add shift for ${person.name} on ${format(day, 'EEEE d MMMM')}`}
                            className="flex h-7 items-center justify-center rounded border border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{hours ? formatHours(hours) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!canEdit && <p className="text-xs text-muted-foreground">Only Super Admin and Admin can change the roster.</p>}

      <Dialog open={!!draft} onOpenChange={open => { if (!open) setDraft(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t('Edit shift') : t('Add shift')}</DialogTitle>
            <DialogDescription>{staff.find(s => String(s.id) === draft?.staffId)?.name}</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="shiftStaff">Staff member</Label>
                  <Select value={draft.staffId} onValueChange={v => setDraft({ ...draft, staffId: v })}>
                    <SelectTrigger id="shiftStaff"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sortStaff(staff).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="shiftDate">Date</Label>
                  <Input id="shiftDate" type="date" value={draft.shiftDate} onChange={e => setDraft({ ...draft, shiftDate: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="shiftType">Shift</Label>
                  <Select value={draft.shiftType} onValueChange={v => {
                    const type = v as ShiftType;
                    setDraft({ ...draft, shiftType: type, ...(type !== 'Custom' ? { startTime: SHIFT_PRESETS[type].start, endTime: SHIFT_PRESETS[type].end } : {}) });
                  }}>
                    <SelectTrigger id="shiftType"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SHIFT_TYPES.map(type => <SelectItem key={type} value={type}>{t(type)}{type !== 'Custom' ? ` (${SHIFT_PRESETS[type].start}–${SHIFT_PRESETS[type].end})` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="shiftStart">Starts</Label>
                  <Input id="shiftStart" type="time" value={draft.startTime} onChange={e => setDraft({ ...draft, startTime: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="shiftEnd">Ends</Label>
                  <Input id="shiftEnd" type="time" value={draft.endTime} onChange={e => setDraft({ ...draft, endTime: e.target.value })} />
                </div>
                {draftCrossesMidnight && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    {draft.endTime === draft.startTime ? '24-hour shift, ending' : 'Ends'} the next day at {draft.endTime} ({formatHours(shiftHours(draft))}).
                  </p>
                )}
                <div className="sm:col-span-2">
                  <Label htmlFor="shiftDepartment">Department</Label>
                  <Select value={draft.departmentId} onValueChange={v => setDraft({ ...draft, departmentId: v })}>
                    <SelectTrigger id="shiftDepartment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not specific to a department</SelectItem>
                      {departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="shiftNotes">Notes</Label>
                  <Textarea id="shiftNotes" rows={2} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Optional, e.g. ICU cover" />
                </div>
              </div>
              {!draft.id && (
                <div>
                  <Label className="text-sm">Also add on</Label>
                  <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {days.map(day => {
                      const key = dateKey(day);
                      if (key === draft.shiftDate) return null;
                      const checked = draft.repeatDays.includes(key);
                      return (
                        <label key={key} className="flex min-h-10 cursor-pointer flex-col items-center justify-center rounded-md border text-xs hover:bg-muted/50">
                          <Checkbox checked={checked} aria-label={format(day, 'EEEE d MMMM')}
                            onCheckedChange={() => setDraft({ ...draft, repeatDays: checked ? draft.repeatDays.filter(d => d !== key) : [...draft.repeatDays, key] })} />
                          <span className="mt-1">{format(day, 'EEE d')}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {draft?.id
              ? <Button variant="ghost" className="text-destructive" onClick={handleDelete} disabled={isSaving}><Trash2 className="mr-2 h-4 w-4" /> {t('Remove')}</Button>
              : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setDraft(null)}>{t('Cancel')}</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? t('Saving…') : t('Save shift')}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
