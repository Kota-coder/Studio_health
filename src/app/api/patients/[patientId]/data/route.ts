import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminSupabase, getCurrentStaff, type StaffCaller } from '@/lib/supabase/server';
import { PATIENT_DATA_REQUESTS_ENABLED } from '@/config/features';
import { PATIENT_FILES_BUCKET } from '@/lib/storage';

// Patient data requests: GET exports everything held about a patient, DELETE
// erases it. Super Admin only. Runs with the service-role key because erasing
// has to remove audit entries and stored files that staff can't normally touch.

type Row = Record<string, unknown>;

const IMAGE_FOLDERS = ['id-card', 'photo', 'admission', 'care-notes', 'tests', 'bills'];

async function authorise(params: Promise<{ patientId: string }>) {
  if (!PATIENT_DATA_REQUESTS_ENABLED) {
    return { error: NextResponse.json({ error: 'Not found.' }, { status: 404 }) };
  }
  const caller = await getCurrentStaff();
  if (!caller) return { error: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  if (caller.role !== 'Super Admin') {
    return { error: NextResponse.json({ error: 'Only a Super Admin can handle patient data requests.' }, { status: 403 }) };
  }
  const patientId = Number((await params).patientId);
  if (!Number.isInteger(patientId) || patientId <= 0) {
    return { error: NextResponse.json({ error: 'Invalid patient ID.' }, { status: 400 }) };
  }
  return { caller, patientId };
}

async function audit(admin: SupabaseClient, patientId: number, actionType: string, details: string, caller: StaffCaller) {
  await admin.from('audit_log').insert({
    entity_type: 'patient',
    entity_id: String(patientId),
    action_type: actionType,
    change_details: details,
    staff_id: caller.id,
    staff_name: caller.name,
  });
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function loadPatientRecords(admin: SupabaseClient, patientId: number) {
  const patient = unwrap(await admin.from('patients').select('*, care_notes(*), patient_tests(*)').eq('id', patientId).maybeSingle()) as Row | null;
  if (!patient) return null;
  const bills = unwrap(await admin.from('bills').select('*').eq('patient_id', patientId).order('created_at')) as Row[];
  const referralPayments = unwrap(await admin.from('payments').select('*').contains('associated_patient_ids', [patientId])) as Row[];
  const auditLog = unwrap(await admin.from('audit_log').select('*')
    .or(`and(entity_type.eq.patient,entity_id.eq.${patientId}),and(entity_type.eq.bill,entity_id.in.(${bills.map(b => `"${b.id}"`).join(',') || '""'}))`)
    .order('created_at')) as Row[];
  return { patient, bills, referralPayments, auditLog };
}

// Every storage path referenced by the patient's rows, plus anything in their folders.
async function collectImagePaths(admin: SupabaseClient, patientId: number, patient: Row, bills: Row[]): Promise<string[]> {
  const paths = new Set<string>();
  const add = (value: unknown) => { if (typeof value === 'string' && value) paths.add(value); };
  add(patient.id_card_image_path);
  add(patient.patient_photo_path);
  add(patient.initial_observation_attachment_path);
  for (const note of (patient.care_notes as Row[] | undefined) ?? []) add(note.attachment_path);
  for (const test of (patient.patient_tests as Row[] | undefined) ?? []) add(test.attachment_path);
  for (const bill of bills) add(bill.attachment_path);

  const bucket = admin.storage.from(PATIENT_FILES_BUCKET);
  for (const folder of IMAGE_FOLDERS) {
    const prefix = `patients/${patientId}/${folder}`;
    const { data } = await bucket.list(prefix, { limit: 1000 });
    for (const file of data ?? []) if (file.id) paths.add(`${prefix}/${file.name}`);
  }
  return [...paths];
}

// GET -> JSON download of the patient's record, notes, tests, bills, related
// payments, audit trail and images (as data URLs).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ patientId: string }> }) {
  const { caller, patientId, error } = await authorise(params);
  if (error) return error;

  const admin = getAdminSupabase();
  try {
    const records = await loadPatientRecords(admin, patientId);
    if (!records) return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });

    const files: Record<string, string> = {};
    const bucket = admin.storage.from(PATIENT_FILES_BUCKET);
    for (const path of await collectImagePaths(admin, patientId, records.patient, records.bills)) {
      const { data } = await bucket.download(path);
      if (data) files[path] = `data:${data.type || 'image/jpeg'};base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`;
    }

    await audit(admin, patientId, 'Patient Data Exported', 'Full copy of patient data downloaded.', caller);

    const exportedAt = new Date().toISOString();
    const body = JSON.stringify({ exportedAt, exportedBy: caller.name, ...records, files }, null, 2);
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="patient-${String(patientId).padStart(3, '0')}-data-${exportedAt.slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('Patient data export failed', e);
    return NextResponse.json({ error: 'Could not export patient data.' }, { status: 500 });
  }
}

// DELETE { confirmPatientId } -> erases the patient's personal and clinical data.
// Bills are kept for the clinic's accounts but no longer identify the patient; if
// the patient has bills, their row stays as an anonymous stub the bills point to.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ patientId: string }> }) {
  const { caller, patientId, error } = await authorise(params);
  if (error) return error;

  const body = await request.json().catch(() => null) as { confirmPatientId?: number } | null;
  if (body?.confirmPatientId !== patientId) {
    return NextResponse.json({ error: 'Confirmation does not match this patient.' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  try {
    const records = await loadPatientRecords(admin, patientId);
    if (!records) return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
    const { patient, bills, referralPayments } = records;

    const imagePaths = await collectImagePaths(admin, patientId, patient, bills);
    if (imagePaths.length > 0) {
      const { error: removeError } = await admin.storage.from(PATIENT_FILES_BUCKET).remove(imagePaths);
      if (removeError) throw new Error(`Could not delete images: ${removeError.message}`);
    }

    for (const payment of referralPayments) {
      const remaining = ((payment.associated_patient_ids as number[]) ?? []).filter(id => Number(id) !== patientId);
      unwrap(await admin.from('payments').update({ associated_patient_ids: remaining }).eq('id', payment.id));
    }

    if (bills.length > 0) {
      unwrap(await admin.from('bills')
        .update({ patient_name: 'Erased Patient', notes: null, attachment_path: null })
        .eq('patient_id', patientId));
    }

    // The patient's own audit trail names them, so it goes too.
    unwrap(await admin.from('audit_log').delete().eq('entity_type', 'patient').eq('entity_id', String(patientId)));

    if (bills.length === 0) {
      unwrap(await admin.from('patients').delete().eq('id', patientId)); // care notes and tests cascade
    } else {
      unwrap(await admin.from('care_notes').delete().eq('patient_id', patientId));
      unwrap(await admin.from('patient_tests').delete().eq('patient_id', patientId));
      unwrap(await admin.from('patients').update({
        first_name: 'Erased',
        last_name: 'Patient',
        gender: null,
        date_of_birth: null,
        mobile_number: null,
        email_address: null,
        address: null,
        id_card_type: null,
        id_number: null,
        emergency_contact_name: null,
        emergency_contact_number: null,
        id_card_image_path: null,
        patient_photo_path: null,
        condition: 'Discharged',
        assigned_staff_ids: [],
        reason_for_visit: null,
        initial_observations_text: null,
        initial_observation_attachment_path: null,
        admission_condition: null,
        referred_doctor_id: null,
      }).eq('id', patientId));
    }

    // Kept as proof the request was handled; contains no personal data.
    await audit(admin, patientId, 'Patient Data Erased', `Personal and clinical data erased on request. ${bills.length} bill(s) kept without patient details.`, caller);
    return NextResponse.json({ ok: true, billsKept: bills.length });
  } catch (e) {
    console.error('Patient data erasure failed', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not erase patient data.' }, { status: 500 });
  }
}
