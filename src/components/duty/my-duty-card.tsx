"use client";

import { useCallback, useEffect, useState } from 'react';
import { addDays, differenceInMinutes, format } from 'date-fns';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { attendance as attendanceRepo, shifts as shiftsRepo } from '@/lib/data';
import { GRACE_MINUTES, dateKey, formatHours, formatMinutes, shiftWindow } from '@/lib/duty';
import type { AttendanceEntry, StaffShift } from '@/types/duty';
import type { StaffMember } from '@/types/staff';

// Clock in / out for the signed-in person, with their current or next shift.
export function MyDutyCard({ currentUser, refreshKey, onChange }: { currentUser: StaffMember; refreshKey: number; onChange: () => void }) {
  const { toast } = useToast();
  const [openEntry, setOpenEntry] = useState<AttendanceEntry | null>(null);
  const [myShifts, setMyShifts] = useState<StaffShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    const today = new Date();
    const [entry, shiftList] = await Promise.all([
      attendanceRepo.openEntry(currentUser.id),
      shiftsRepo.list(dateKey(addDays(today, -1)), dateKey(addDays(today, 7))),
    ]);
    setOpenEntry(entry);
    setMyShifts(shiftList.filter(s => s.staffId === currentUser.id));
  }, [currentUser.id]);

  useEffect(() => {
    load().catch(error => console.error('Could not load duty status', error)).finally(() => setIsLoading(false));
  }, [load, refreshKey]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleClock = async () => {
    setIsSaving(true);
    try {
      const entry = openEntry ? await attendanceRepo.clockOut() : await attendanceRepo.clockIn();
      toast({
        title: openEntry ? 'Clocked out' : 'Clocked in',
        description: openEntry
          ? `Off duty at ${format(new Date(entry.clockOut!), 'HH:mm')} after ${formatHours(differenceInMinutes(new Date(entry.clockOut!), new Date(entry.clockIn)) / 60)}.`
          : `On duty from ${format(new Date(entry.clockIn), 'HH:mm')}.`,
      });
      await load();
      onChange();
    } catch (error) {
      toast({ title: 'Could not update', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      await load().catch(() => undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const current = myShifts.find(s => { const w = shiftWindow(s); return w.start <= now && now < w.end; });
  const next = myShifts
    .filter(s => shiftWindow(s).start > now)
    .sort((a, b) => shiftWindow(a).start.getTime() - shiftWindow(b).start.getTime())[0];
  const describe = (s: StaffShift) => `${s.shiftType} · ${s.startTime}–${s.endTime}`;
  const lateMinutes = current && !openEntry ? differenceInMinutes(now, shiftWindow(current).start) : 0;

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><Clock className="h-5 w-5 text-primary" /> My Duty</CardTitle>
        <CardDescription>Clock in when you start work and clock out when you leave. The server&apos;s clock is used.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
            <>
              <p className="flex flex-wrap items-center gap-2">
                {openEntry
                  ? <><Badge className="bg-emerald-600 hover:bg-emerald-600">On duty</Badge> since {format(new Date(openEntry.clockIn), 'EEE d MMM, HH:mm')} ({formatHours(Math.max(0, differenceInMinutes(now, new Date(openEntry.clockIn))) / 60)})</>
                  : <><Badge variant="secondary">Off duty</Badge> You are not clocked in.</>}
              </p>
              {current && <p>Current shift: <span className="font-medium">{describe(current)}</span>{lateMinutes > GRACE_MINUTES && <span className="text-destructive"> — started {formatMinutes(lateMinutes)} ago</span>}</p>}
              {!current && next && <p>Next shift: <span className="font-medium">{format(shiftWindow(next).start, 'EEE d MMM')} · {describe(next)}</span></p>}
              {!current && !next && <p className="text-muted-foreground">No shifts on the roster for you in the next 7 days.</p>}
            </>
          )}
        </div>
        <Button size="lg" onClick={handleClock} disabled={isLoading || isSaving}
          variant={openEntry ? 'outline' : 'default'} className="w-full sm:w-auto">
          {openEntry ? <><LogOut className="mr-2 h-4 w-4" /> Clock Out</> : <><LogIn className="mr-2 h-4 w-4" /> Clock In</>}
        </Button>
      </CardContent>
    </Card>
  );
}
