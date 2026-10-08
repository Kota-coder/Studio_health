"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, differenceInMinutes, format, parseISO } from 'date-fns';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { attendance as attendanceRepo, shifts as shiftsRepo } from '@/lib/data';
import { dateKey, entryWindow, formatHours, overlaps, shiftHours, shiftStatus, shiftWindow, weekStartOf, type ShiftStatusTone } from '@/lib/duty';
import { cn } from '@/lib/utils';
import type { AttendanceEntry, StaffShift } from '@/types/duty';
import type { StaffMember } from '@/types/staff';
import { sortStaff } from './roster';

const TONE_CLASSES: Record<ShiftStatusTone, string> = {
  ok: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  live: 'bg-sky-600 hover:bg-sky-600 text-white',
  warn: 'bg-amber-500 hover:bg-amber-500 text-white',
  bad: 'bg-destructive hover:bg-destructive text-destructive-foreground',
  neutral: '',
};

// datetime-local inputs work in local time without a zone.
const toLocalInput = (iso?: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');
const fromLocalInput = (value: string) => (value ? parseISO(value).toISOString() : null);

interface Draft {
  id?: number;
  staffId: string;
  clockIn: string;
  clockOut: string;
  notes: string;
}

interface AttendanceLogProps {
  staff: StaffMember[];
  currentUser: StaffMember;
  canSeeAll: boolean;
  canManage: boolean;
  refreshKey: number;
  onChange: () => void;
}

// Planned shifts compared with clock-ins, hours per person, and every time record.
export function AttendanceLog({ staff, currentUser, canSeeAll, canManage, refreshKey, onChange }: AttendanceLogProps) {
  const t = useT();
  const { toast } = useToast();
  const [from, setFrom] = useState(() => dateKey(weekStartOf(new Date())));
  const [to, setTo] = useState(() => dateKey(new Date()));
  const [staffFilter, setStaffFilter] = useState<string>(canSeeAll ? 'all' : String(currentUser.id));
  const [shiftList, setShiftList] = useState<StaffShift[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!from || !to || from > to) return;
    setIsLoading(true);
    try {
      const rangeStart = parseISO(`${from}T00:00`);
      const rangeEnd = addDays(parseISO(`${to}T00:00`), 1);
      const [shiftRows, entryRows] = await Promise.all([
        shiftsRepo.list(from, to),
        // A day either side, so overnight shifts find their clock-ins.
        attendanceRepo.list(addDays(rangeStart, -1).toISOString(), addDays(rangeEnd, 1).toISOString()),
      ]);
      setShiftList(shiftRows);
      setEntries(entryRows);
    } catch (error) {
      toast({ title: 'Could not load attendance', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [from, to, toast]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const staffById = useMemo(() => new Map(staff.map(s => [s.id, s])), [staff]);
  const nameOf = (id?: number | null) => (id != null ? staffById.get(id)?.name : undefined) ?? 'Former staff';
  const included = (staffId: number) => (staffFilter === 'all' ? (canSeeAll || staffId === currentUser.id) : String(staffId) === staffFilter);

  const now = new Date();
  const rangeStart = parseISO(`${from}T00:00`);
  const rangeEnd = addDays(parseISO(`${to}T00:00`), 1);
  const visibleShifts = shiftList.filter(s => included(s.staffId));
  const visibleEntries = entries
    .filter(e => included(e.staffId) && overlaps(entryWindow(e, now), { start: rangeStart, end: rangeEnd }));
  const shiftRows = visibleShifts.map(shift => ({ shift, status: shiftStatus(shift, entries, now) }));
  const matchedIds = new Set(shiftRows.flatMap(r => r.status.matched.map(e => e.id)));
  const workedHours = (e: AttendanceEntry) => Math.max(0, differenceInMinutes(entryWindow(e, now).end, entryWindow(e, now).start)) / 60;

  const summary = sortStaff(staff.filter(p => included(p.id)))
    .map(person => {
      const mine = shiftRows.filter(r => r.shift.staffId === person.id);
      const past = mine.filter(r => shiftWindow(r.shift).start <= now);
      return {
        person,
        shifts: mine.length,
        planned: mine.reduce((sum, r) => sum + shiftHours(r.shift), 0),
        worked: visibleEntries.filter(e => e.staffId === person.id).reduce((sum, e) => sum + workedHours(e), 0),
        late: past.filter(r => r.status.label.includes('Late')).length,
        absent: past.filter(r => r.status.label === 'Absent').length,
      };
    })
    .filter(row => row.shifts > 0 || row.worked > 0);

  const openAdd = () => setDraft({
    staffId: staffFilter !== 'all' ? staffFilter : '', clockIn: toLocalInput(new Date().toISOString()), clockOut: '', notes: '',
  });
  const openEdit = (entry: AttendanceEntry) => setDraft({
    id: entry.id, staffId: String(entry.staffId), clockIn: toLocalInput(entry.clockIn), clockOut: toLocalInput(entry.clockOut), notes: entry.notes ?? '',
  });

  const handleSave = async () => {
    if (!draft) return;
    const clockIn = fromLocalInput(draft.clockIn);
    const clockOut = fromLocalInput(draft.clockOut);
    if (!draft.staffId || !clockIn) {
      toast({ title: 'Missing details', description: 'Choose the person and the clock-in time.', variant: 'destructive' });
      return;
    }
    if (clockOut && clockOut <= clockIn) {
      toast({ title: 'Check the times', description: 'Clock-out must be after clock-in.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const fields = { clockIn, clockOut, notes: draft.notes.trim() };
      if (draft.id) await attendanceRepo.update(draft.id, fields);
      else await attendanceRepo.create({ staffId: Number(draft.staffId), ...fields });
      toast({ title: 'Attendance saved', description: 'Saved as a manual entry.' });
      setDraft(null);
      await load();
      onChange();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the entry.';
      toast({
        title: 'Could not save the entry',
        description: message.includes('one_open') ? 'This person is already clocked in. Add a clock-out time, or close their open entry first.' : message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft?.id || !confirm('Delete this attendance entry?')) return;
    setIsSaving(true);
    try {
      await attendanceRepo.remove(draft.id);
      toast({ title: 'Entry deleted' });
      setDraft(null);
      await load();
      onChange();
    } catch (error) {
      toast({ title: 'Could not delete the entry', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const fmt = (iso: string) => format(new Date(iso), 'd MMM HH:mm');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <div>
          <Label htmlFor="attFrom" className="text-xs">From</Label>
          <Input id="attFrom" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="sm:w-44" />
        </div>
        <div>
          <Label htmlFor="attTo" className="text-xs">To</Label>
          <Input id="attTo" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="sm:w-44" />
        </div>
        {canSeeAll && (
          <div className="col-span-2 sm:w-56">
            <Label htmlFor="attStaff" className="text-xs">Staff member</Label>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger id="attStaff"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {sortStaff(staff).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {canManage && (
          <Button variant="outline" onClick={openAdd} className="col-span-2 sm:col-span-1">
            <Plus className="mr-2 h-4 w-4" /> {t('Add entry')}
          </Button>
        )}
      </div>

      {isLoading ? <p className="text-muted-foreground">{t('Loading...')}</p> : (
        <>
          <section className="space-y-2">
            <h3 className="font-semibold">{t('Hours by person')}</h3>
            {summary.length === 0 ? <p className="text-sm text-muted-foreground">No shifts or time on duty in this period.</p> : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Shifts</TableHead>
                      <TableHead className="text-right">Planned</TableHead>
                      <TableHead className="text-right">Worked</TableHead>
                      <TableHead className="text-right">Late</TableHead>
                      <TableHead className="text-right">Absent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map(row => (
                      <TableRow key={row.person.id}>
                        <TableCell><span className="font-medium">{row.person.name}</span> <span className="text-xs text-muted-foreground">{row.person.role}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{row.shifts}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatHours(row.planned)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatHours(row.worked)}</TableCell>
                        <TableCell className={cn('text-right tabular-nums', row.late > 0 && 'text-amber-600 font-medium')}>{row.late}</TableCell>
                        <TableCell className={cn('text-right tabular-nums', row.absent > 0 && 'text-destructive font-medium')}>{row.absent}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t('Shifts: planned vs actual')}</h3>
            {shiftRows.length === 0 ? <p className="text-sm text-muted-foreground">No shifts planned in this period.</p> : (
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Planned</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftRows.map(({ shift, status }) => (
                      <TableRow key={shift.id}>
                        <TableCell className="whitespace-nowrap">{format(parseISO(shift.shiftDate), 'EEE d MMM')}</TableCell>
                        <TableCell>{nameOf(shift.staffId)}</TableCell>
                        <TableCell className="whitespace-nowrap">{t(shift.shiftType)} {shift.startTime}–{shift.endTime}</TableCell>
                        <TableCell className="text-sm">
                          {status.matched.length === 0 ? '—' : status.matched.map(e => (
                            <span key={e.id} className="block whitespace-nowrap">{format(new Date(e.clockIn), 'HH:mm')}–{e.clockOut ? format(new Date(e.clockOut), 'HH:mm') : 'now'}</span>
                          ))}
                        </TableCell>
                        <TableCell><Badge variant={status.tone === 'neutral' ? 'secondary' : 'default'} className={cn('whitespace-nowrap', TONE_CLASSES[status.tone])}>{t(status.label)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t('Time records')}</h3>
            {visibleEntries.length === 0 ? <p className="text-sm text-muted-foreground">Nobody clocked in during this period.</p> : (
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Clock in</TableHead>
                      <TableHead>Clock out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Notes</TableHead>
                      {canManage && <TableHead className="w-12"><span className="sr-only">Edit</span></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{nameOf(entry.staffId)}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmt(entry.clockIn)}</TableCell>
                        <TableCell className="whitespace-nowrap">{entry.clockOut ? fmt(entry.clockOut) : <Badge className="bg-sky-600 hover:bg-sky-600">{t('On duty')}</Badge>}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatHours(workedHours(entry))}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-wrap gap-1">
                            {!matchedIds.has(entry.id) && <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">{t('Not on roster')}</Badge>}
                            {entry.source === 'Manual' && <Badge variant="outline" title={entry.recordedByStaffId ? `Entered by ${nameOf(entry.recordedByStaffId)}` : undefined}>{t('Manual')}{entry.recordedByStaffId ? ` · ${nameOf(entry.recordedByStaffId)}` : ''}</Badge>}
                            {!entry.clockOut && workedHours(entry) > 16 && <Badge variant="destructive">{t('Open over 16h')}</Badge>}
                          </div>
                          {entry.notes && <p className="mt-1 text-muted-foreground">{entry.notes}</p>}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <Button variant="ghost" size="icon" aria-label={`Edit entry for ${nameOf(entry.staffId)}`} onClick={() => openEdit(entry)}><Edit3 className="h-4 w-4" /></Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={!!draft} onOpenChange={open => { if (!open) setDraft(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t('Correct attendance') : t('Add attendance')}</DialogTitle>
            <DialogDescription>For when someone forgot to clock in or out. Saved as a manual entry with your name.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="entryStaff">Staff member</Label>
                <Select value={draft.staffId} onValueChange={v => setDraft({ ...draft, staffId: v })} disabled={!!draft.id}>
                  <SelectTrigger id="entryStaff"><SelectValue placeholder="Choose a person" /></SelectTrigger>
                  <SelectContent>
                    {sortStaff(staff).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="entryIn">Clock in</Label>
                <Input id="entryIn" type="datetime-local" value={draft.clockIn} onChange={e => setDraft({ ...draft, clockIn: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="entryOut">Clock out</Label>
                <Input id="entryOut" type="datetime-local" value={draft.clockOut} onChange={e => setDraft({ ...draft, clockOut: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Leave empty if they are still on duty.</p>
              </div>
              <div>
                <Label htmlFor="entryNotes">Reason / notes</Label>
                <Textarea id="entryNotes" rows={2} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. Forgot to clock out" />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {draft?.id
              ? <Button variant="ghost" className="text-destructive" onClick={handleDelete} disabled={isSaving}><Trash2 className="mr-2 h-4 w-4" /> {t('Delete')}</Button>
              : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setDraft(null)}>{t('Cancel')}</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? t('Saving…') : t('Save')}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
