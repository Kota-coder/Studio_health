import { NextResponse, type NextRequest } from 'next/server';
import { getAdminSupabase, getCurrentStaff } from '@/lib/supabase/server';
import type { StaffMember, StaffRole } from '@/types/staff';

// Staff logins are managed here because creating Supabase Auth users needs the
// service-role key, which must never reach the browser.

const MANAGER_ROLES: StaffRole[] = ['Super Admin', 'Admin', 'Doctor'];
const ALL_ROLES: StaffRole[] = ['Super Admin', 'Admin', 'Doctor', 'Nurse', 'Receptionist'];

type StaffInput = Omit<StaffMember, 'id'>;

function toStaffRow(input: StaffInput) {
  return {
    name: input.name.trim(),
    phone_number: input.phoneNumber ?? '',
    email: input.email.trim().toLowerCase(),
    role: input.role,
    hire_date: input.hireDate ?? '',
    salary: input.salary ?? null,
  };
}

function validate(input: StaffInput, callerRole: string): string | null {
  if (!input.name?.trim()) return 'Name is required.';
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return `Invalid email: ${input.email}`;
  if (!ALL_ROLES.includes(input.role)) return `Invalid role: ${input.role}`;
  if (input.role === 'Super Admin' && callerRole !== 'Super Admin') return 'Only a Super Admin can grant the Super Admin role.';
  return null;
}

async function requireManager() {
  const caller = await getCurrentStaff();
  if (!caller) return { error: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  if (!MANAGER_ROLES.includes(caller.role as StaffRole)) {
    return { error: NextResponse.json({ error: 'You do not have permission to manage staff.' }, { status: 403 }) };
  }
  return { caller };
}

async function audit(staffId: number, actionType: string, details: string, caller: { id: number; name: string }) {
  await getAdminSupabase().from('audit_log').insert({
    entity_type: 'staff',
    entity_id: String(staffId),
    action_type: actionType,
    change_details: details,
    staff_id: caller.id,
    staff_name: caller.name,
  });
}

// POST { staff: StaffInput[] } -> creates staff records and emails each an invite.
export async function POST(request: NextRequest) {
  const { caller, error } = await requireManager();
  if (error) return error;

  const body = await request.json().catch(() => null) as { staff?: StaffInput[] } | null;
  const inputs = body?.staff ?? [];
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return NextResponse.json({ error: 'No staff members provided.' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const redirectTo = `${request.nextUrl.origin}/auth/confirm?next=/set-password`;
  const created: number[] = [];
  const failures: string[] = [];

  for (const input of inputs) {
    const problem = validate(input, caller.role);
    if (problem) { failures.push(problem); continue; }
    const row = toStaffRow(input);

    const { data: existing } = await admin.from('staff').select('id').eq('email', row.email).maybeSingle();
    if (existing) { failures.push(`A staff member with email ${row.email} already exists.`); continue; }

    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(row.email, { redirectTo });
    if (inviteError || !invite.user) { failures.push(`Could not invite ${row.email}: ${inviteError?.message}`); continue; }

    const { data: inserted, error: insertError } = await admin.from('staff')
      .insert({ ...row, auth_user_id: invite.user.id }).select('id').single();
    if (insertError) {
      await admin.auth.admin.deleteUser(invite.user.id);
      failures.push(`Could not save ${row.email}: ${insertError.message}`);
      continue;
    }
    created.push(inserted.id);
    await audit(inserted.id, 'Staff Added', `${row.name} added as ${row.role}; invite sent to ${row.email}.`, caller);
  }

  return NextResponse.json({ created, failures }, { status: created.length > 0 || failures.length === 0 ? 200 : 400 });
}

// PATCH { id, staff: StaffInput } -> updates details; changing the email also changes the login.
export async function PATCH(request: NextRequest) {
  const { caller, error } = await requireManager();
  if (error) return error;

  const body = await request.json().catch(() => null) as { id?: number; staff?: StaffInput } | null;
  if (!body?.id || !body.staff) return NextResponse.json({ error: 'Missing staff details.' }, { status: 400 });
  const problem = validate(body.staff, caller.role);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: current } = await admin.from('staff').select('id, email, role, auth_user_id').eq('id', body.id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
  if (current.role === 'Super Admin' && caller.role !== 'Super Admin') {
    return NextResponse.json({ error: 'Only a Super Admin can edit a Super Admin.' }, { status: 403 });
  }

  const row = toStaffRow(body.staff);
  if (current.id === caller.id && row.email !== current.email) {
    return NextResponse.json({ error: 'You cannot change your own login email.' }, { status: 400 });
  }
  if (row.email !== current.email && current.auth_user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(current.auth_user_id, { email: row.email, email_confirm: true });
    if (authError) return NextResponse.json({ error: `Could not change login email: ${authError.message}` }, { status: 400 });
  }

  const { error: updateError } = await admin.from('staff').update(row).eq('id', body.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  await audit(body.id, 'Staff Updated', `Details updated for ${row.name} (${row.role}).`, caller);
  return NextResponse.json({ ok: true });
}

// DELETE ?id= -> deactivates the staff member and blocks their login. Records they
// authored keep pointing at them, so the row is kept.
export async function DELETE(request: NextRequest) {
  const { caller, error } = await requireManager();
  if (error) return error;

  const id = Number(request.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Missing staff id.' }, { status: 400 });
  if (id === caller.id) return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: current } = await admin.from('staff').select('id, name, role, auth_user_id').eq('id', id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
  if (current.role === 'Super Admin' && caller.role !== 'Super Admin') {
    return NextResponse.json({ error: 'Only a Super Admin can remove a Super Admin.' }, { status: 403 });
  }

  const { error: updateError } = await admin.from('staff').update({ active: false }).eq('id', id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  if (current.auth_user_id) {
    await admin.auth.admin.updateUserById(current.auth_user_id, { ban_duration: '876000h' });
  }
  await audit(id, 'Staff Deactivated', `${current.name} deactivated; login disabled.`, caller);
  return NextResponse.json({ ok: true });
}
