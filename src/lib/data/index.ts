// Data access for the whole app. Pages call these instead of touching storage directly.
// Rows use snake_case columns that mirror the camelCase fields in src/types; nested
// values (bill items, template field data, ...) are jsonb and keep their camelCase keys.

import { getSupabase } from '@/lib/supabase/client';
import type { AuditLogEntry, CareNote, Patient, TestEntry } from '@/types/patient';
import type { Bill } from '@/types/billing';
import type { Payment } from '@/types/payment';
import type { StaffMember } from '@/types/staff';
import type { ReferringDoctor } from '@/types/referringDoctor';
import type { Medication } from '@/types/medication';
import type { Material } from '@/types/material';
import type { Vendor } from '@/types/vendor';
import type { MedicalTestCatalogItem } from '@/types/medicalTestCatalogItem';
import type { TreatmentTemplate } from '@/config/treatmentTemplates';
import type { Department, DepartmentMembers } from '@/types/department';

type Row = Record<string, unknown>;

const toSnakeKey = (key: string) => key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
const toCamelKey = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

// Keys that are present but undefined become null, so clearing a form field clears
// the column; keys that are absent are left untouched by updates.
function toRow(obj: object): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(obj)) {
    row[toSnakeKey(key)] = value === undefined ? null : value;
  }
  return row;
}

function fromRow<T>(row: Row): T {
  const obj: Row = {};
  for (const [key, value] of Object.entries(row)) {
    // Leave nulls out so optional fields read as undefined, like they did before.
    if (value !== null) obj[toCamelKey(key)] = value;
  }
  return obj as T;
}

// Unwraps a Supabase response, throwing on error. Rows are untyped (no generated
// schema types), so callers cast to Row / Row[].
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Row level security silently skips rows the user may not delete, so report that.
function checkDeleted(result: { data: unknown; error: { message: string } | null }): void {
  const rows = check(result) as Row[] | null;
  if (!rows || rows.length === 0) throw new Error('You do not have permission to delete this record.');
}

function check({ data, error }: { data: unknown; error: { message: string } | null }): any {
  if (error) throw new Error(error.message);
  return data;
}

const db = () => getSupabase();

// ---------------------------------------------------------------------------
// Generic CRUD for flat tables
// ---------------------------------------------------------------------------

function table<T extends { id: string | number }>(name: string, orderBy: string, omitOnWrite: string[] = []) {
  const writable = (obj: Partial<T>) => {
    const row = toRow(obj);
    delete row.id;
    for (const key of omitOnWrite) delete row[key];
    return row;
  };
  return {
    async list(): Promise<T[]> {
      const rows = check(await db().from(name).select('*').order(orderBy));
      return (rows as Row[]).map(r => fromRow<T>(r));
    },
    async get(id: T['id']): Promise<T | null> {
      const row = check(await db().from(name).select('*').eq('id', id).maybeSingle());
      return row ? fromRow<T>(row as Row) : null;
    },
    async create(obj: Omit<T, 'id'>): Promise<T> {
      const row = check(await db().from(name).insert(writable(obj as Partial<T>)).select().single());
      return fromRow<T>(row as Row);
    },
    async createMany(objs: Omit<T, 'id'>[]): Promise<T[]> {
      if (objs.length === 0) return [];
      const rows = check(await db().from(name).insert(objs.map(o => writable(o as Partial<T>))).select());
      return (rows as Row[]).map(r => fromRow<T>(r));
    },
    async update(id: T['id'], changes: Partial<T>): Promise<T> {
      const row = check(await db().from(name).update(writable(changes)).eq('id', id).select().single());
      return fromRow<T>(row as Row);
    },
    async remove(id: T['id']): Promise<void> {
      checkDeleted(await db().from(name).delete().eq('id', id).select('id'));
    },
  };
}

const referringDoctorTable = table<ReferringDoctor>('referring_doctors', 'name', ['created_at', 'audit_log']);
const referringDoctorFromRow = (doctor: ReferringDoctor): ReferringDoctor =>
  ({
    ...doctor,
    defaultReferralFee: doctor.defaultReferralFee == null ? null : Number(doctor.defaultReferralFee),
    defaultReferralPercent: doctor.defaultReferralPercent == null ? null : Number(doctor.defaultReferralPercent),
  });
export const referringDoctors = {
  ...referringDoctorTable,
  async list(): Promise<ReferringDoctor[]> {
    return (await referringDoctorTable.list()).map(referringDoctorFromRow);
  },
  async get(id: number): Promise<ReferringDoctor | null> {
    const doctor = await referringDoctorTable.get(id);
    return doctor ? referringDoctorFromRow(doctor) : null;
  },
};
export const medications = table<Medication>('medications', 'name');
export const materials = table<Material>('materials', 'name');
export const vendors = table<Vendor>('vendors', 'name');
export const testCatalog = table<MedicalTestCatalogItem>('medical_test_catalog', 'name');
export const treatmentTemplates = table<TreatmentTemplate>('treatment_templates', 'name');

// ---------------------------------------------------------------------------
// Departments and their doctors/nurses
// ---------------------------------------------------------------------------

const departmentTable = table<Department>('departments', 'name', ['created_at']);

function departmentFromRow(department: Department): Department {
  return { ...department, defaultDoctorFee: department.defaultDoctorFee == null ? null : Number(department.defaultDoctorFee) };
}

export const departments = {
  async list(): Promise<Department[]> {
    return (await departmentTable.list()).map(departmentFromRow);
  },
  async get(id: number): Promise<Department | null> {
    const department = await departmentTable.get(id);
    return department ? departmentFromRow(department) : null;
  },
  create: departmentTable.create,
  update: departmentTable.update,
  remove: departmentTable.remove,

  // Department id -> staff ids.
  async listMembers(): Promise<DepartmentMembers> {
    const rows = check(await db().from('department_staff').select('department_id, staff_id')) as Row[];
    const members: DepartmentMembers = {};
    for (const row of rows) {
      const departmentId = Number(row.department_id);
      (members[departmentId] ??= []).push(Number(row.staff_id));
    }
    return members;
  },

  // Replaces the department's doctors and nurses with staffIds.
  async setMembers(departmentId: number, staffIds: number[]): Promise<void> {
    check(await db().from('department_staff').delete().eq('department_id', departmentId));
    if (staffIds.length > 0) {
      check(await db().from('department_staff').insert(staffIds.map(staffId => ({ department_id: departmentId, staff_id: staffId }))));
    }
  },
};

// Staff are read directly; creating, editing and deactivating logins goes through
// /api/staff, which holds the service-role key needed to manage Supabase Auth users.
async function staffApi<T>(method: string, body?: unknown, query = ''): Promise<T> {
  const response = await fetch(`/api/staff${query}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok && !(result as { created?: unknown }).created) {
    throw new Error((result as { error?: string; failures?: string[] }).error
      ?? (result as { failures?: string[] }).failures?.join(' ')
      ?? 'Request failed');
  }
  return result as T;
}

export const staff = {
  async list(): Promise<StaffMember[]> {
    const rows = check(await db().from('staff').select('id, name, phone_number, email, role, hire_date, salary').eq('active', true).order('name'));
    return (rows as Row[]).map(r => fromRow<StaffMember>(r));
  },
  async get(id: number): Promise<StaffMember | null> {
    const row = check(await db().from('staff').select('id, name, phone_number, email, role, hire_date, salary').eq('id', id).eq('active', true).maybeSingle());
    return row ? fromRow<StaffMember>(row as Row) : null;
  },
  // Each new staff member gets an email invite to set their password.
  createMany(members: Omit<StaffMember, 'id'>[]): Promise<{ created: number[]; failures: string[] }> {
    return staffApi('POST', { staff: members });
  },
  async update(id: number, member: Omit<StaffMember, 'id'>): Promise<void> {
    await staffApi('PATCH', { id, staff: member });
  },
  async deactivate(id: number): Promise<void> {
    await staffApi('DELETE', undefined, `?id=${id}`);
  },
};

export async function countRows(tableName: 'patients' | 'staff'): Promise<number> {
  let query = db().from(tableName).select('id', { count: 'exact', head: true });
  if (tableName === 'staff') query = query.eq('active', true);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditEntityType = 'patient' | 'bill' | 'payment' | 'staff';

function toAuditEntry(row: Row): AuditLogEntry {
  return {
    id: row.id as string,
    timestamp: row.created_at as string,
    staffId: (row.staff_id as number) ?? 0,
    staffName: (row.staff_name as string) ?? 'Unknown',
    actionType: row.action_type as string,
    changeDetails: row.change_details as string,
  };
}

// The database stamps who and when (see audit_log_stamp in the migration).
export async function addAuditEntry(entityType: AuditEntityType, entityId: string | number, actionType: string, changeDetails: string): Promise<void> {
  check(await db().from('audit_log').insert({
    entity_type: entityType,
    entity_id: String(entityId),
    action_type: actionType,
    change_details: changeDetails,
  }));
}

export async function getAuditLog(entityType: AuditEntityType, entityId: string | number): Promise<AuditLogEntry[]> {
  const rows = check(await db().from('audit_log').select('*')
    .eq('entity_type', entityType).eq('entity_id', String(entityId)).order('created_at'));
  return (rows as Row[]).map(toAuditEntry);
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

const PATIENT_CHILD_KEYS = ['careNotes', 'tests', 'auditLog'] as const;
export type PatientFields = Omit<Patient, 'id' | (typeof PATIENT_CHILD_KEYS)[number]>;

function patientFromRow(row: Row): Patient {
  const { care_notes, patient_tests, ...rest } = row;
  const patient = fromRow<Patient>(rest);
  patient.assignedStaffIds = (patient.assignedStaffIds ?? []).map(Number);
  patient.condition = patient.condition || 'Unassigned';
  patient.doctorFee = patient.doctorFee == null ? null : Number(patient.doctorFee);
  patient.doctorFeeStatus = patient.doctorFeeStatus || 'Pending';
  patient.referralFee = patient.referralFee == null ? null : Number(patient.referralFee);
  patient.referralFeeStatus = patient.referralFeeStatus || 'Pending';
  patient.careNotes = ((care_notes as Row[] | undefined) ?? [])
    .map(r => fromRow<CareNote>(r))
    .map(n => ({ ...n, medicationsMentioned: n.medicationsMentioned ?? [], templateFieldsData: n.templateFieldsData ?? {} }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  patient.tests = ((patient_tests as Row[] | undefined) ?? [])
    .map(r => fromRow<TestEntry>(r))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  patient.auditLog = [];
  return patient;
}

function patientRow(fields: Partial<PatientFields>): Row {
  const row = toRow(fields);
  for (const key of ['id', 'care_notes', 'tests', 'audit_log', 'created_at', 'updated_at']) delete row[key];
  return row;
}

export const patients = {
  // Includes care notes and tests, which the dashboards use for summaries.
  async list(): Promise<Patient[]> {
    const rows = check(await db().from('patients').select('*, care_notes(*), patient_tests(*)').order('id'));
    return (rows as Row[]).map(patientFromRow);
  },

  // Patient records only, without notes and tests (for pickers and lookups).
  async listBasic(): Promise<Patient[]> {
    const rows = check(await db().from('patients').select('*').order('id'));
    return (rows as Row[]).map(patientFromRow);
  },

  // Includes care notes, tests and the audit trail.
  async get(id: number): Promise<Patient | null> {
    const row = check(await db().from('patients').select('*, care_notes(*), patient_tests(*)').eq('id', id).maybeSingle());
    if (!row) return null;
    const patient = patientFromRow(row as Row);
    patient.auditLog = await getAuditLog('patient', id);
    return patient;
  },

  async create(fields: PatientFields, audit: { actionType: string; details: string }): Promise<Patient> {
    const row = check(await db().from('patients').insert(patientRow(fields)).select().single());
    const patient = patientFromRow(row as Row);
    await addAuditEntry('patient', patient.id, audit.actionType, audit.details);
    return patient;
  },

  async update(id: number, changes: Partial<PatientFields>, audit: { actionType: string; details: string }): Promise<void> {
    check(await db().from('patients').update(patientRow(changes)).eq('id', id));
    await addAuditEntry('patient', id, audit.actionType, audit.details);
  },

  async remove(id: number): Promise<void> {
    checkDeleted(await db().from('patients').delete().eq('id', id).select('id'));
  },

  // Cases the doctor attended whose fee is set but not yet paid.
  async listUnpaidDoctorCases(doctorId: number): Promise<Patient[]> {
    const rows = check(await db().from('patients').select('*')
      .eq('attending_doctor_id', doctorId).eq('doctor_fee_status', 'Pending').not('doctor_fee', 'is', null).order('id'));
    return (rows as Row[]).map(patientFromRow);
  },

  // Marks the cases' doctor fees as paid by paymentId (or back to Pending when paymentId is null).
  async setDoctorFeePayment(patientIds: number[], paymentId: string | null): Promise<void> {
    if (patientIds.length === 0) return;
    check(await db().from('patients')
      .update({ doctor_fee_status: paymentId ? 'Paid' : 'Pending', doctor_fee_payment_id: paymentId })
      .in('id', patientIds));
    for (const id of patientIds) {
      await addAuditEntry('patient', id, paymentId ? 'Doctor Fee Paid' : 'Doctor Fee Reopened',
        paymentId ? `Doctor's fee for this case paid in ${paymentId}.` : 'Doctor fee marked unpaid again.');
    }
  },

  // Marks referral fees as paid by paymentId. fees gives the amount for patients whose
  // fee wasn't set yet (the referring doctor's default), so the record shows what was paid.
  async setReferralFeePayment(fees: Array<{ patientId: number; fee: number | null }>, paymentId: string): Promise<void> {
    for (const { patientId, fee } of fees) {
      check(await db().from('patients')
        .update({ referral_fee_status: 'Paid', referral_fee_payment_id: paymentId, ...(fee != null ? { referral_fee: fee } : {}) })
        .eq('id', patientId));
      await addAuditEntry('patient', patientId, 'Referral Fee Paid', `Referral fee${fee != null ? ` of ₹${fee.toFixed(2)}` : ''} paid in ${paymentId}.`);
    }
  },

  async addCareNote(patientId: number, note: Omit<CareNote, 'id' | 'createdAt'>): Promise<CareNote> {
    const row = check(await db().from('care_notes').insert({ ...toRow(note), patient_id: patientId }).select().single());
    await addAuditEntry('patient', patientId, 'Care Note Added', `New care note added (Template: ${note.templateName || 'General Note'}).`);
    const { patientId: _omit, ...saved } = fromRow<CareNote & { patientId: number }>(row as Row);
    return { ...saved, medicationsMentioned: saved.medicationsMentioned ?? [] };
  },

  async addTest(patientId: number, test: Omit<TestEntry, 'id' | 'createdAt'>): Promise<TestEntry> {
    const row = check(await db().from('patient_tests').insert({ ...toRow(test), patient_id: patientId }).select().single());
    await addAuditEntry('patient', patientId, 'Test Added', `New test added: ${test.testTypeName}.`);
    const { patientId: _omit, ...saved } = fromRow<TestEntry & { patientId: number }>(row as Row);
    return saved;
  },
};

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export type BillFields = Omit<Bill, 'id' | 'createdAt' | 'auditLog'>;

function billFromRow(row: Row): Bill {
  const bill = fromRow<Bill>(row);
  bill.items = bill.items ?? [];
  bill.totalAmount = Number(bill.totalAmount);
  bill.auditLog = [];
  return bill;
}

export const bills = {
  async list(filter?: { patientId?: number }): Promise<Bill[]> {
    let query = db().from('bills').select('*');
    if (filter?.patientId !== undefined) query = query.eq('patient_id', filter.patientId);
    const rows = check(await query.order('created_at', { ascending: false }));
    return (rows as Row[]).map(billFromRow);
  },

  async get(id: string): Promise<Bill | null> {
    const row = check(await db().from('bills').select('*').eq('id', id).maybeSingle());
    if (!row) return null;
    const bill = billFromRow(row as Row);
    bill.auditLog = await getAuditLog('bill', id);
    return bill;
  },

  async create(fields: BillFields, auditDetails?: string): Promise<Bill> {
    const row = check(await db().from('bills').insert(toRow(fields)).select().single());
    const bill = billFromRow(row as Row);
    await addAuditEntry('bill', bill.id, 'Bill Created', auditDetails ?? `Bill ${bill.id} created.`);
    return bill;
  },

  async update(id: string, changes: Partial<BillFields>, audit: { actionType: string; details: string }): Promise<void> {
    const row = toRow(changes);
    delete row.id; delete row.created_at; delete row.audit_log;
    check(await db().from('bills').update(row).eq('id', id));
    await addAuditEntry('bill', id, audit.actionType, audit.details);
  },

  async remove(id: string): Promise<void> {
    checkDeleted(await db().from('bills').delete().eq('id', id).select('id'));
  },
};

// ---------------------------------------------------------------------------
// Payments (clinic expenses)
// ---------------------------------------------------------------------------

export type PaymentFields = Omit<Payment, 'id' | 'createdAt' | 'auditLog'>;

function paymentFromRow(row: Row): Payment {
  const payment = fromRow<Payment>(row);
  payment.amount = Number(payment.amount);
  payment.associatedPatientIds = (payment.associatedPatientIds ?? []).map(Number);
  payment.purchasedMedications = payment.purchasedMedications ?? [];
  payment.purchasedMaterials = payment.purchasedMaterials ?? [];
  payment.auditLog = [];
  return payment;
}

export const payments = {
  async list(): Promise<Payment[]> {
    const rows = check(await db().from('payments').select('*').order('created_at', { ascending: false }));
    return (rows as Row[]).map(paymentFromRow);
  },

  async get(id: string): Promise<Payment | null> {
    const row = check(await db().from('payments').select('*').eq('id', id).maybeSingle());
    if (!row) return null;
    const payment = paymentFromRow(row as Row);
    payment.auditLog = await getAuditLog('payment', id);
    return payment;
  },

  async create(fields: PaymentFields, auditDetails?: string): Promise<Payment> {
    const row = check(await db().from('payments').insert(toRow(fields)).select().single());
    const payment = paymentFromRow(row as Row);
    await addAuditEntry('payment', payment.id, 'Payment Recorded', auditDetails ?? `Payment ${payment.id} of ₹${payment.amount.toFixed(2)} recorded.`);
    return payment;
  },

  async update(id: string, changes: Partial<PaymentFields>, audit: { actionType: string; details: string }): Promise<void> {
    const row = toRow(changes);
    delete row.id; delete row.created_at; delete row.audit_log;
    check(await db().from('payments').update(row).eq('id', id));
    await addAuditEntry('payment', id, audit.actionType, audit.details);
  },

  async remove(id: string): Promise<void> {
    checkDeleted(await db().from('payments').delete().eq('id', id).select('id'));
  },
};
