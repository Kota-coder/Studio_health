import { NextResponse } from 'next/server';
import { getAdminSupabase, getCurrentStaff } from '@/lib/supabase/server';

// Sample staff for the Sample Data page. They are roster entries only (no login),
// so demo patients can be assigned to them and salaries paid to them. Creating
// and deleting staff rows needs the service-role key, hence this route.

const SAMPLE_STAFF_EMAIL_DOMAIN = 'sample.cardiocare.test';

const SAMPLE_STAFF = [
  { name: 'Dr. Arjun Mehta', role: 'Doctor', phone_number: '9800000001' },
  { name: 'Dr. Kavya Iyer', role: 'Doctor', phone_number: '9800000002' },
  { name: 'Nurse Lakshmi Nair', role: 'Nurse', phone_number: '9800000003', salary: 15000 },
  { name: 'Nurse Rohit Das', role: 'Nurse', phone_number: '9800000004', salary: 15000 },
  { name: 'Meena Joshi', role: 'Receptionist', phone_number: '9800000005', salary: 10000 },
  { name: 'Suresh Rao', role: 'Accounts', phone_number: '9800000006', salary: 12000 },
];

async function requireSuperAdmin() {
  const caller = await getCurrentStaff();
  if (!caller) return { error: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  if (caller.role !== 'Super Admin') return { error: NextResponse.json({ error: 'Only a Super Admin can manage sample data.' }, { status: 403 }) };
  return { caller };
}

// POST -> creates the sample staff (or returns them if they already exist).
export async function POST() {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const admin = getAdminSupabase();

  const { data: existing } = await admin.from('staff').select('id, name, role').like('email', `%@${SAMPLE_STAFF_EMAIL_DOMAIN}`);
  if (existing && existing.length > 0) return NextResponse.json({ staff: existing });

  const hireDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  const hireDateText = `${String(hireDate.getDate()).padStart(2, '0')}/${String(hireDate.getMonth() + 1).padStart(2, '0')}/${hireDate.getFullYear()}`;
  const rows = SAMPLE_STAFF.map(member => ({
    ...member,
    email: `${member.name.toLowerCase().replace(/^(dr|nurse)\.?\s+/, '').replace(/[^a-z]+/g, '.')}@${SAMPLE_STAFF_EMAIL_DOMAIN}`,
    hire_date: hireDateText,
  }));
  const { data, error: insertError } = await admin.from('staff').insert(rows).select('id, name, role');
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  return NextResponse.json({ staff: data });
}

// DELETE -> removes the sample staff. Notes they "wrote" keep their name text.
export async function DELETE() {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  const { error: deleteError } = await getAdminSupabase().from('staff').delete().like('email', `%@${SAMPLE_STAFF_EMAIL_DOMAIN}`);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
