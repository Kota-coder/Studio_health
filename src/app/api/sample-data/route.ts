import { NextResponse } from 'next/server';
import { getAdminSupabase, getCurrentStaff } from '@/lib/supabase/server';

// Sample staff for the Sample Data page. They are roster entries only (no login),
// so demo patients can be assigned to them, they can be placed in departments and on
// the duty roster, and salaries and doctor fees can be paid to them. Creating and
// deleting staff rows, and writing their clock-in history, needs the service-role key,
// hence this route.

const SAMPLE_STAFF_EMAIL_DOMAIN = 'sample.seva.test';
// Sample staff loaded before the rename to Seva.
const OLD_SAMPLE_STAFF_EMAIL_DOMAIN = 'sample.cardiocare.test';
const sampleEmailFilter = `email.like.%@${SAMPLE_STAFF_EMAIL_DOMAIN},email.like.%@${OLD_SAMPLE_STAFF_EMAIL_DOMAIN}`;

const SAMPLE_STAFF = [
  { name: 'Dr. Arjun Mehta', role: 'Doctor', phone_number: '9800000001' },
  { name: 'Dr. Kavya Iyer', role: 'Doctor', phone_number: '9800000002' },
  { name: 'Nurse Lakshmi Nair', role: 'Nurse', phone_number: '9800000003', salary: 15000 },
  { name: 'Nurse Rohit Das', role: 'Nurse', phone_number: '9800000004', salary: 15000 },
  { name: 'Dr. Sameer Khan', role: 'Doctor', phone_number: '9800000007' },
  { name: 'Nurse Asha Thomas', role: 'Nurse', phone_number: '9800000008', salary: 15000 },
  { name: 'Meena Joshi', role: 'Receptionist', phone_number: '9800000005', salary: 10000 },
  { name: 'Suresh Rao', role: 'Accounts', phone_number: '9800000006', salary: 12000 },
  { name: 'Ravi Kumar', role: 'Lab Technician', phone_number: '9800000009', salary: 14000 },
];

async function requireSuperAdmin() {
  const caller = await getCurrentStaff();
  if (!caller) return { error: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  if (caller.role !== 'Super Admin') return { error: NextResponse.json({ error: 'Only a Super Admin can manage sample data.' }, { status: 403 }) };
  return { caller };
}

// POST -> creates the sample staff, or any of them that are missing (e.g. roles added since
// the sample data was first loaded), and returns them all.
export async function POST() {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const admin = getAdminSupabase();

  const { data: existing } = await admin.from('staff').select('id, name, role').or(sampleEmailFilter);
  const missing = SAMPLE_STAFF.filter(member => !existing?.some(s => s.name === member.name));
  if (missing.length === 0) return NextResponse.json({ staff: existing });

  const hireDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  const hireDateText = `${String(hireDate.getDate()).padStart(2, '0')}/${String(hireDate.getMonth() + 1).padStart(2, '0')}/${hireDate.getFullYear()}`;
  const rows = missing.map(member => ({
    ...member,
    email: `${member.name.toLowerCase().replace(/^(dr|nurse)\.?\s+/, '').replace(/[^a-z]+/g, '.')}@${SAMPLE_STAFF_EMAIL_DOMAIN}`,
    hire_date: hireDateText,
  }));
  const { data, error: insertError } = await admin.from('staff').insert(rows).select('id, name, role');
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  return NextResponse.json({ staff: [...(existing ?? []), ...(data ?? [])] });
}

interface DutyBody {
  shifts?: Array<Record<string, unknown>>;
  attendance?: Array<Record<string, unknown>>;
}

// PUT -> adds the sample staff's duty roster and clock-in history. Only rows for
// sample staff are accepted, so this can't write anyone else's attendance.
export async function PUT(request: Request) {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const admin = getAdminSupabase();
  const body = (await request.json().catch(() => ({}))) as DutyBody;

  const { data: sampleStaff, error: staffError } = await admin.from('staff').select('id').or(sampleEmailFilter);
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 400 });
  const sampleIds = new Set((sampleStaff ?? []).map(s => Number(s.id)));
  const rows = [...(body.shifts ?? []), ...(body.attendance ?? [])];
  if (rows.some(row => !sampleIds.has(Number(row.staff_id)))) {
    return NextResponse.json({ error: 'Duty rows must belong to sample staff.' }, { status: 400 });
  }

  const shifts = (body.shifts ?? []).map(({ staff_id, shift_date, start_time, end_time, shift_type, department_id, notes }) =>
    ({ staff_id, shift_date, start_time, end_time, shift_type, department_id, notes }));
  const attendance = (body.attendance ?? []).map(({ staff_id, clock_in, clock_out, source, notes, recorded_by_staff_id }) =>
    ({ staff_id, clock_in, clock_out, source, notes, recorded_by_staff_id }));
  if (shifts.length) {
    const { error: shiftError } = await admin.from('staff_shifts').insert(shifts);
    if (shiftError) return NextResponse.json({ error: shiftError.message }, { status: 400 });
  }
  if (attendance.length) {
    const { error: attendanceError } = await admin.from('staff_attendance').insert(attendance);
    if (attendanceError) return NextResponse.json({ error: attendanceError.message }, { status: 400 });
  }
  return NextResponse.json({ shifts: shifts.length, attendance: attendance.length });
}

// DELETE -> removes the sample staff, with their shifts and attendance. Notes they
// "wrote" keep their name text.
export async function DELETE() {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const { error: deleteError } = await getAdminSupabase().from('staff').delete().or(sampleEmailFilter);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
