"use client";

import { useCallback, useEffect, useState } from 'react';
import { addDays, addMinutes, format, parseISO } from 'date-fns';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { attendance as attendanceRepo, shifts as shiftsRepo } from '@/lib/data';
import { dateKey, entryWindow, shiftWindow } from '@/lib/duty';
import { cn } from '@/lib/utils';
import type { Department } from '@/types/department';
import type { AttendanceEntry, StaffShift } from '@/types/duty';
import type { StaffMember } from '@/types/staff';
import { sortStaff } from './roster';

interface OnDutyCheckProps {
  staff: StaffMember[];
  departments: Department[];
  canSeeAllAttendance: boolean;
  refreshKey: number;
}

interface Row {
  person: StaffMember;
  shift?: StaffShift;
  entry?: AttendanceEntry;
}

// Who was on duty at a given moment: planned on the roster, clocked in, or both.
export function OnDutyCheck({ staff, departments, canSeeAllAttendance, refreshKey }: OnDutyCheckProps) {
  const t = useT();
  const { toast } = useToast();
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [time, setTime] = useState(() => format(new Date(), 'HH:mm'));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const check = useCallback(async (at: Date) => {
    setIsLoading(true);
    try {
      const [shiftList, entries] = await Promise.all([
        shiftsRepo.list(dateKey(addDays(at, -1)), dateKey(at)),
        attendanceRepo.list(at.toISOString(), addMinutes(at, 1).toISOString()),
      ]);
      const now = new Date();
      const covering = shiftList.filter(s => { const w = shiftWindow(s); return w.start <= at && at < w.end; });
      const present = entries.filter(e => { const w = entryWindow(e, now); return w.start <= at && at <= w.end; });
      const ids = new Set([...covering.map(s => s.staffId), ...present.map(e => e.staffId)]);
      setRows(sortStaff(staff.filter(p => ids.has(p.id))).map(person => ({
        person,
        shift: covering.find(s => s.staffId === person.id),
        entry: present.find(e => e.staffId === person.id),
      })));
      setCheckedAt(at);
    } catch (error) {
      toast({ title: 'Could not check the roster', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [staff, toast]);

  useEffect(() => { check(new Date()); }, [check, refreshKey]);

  const checkNow = () => {
    const now = new Date();
    setDate(dateKey(now));
    setTime(format(now, 'HH:mm'));
    check(now);
  };

  const departmentName = (id?: number | null) => departments.find(d => d.id === id)?.name;
  const counts = rows ? ([
    ['doctor', 'doctors', rows.filter(r => r.person.role === 'Doctor').length],
    ['nurse', 'nurses', rows.filter(r => r.person.role === 'Nurse').length],
    ['other staff member', 'other staff', rows.filter(r => r.person.role !== 'Doctor' && r.person.role !== 'Nurse').length],
  ] as const).filter(([, , n]) => n > 0).map(([one, many, n]) => `${n} ${n === 1 ? one : many}`).join(', ') : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <Label htmlFor="checkDate">Date</Label>
          <Input id="checkDate" type="date" value={date} onChange={e => setDate(e.target.value)} className="sm:w-44" />
        </div>
        <div>
          <Label htmlFor="checkTime">Time</Label>
          <Input id="checkTime" type="time" value={time} onChange={e => setTime(e.target.value)} className="sm:w-32" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => date && time && check(parseISO(`${date}T${time}`))} disabled={isLoading || !date || !time} className="flex-1 sm:flex-none">
            <Search className="mr-2 h-4 w-4" /> {t('Check')}
          </Button>
          <Button variant="outline" onClick={checkNow} disabled={isLoading} className="flex-1 sm:flex-none">{t('Now')}</Button>
        </div>
      </div>

      {checkedAt && rows && (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">{format(checkedAt, 'EEEE d MMMM yyyy, HH:mm')}</span>
            {' — '}{rows.length === 0 ? 'nobody was on the roster or clocked in.' : `${counts}.`}
          </p>
          {!canSeeAllAttendance && (
            <p className="text-xs text-muted-foreground">You can see everyone&apos;s planned shifts, but only your own clock-ins.</p>
          )}
          {rows.length > 0 && (
            <ul className="divide-y rounded-md border">
              {rows.map(({ person, shift, entry }) => {
                const status = shift && entry ? { label: 'On duty', cls: 'bg-emerald-600 hover:bg-emerald-600' }
                  : shift && !entry ? (canSeeAllAttendance && checkedAt <= new Date()
                    ? { label: 'Not clocked in', cls: 'bg-destructive hover:bg-destructive' }
                    : { label: 'Planned', cls: '' })
                  : { label: 'Clocked in, not on roster', cls: 'bg-amber-500 hover:bg-amber-500' };
                return (
                  <li key={person.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{person.name} <span className="text-xs font-normal text-muted-foreground">{person.role}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {shift ? `${shift.shiftType} ${shift.startTime}–${shift.endTime}${shift.departmentId ? ` · ${departmentName(shift.departmentId)}` : ''}` : 'No shift planned'}
                        {entry && ` · clocked in ${format(new Date(entry.clockIn), 'd MMM HH:mm')}${entry.clockOut ? `, out ${format(new Date(entry.clockOut), 'd MMM HH:mm')}` : ' (still on duty)'}`}
                      </p>
                    </div>
                    <Badge variant={status.cls ? 'default' : 'secondary'} className={cn('w-fit shrink-0', status.cls)}>{t(status.label)}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
