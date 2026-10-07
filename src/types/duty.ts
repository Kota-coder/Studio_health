export type ShiftType = 'Morning' | 'Evening' | 'Night' | 'Day' | 'On Call' | 'Custom';

// One planned shift on the duty roster. Times are the hospital's local time; a shift whose
// endTime is not after startTime ends the next day.
export interface StaffShift {
  id: number;
  staffId: number;
  shiftDate: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  shiftType: ShiftType;
  departmentId?: number | null;
  notes?: string;
  createdAt?: string;
}

// When someone was actually on duty. clockOut is empty while they are still on duty.
export interface AttendanceEntry {
  id: number;
  staffId: number;
  clockIn: string; // ISO timestamp
  clockOut?: string | null;
  source: 'Clock' | 'Manual';
  notes?: string;
  recordedByStaffId?: number | null;
  createdAt?: string;
}
