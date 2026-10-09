// Data access for the whole app. Pages call these instead of touching storage directly.
// Rows use snake_case columns that mirror the camelCase fields in src/types; nested
// values (bill items, template field data, ...) are jsonb and keep their camelCase keys.

import { getSupabase } from '@/lib/supabase/client';
import { MINUTE, cached, invalidate } from './cache';
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
import type { AttendanceEntry, StaffShift } from '@/types/duty';
import type { PaymentMethodOption } from '@/types/paymentMethod';
import type { InventoryItem, InventoryKind, NewStockMovement, StockMovement } from '@/types/inventory';
import type { HospitalLink } from '@/types/hospitalLink';
import type { LabTechnician, TestRequest } from '@/types/testRequest';
import type { PharmacyOrder, PharmacyOrderItem } from '@/types/pharmacyOrder';
import type { BillItem } from '@/types/billing';
import { DEFAULT_PROFILE, type HospitalProfile } from '@/lib/branding';
import { toDMY } from '@/lib/format';

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

// Wraps a repository so that its write methods clear the given cache entries once they finish.
function invalidatesOnWrite<T extends object>(repo: T, writes: Array<keyof T>, prefixes: string[]): T {
  const wrapped = { ...repo } as Record<keyof T, unknown>;
  for (const name of writes) {
    const write = repo[name] as unknown as (...args: unknown[]) => Promise<unknown>;
    wrapped[name] = async (...args: unknown[]) => {
      try {
        return await write(...args);
      } finally {
        invalidate(...prefixes);
      }
    };
  }
  return wrapped as T;
}

// Reference data changes rarely; this tab re-reads it at most this often (sooner after its own saves).
const REFERENCE_TTL = 10 * MINUTE;
// Dashboard lists and summaries: short enough that other staff's changes appear quickly.
const DASHBOARD_TTL = MINUTE;

function table<T extends { id: string | number }>(name: string, orderBy: string, omitOnWrite: string[] = [], cacheTtl = 0) {
  const writable = (obj: Partial<T>) => {
    const row = toRow(obj);
    delete row.id;
    for (const key of omitOnWrite) delete row[key];
    return row;
  };
  return {
    async list(): Promise<T[]> {
      const load = async () => (check(await db().from(name).select('*').order(orderBy)) as Row[]).map(r => fromRow<T>(r));
      return cacheTtl ? cached(`${name}:list`, cacheTtl, load) : load();
    },
    async get(id: T['id']): Promise<T | null> {
      const row = check(await db().from(name).select('*').eq('id', id).maybeSingle());
      return row ? fromRow<T>(row as Row) : null;
    },
    async create(obj: Omit<T, 'id'>): Promise<T> {
      try {
        const row = check(await db().from(name).insert(writable(obj as Partial<T>)).select().single());
        return fromRow<T>(row as Row);
      } finally { invalidate(`${name}:`, 'summary:'); }
    },
    async createMany(objs: Omit<T, 'id'>[]): Promise<T[]> {
      if (objs.length === 0) return [];
      try {
        const rows = check(await db().from(name).insert(objs.map(o => writable(o as Partial<T>))).select());
        return (rows as Row[]).map(r => fromRow<T>(r));
      } finally { invalidate(`${name}:`, 'summary:'); }
    },
    async update(id: T['id'], changes: Partial<T>): Promise<T> {
      try {
        const row = check(await db().from(name).update(writable(changes)).eq('id', id).select().single());
        return fromRow<T>(row as Row);
      } finally { invalidate(`${name}:`, 'summary:'); }
    },
    async remove(id: T['id']): Promise<void> {
      try {
        checkDeleted(await db().from(name).delete().eq('id', id).select('id'));
      } finally { invalidate(`${name}:`, 'summary:'); }
    },
  };
}

const referringDoctorTable = table<ReferringDoctor>('referring_doctors', 'name', ['created_at', 'audit_log'], REFERENCE_TTL);
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
const numberOrNull = (value: unknown) => (value == null ? null : Number(value));
const medicationTable = table<Medication>('medications', 'name', [], REFERENCE_TTL);
const materialTable = table<Material>('materials', 'name', [], REFERENCE_TTL);
export const medications = {
  ...medicationTable,
  async list() { return (await medicationTable.list()).map(m => ({ ...m, listPrice: Number(m.listPrice), reorderLevel: numberOrNull(m.reorderLevel) })); },
  async get(id: string) { const m = await medicationTable.get(id); return m && { ...m, listPrice: Number(m.listPrice), reorderLevel: numberOrNull(m.reorderLevel) }; },
};
export const materials = {
  ...materialTable,
  async list() { return (await materialTable.list()).map(m => ({ ...m, reorderLevel: numberOrNull(m.reorderLevel) })); },
  async get(id: string) { const m = await materialTable.get(id); return m && { ...m, reorderLevel: numberOrNull(m.reorderLevel) }; },
};
export const vendors = table<Vendor>('vendors', 'name', [], REFERENCE_TTL);
// The Super Admin's other hospitals (links only; see hospital_links in the schema).
export const hospitalLinks = table<HospitalLink>('hospital_links', 'sort_order', ['created_at'], REFERENCE_TTL);
export const testCatalog = table<MedicalTestCatalogItem>('medical_test_catalog', 'name', [], REFERENCE_TTL);
export const treatmentTemplates = table<TreatmentTemplate>('treatment_templates', 'name', [], REFERENCE_TTL);
// Managed by the Super Admin (Organization Setup → Payment Methods); in display order.
export const paymentMethods = table<PaymentMethodOption>('payment_methods', 'sort_order', ['created_at'], REFERENCE_TTL);

// ---------------------------------------------------------------------------
// Departments and their doctors/nurses
// ---------------------------------------------------------------------------

const departmentTable = table<Department>('departments', 'name', ['created_at'], REFERENCE_TTL);

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
  listMembers(): Promise<DepartmentMembers> {
    return cached('departments:members', REFERENCE_TTL, async () => {
      const rows = check(await db().from('department_staff').select('department_id, staff_id')) as Row[];
      const members: DepartmentMembers = {};
      for (const row of rows) {
        const departmentId = Number(row.department_id);
        (members[departmentId] ??= []).push(Number(row.staff_id));
      }
      return members;
    });
  },

  // Replaces the department's doctors and nurses with staffIds.
  async setMembers(departmentId: number, staffIds: number[]): Promise<void> {
    try {
      check(await db().from('department_staff').delete().eq('department_id', departmentId));
      if (staffIds.length > 0) {
        check(await db().from('department_staff').insert(staffIds.map(staffId => ({ department_id: departmentId, staff_id: staffId }))));
      }
    } finally { invalidate('departments:'); }
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

const STAFF_COLUMNS = 'id, name, phone_number, email, role, hire_date';

// Salaries are only readable by the roles that manage staff (staff_salaries()).
async function withSalaries(members: StaffMember[]): Promise<StaffMember[]> {
  const pay = check(await db().rpc('staff_salaries')) as Array<{ id: number; salary: number | null }>;
  const byId = new Map(pay.map(p => [Number(p.id), p.salary]));
  return members.map(m => ({ ...m, salary: byId.get(m.id) == null ? undefined : Number(byId.get(m.id)) }));
}

export const staff = invalidatesOnWrite({
  // Active staff without salaries: for names, assignments and filters.
  list(): Promise<StaffMember[]> {
    return cached('staff:list', REFERENCE_TTL, async () => {
      const rows = check(await db().from('staff').select(STAFF_COLUMNS).eq('active', true).order('name'));
      return (rows as Row[]).map(r => fromRow<StaffMember>(r));
    });
  },
  // Staff Management: with salaries.
  async listWithSalaries(): Promise<StaffMember[]> {
    return withSalaries(await staff.list());
  },
  async get(id: number): Promise<StaffMember | null> {
    const row = check(await db().from('staff').select(STAFF_COLUMNS).eq('id', id).eq('active', true).maybeSingle());
    return row ? (await withSalaries([fromRow<StaffMember>(row as Row)]))[0] : null;
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
}, ['createMany', 'update', 'deactivate'], ['staff:', 'summary:']);

// ---------------------------------------------------------------------------
// Duty roster (planned shifts) and attendance (actual time on duty)
// ---------------------------------------------------------------------------

const shiftTable = table<StaffShift>('staff_shifts', 'shift_date', ['created_at']);
// Postgres returns times as HH:mm:ss.
const shiftFromRow = (shift: StaffShift): StaffShift =>
  ({ ...shift, startTime: shift.startTime.slice(0, 5), endTime: shift.endTime.slice(0, 5) });

export const shifts = {
  // Shifts dated from..to (yyyy-MM-dd, inclusive); only one person's when staffId is given.
  async list(from: string, to: string, staffId?: number): Promise<StaffShift[]> {
    let query = db().from('staff_shifts').select('id, staff_id, shift_date, start_time, end_time, shift_type, department_id, notes')
      .gte('shift_date', from).lte('shift_date', to);
    if (staffId !== undefined) query = query.eq('staff_id', staffId);
    const rows = check(await query.order('shift_date').order('start_time'));
    return (rows as Row[]).map(r => shiftFromRow(fromRow<StaffShift>(r)));
  },
  async create(fields: Omit<StaffShift, 'id'>): Promise<StaffShift> {
    return shiftFromRow(await shiftTable.create(fields));
  },
  async createMany(list: Omit<StaffShift, 'id'>[]): Promise<StaffShift[]> {
    return (await shiftTable.createMany(list)).map(shiftFromRow);
  },
  async update(id: number, changes: Partial<StaffShift>): Promise<StaffShift> {
    return shiftFromRow(await shiftTable.update(id, changes));
  },
  remove: shiftTable.remove,
};

const attendanceTable = table<AttendanceEntry>('staff_attendance', 'clock_in', ['created_at', 'source', 'recorded_by_staff_id']);

export const attendance = {
  // Entries that overlap fromIso..toIso, including people still on duty.
  // Staff without a manager role only get their own entries (row level security).
  async list(fromIso: string, toIso: string): Promise<AttendanceEntry[]> {
    const rows = check(await db().from('staff_attendance').select('*')
      .lt('clock_in', toIso)
      .or(`clock_out.gte.${fromIso},clock_out.is.null`)
      .order('clock_in', { ascending: false }));
    return (rows as Row[]).map(r => fromRow<AttendanceEntry>(r));
  },
  async openEntry(staffId: number): Promise<AttendanceEntry | null> {
    const row = check(await db().from('staff_attendance').select('*')
      .eq('staff_id', staffId).is('clock_out', null).maybeSingle());
    return row ? fromRow<AttendanceEntry>(row as Row) : null;
  },
  // Clocking in and out uses the server's clock, not the device's.
  async clockIn(note?: string): Promise<AttendanceEntry> {
    try {
      return fromRow<AttendanceEntry>(check(await db().rpc('clock_in', { note: note ?? null })) as Row);
    } finally { invalidate('summary:home'); }
  },
  async clockOut(note?: string): Promise<AttendanceEntry> {
    try {
      return fromRow<AttendanceEntry>(check(await db().rpc('clock_out', { note: note ?? null })) as Row);
    } finally { invalidate('summary:home'); }
  },
  // Manual entries and corrections (Super Admin, Admin).
  create: (fields: Pick<AttendanceEntry, 'staffId' | 'clockIn' | 'clockOut' | 'notes'>) =>
    attendanceTable.create(fields as Omit<AttendanceEntry, 'id'>),
  update: (id: number, changes: Partial<Pick<AttendanceEntry, 'clockIn' | 'clockOut' | 'notes'>>) =>
    attendanceTable.update(id, changes),
  remove: attendanceTable.remove,
};

// ---------------------------------------------------------------------------
// Financial Dashboard: totals worked out by the database (financial_summary in
// supabase/migrations/20261016000000_seva_schema.sql)
// ---------------------------------------------------------------------------

export interface FinancialSummary {
  billCount: number;
  paymentCount: number;
  totalBilled: number;
  totalCollected: number;
  totalSpent: number;
  billStatusCounts: Record<string, number>;
  billTypeAmounts: Record<string, number>;
  paymentTypeAmounts: Record<string, number>;
  receivedByMethod: Record<string, number>; // Bills paid (partly paid at half) by payment method
  paidOutByMethod: Record<string, number>; // Payments by payment method
  monthly: Array<{ month: string; billed: number; collected: number; spent: number }>; // month = yyyy-MM
  doctorFees: Array<{ doctorId: number; doctor: string; departments: string[]; cases: number; paid: number; pending: number }>;
  referralFees: Array<{ doctorId: number; doctor: string; referrals: number; paid: number; pending: number; unpriced: number }>;
}

// Totals for bills and payments dated within range (all time if empty).
export function financialSummaryKey(range: DateRange = {}) {
  return `summary:financial:${range.from ?? ''}:${range.to ?? ''}`;
}
export function financialSummary(range: DateRange = {}): Promise<FinancialSummary> {
  return cached(financialSummaryKey(range), DASHBOARD_TTL, async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    return check(await db().rpc('financial_summary', { tz: timeZone, from_date: range.from ?? null, to_date: range.to ?? null })) as FinancialSummary;
  });
}

// ---------------------------------------------------------------------------
// Hospital profile (name, logo, colour) — one row; see supabase/migrations/20261016000000_seva_schema.sql
// ---------------------------------------------------------------------------

export const hospitalProfile = {
  async get(): Promise<HospitalProfile> {
    const row = check(await db().from('hospital_profile').select('*').eq('id', 1).maybeSingle()) as Row | null;
    return row ? { ...DEFAULT_PROFILE, ...fromRow<HospitalProfile>(row) } : DEFAULT_PROFILE;
  },
  async update(changes: Partial<HospitalProfile>): Promise<HospitalProfile> {
    const row = check(await db().from('hospital_profile').update(toRow(changes)).eq('id', 1).select().single()) as Row;
    return { ...DEFAULT_PROFILE, ...fromRow<HospitalProfile>(row) };
  },
  // Uploads PNGs into a new folder of the public "branding" bucket and returns the folder.
  async uploadBranding(files: Record<string, Blob>): Promise<string> {
    const folder = `v${Date.now()}`;
    for (const [name, blob] of Object.entries(files)) {
      const { error } = await db().storage.from('branding').upload(`${folder}/${name}`, blob, {
        contentType: 'image/png', cacheControl: '31536000', upsert: false,
      });
      if (error) throw new Error(error.message);
    }
    return folder;
  },
};

// ---------------------------------------------------------------------------
// Inventory: pharmacy and material stock. Bills and payments update it in the database
// (see stock_movements in the schema); their saves clear 'summary:' so this re-reads.
// ---------------------------------------------------------------------------

function stockMovementFromRow(row: Row): StockMovement {
  const movement = fromRow<StockMovement>(row);
  movement.quantity = Number(movement.quantity);
  movement.unitCost = numberOrNull(movement.unitCost);
  return movement;
}

export const inventory = {
  // Every item with stock on hand, value and what came in and went out in the range.
  summary(range: DateRange = {}): Promise<InventoryItem[]> {
    return cached(`summary:inventory:${range.from ?? ''}:${range.to ?? ''}`, DASHBOARD_TTL, async () =>
      check(await db().rpc('inventory_summary', { from_date: range.from ?? null, to_date: range.to ?? null })) as InventoryItem[]);
  },
  // The latest changes to one item's stock, newest first.
  async history(kind: InventoryKind, itemId: string, limit = 50): Promise<StockMovement[]> {
    const rows = check(await db().from('stock_movements').select('*')
      .eq(kind === 'pharmacy' ? 'medication_id' : 'material_id', itemId)
      .order('moved_on', { ascending: false }).order('id', { ascending: false }).limit(limit));
    return (rows as Row[]).map(stockMovementFromRow);
  },
  async record(entries: NewStockMovement[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      check(await db().from('stock_movements').insert(entries.map(e => ({
        medication_id: e.kind === 'pharmacy' ? e.itemId : null,
        material_id: e.kind === 'material' ? e.itemId : null,
        quantity: e.quantity,
        unit_cost: e.unitCost ?? null,
        reason: e.reason,
        note: e.note?.trim() || null,
        ...(e.movedOn ? { moved_on: e.movedOn } : {}),
      }))));
    } finally { invalidate('summary:'); }
  },
  async remove(id: number): Promise<void> {
    try {
      checkDeleted(await db().from('stock_movements').delete().eq('id', id).select('id'));
    } finally { invalidate('summary:'); }
  },
};

// ---------------------------------------------------------------------------
// Home dashboard summary: only the sections the signed-in role may see (home_summary()).
// ---------------------------------------------------------------------------

export interface HomeSummary {
  patients: { inCare: number; critical: number; newToday: number; mine: number; myCritical: number };
  duty: { clockedInSince: string | null; onDutyNow: number; nextShift: { date: string; type: string; start: string; end: string } | null };
  billing?: { todayCount: number; todayAmount: number; unpaidCount: number; unpaidAmount: number };
  money?: { collectedToday: number; collectedMonth: number; paidOutToday: number; paidOutMonth: number };
  feesOwed?: { doctorAmount: number; doctorCases: number; referralAmount: number; referralCases: number };
  myFees?: { pendingAmount: number; pendingCases: number };
  stock?: { outOfStock: number; low: number };
  lab?: { mine: number; waiting: number; urgent: number };
  pharmacy?: { waiting: number; dispensedToday: number };
}

export function homeSummary(): Promise<HomeSummary | null> {
  return cached('summary:home', DASHBOARD_TTL, async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    return check(await db().rpc('home_summary', { tz: timeZone })) as HomeSummary | null;
  });
}

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

// Columns the Payments form needs for referral and doctor-fee cases.
const FEE_FIELDS = 'id, first_name, last_name, reason_for_visit, admission_date, department_id, '
  + 'referred_doctor_id, referral_fee, referral_fee_status, referral_fee_basis, referral_fee_payment_id, '
  + 'attending_doctor_id, doctor_fee, doctor_fee_status, doctor_fee_payment_id';

// Dashboard cards: names, care team and the latest note only.
export const DISCHARGED_DAYS = 30;
const dashboardQuery = () => db().from('patients')
  .select('id, first_name, last_name, condition, reason_for_visit, department_id, attending_doctor_id, attending_nurse_id, assigned_staff_ids, '
    + 'care_notes(id, text, template_name, staff_id, staff_name, created_at)')
  .order('id')
  .order('created_at', { referencedTable: 'care_notes', ascending: false })
  .limit(1, { referencedTable: 'care_notes' });

export const patients = invalidatesOnWrite({
  // For the Patient Dashboard: patient records with only their latest care note, instead of
  // every note and test. Cached briefly so going back and forth doesn't re-download it.
  // Patients in care, and those discharged in the last DISCHARGED_DAYS days (older discharged
  // patients load on request with listOlderDischarged), so the dashboard stays small as
  // the hospital's records grow.
  listForDashboard(): Promise<Patient[]> {
    return cached('dashboard:patients', DASHBOARD_TTL, async () => {
      const since = new Date(Date.now() - DISCHARGED_DAYS * 86400000).toISOString();
      const rows = check(await dashboardQuery().or(`condition.neq.Discharged,updated_at.gte.${since}`));
      return (rows as Row[]).map(patientFromRow);
    });
  },
  // Patients discharged before that, optionally only those whose name matches.
  async listOlderDischarged(nameSearch?: string): Promise<Patient[]> {
    const since = new Date(Date.now() - DISCHARGED_DAYS * 86400000).toISOString();
    let query = dashboardQuery().eq('condition', 'Discharged').lt('updated_at', since);
    const term = nameSearch?.trim().replace(/[%,()*]/g, ' ').trim();
    if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`).limit(50);
    return (check(await query) as Row[]).map(patientFromRow);
  },

  // Patients with a referring doctor or a doctor fee, with only the fields the Payments form
  // needs to list and settle referral and doctor fees.
  // Only cases with a fee still to pay, plus `includeIds` (the cases a payment being edited
  // covers), so the list doesn't grow with every case ever paid.
  async listFeeCases(includeIds: number[] = []): Promise<Patient[]> {
    const ids = includeIds.filter(Number.isInteger);
    const rows = check(await db().from('patients').select(FEE_FIELDS)
      .or('and(referred_doctor_id.not.is.null,referral_fee_status.neq.Paid),and(doctor_fee.not.is.null,doctor_fee_status.neq.Paid)'
        + (ids.length ? `,id.in.(${ids.join(',')})` : ''))
      .order('id'));
    return (rows as Row[]).map(patientFromRow);
  },

  // Names for the bill form's patient picker: the given patients, or else patients in care
  // and those discharged in the last DISCHARGED_DAYS days.
  async listNames(ids?: number[]): Promise<Patient[]> {
    let query = db().from('patients').select('id, first_name, last_name, condition, department_id').order('id');
    if (ids) query = query.in('id', ids.length ? ids : [0]);
    else query = query.or(`condition.neq.Discharged,updated_at.gte.${new Date(Date.now() - DISCHARGED_DAYS * 86400000).toISOString()}`);
    return (check(await query) as Row[]).map(patientFromRow);
  },

  // Patients still in care per department (one small column, counted here).
  activeCountByDepartment(): Promise<Map<number, number>> {
    return cached('dashboard:departmentCounts', DASHBOARD_TTL, async () => {
      const rows = check(await db().from('patients').select('department_id')
        .not('department_id', 'is', null).neq('condition', 'Discharged')) as Array<{ department_id: number }>;
      const counts = new Map<number, number>();
      for (const r of rows) counts.set(r.department_id, (counts.get(r.department_id) ?? 0) + 1);
      return counts;
    });
  },

  // Names of just these patients.
  async namesByIds(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = check(await db().from('patients').select('id, first_name, last_name').in('id', unique)) as Row[];
    return new Map(rows.map(r => [Number(r.id), `${r.first_name} ${r.last_name}`]));
  },

  // Patient records only, without notes and tests (for pickers and lookups).
  async listBasic(): Promise<Patient[]> {
    const rows = check(await db().from('patients').select('*').order('id'));
    return (rows as Row[]).map(patientFromRow);
  },

  // Includes care notes and tests (the audit trail loads separately, when it is opened).
  async get(id: number): Promise<Patient | null> {
    const row = check(await db().from('patients').select('*, care_notes(*), patient_tests(*)').eq('id', id).maybeSingle());
    return row ? patientFromRow(row as Row) : null;
  },
  auditLog: (id: number) => getAuditLog('patient', id),

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
    const rows = check(await db().from('patients').select(FEE_FIELDS)
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
}, ['create', 'update', 'remove', 'setDoctorFeePayment', 'setReferralFeePayment', 'addCareNote', 'addTest'], ['dashboard:', 'summary:']);

// ---------------------------------------------------------------------------
// Test requests (the lab queue)
// ---------------------------------------------------------------------------

const OPEN_REQUEST = ['Requested', 'In progress'];
export type NewTestRequest = Pick<TestRequest, 'patientId' | 'testTypeId' | 'testTypeName' | 'priority' | 'notes' | 'assignedToStaffId'>;

type TestBillRow = { bills: { id: string; payment_status: string; total_amount: number } | null } | null;

function testRequestFromRow(row: Row): TestRequest {
  const { patients: patient, patient_tests: test, ...rest } = row as Row & { patients?: { first_name: string; last_name: string } | null; patient_tests?: TestBillRow };
  const request = fromRow<TestRequest>(rest);
  if (patient) request.patientName = `${patient.first_name} ${patient.last_name}`;
  const bill = test?.bills;
  if (bill) request.bill = { id: bill.id, status: bill.payment_status, amount: Number(bill.total_amount) };
  return request;
}

// Changes one request, but only while it is still open; null when it is not (someone else
// finished or cancelled it meanwhile).
async function updateOpenRequest(id: string, changes: Row, onlyIfAssignedTo?: number | null): Promise<TestRequest | null> {
  let query = db().from('test_requests').update(changes).eq('id', id).in('status', OPEN_REQUEST);
  if (onlyIfAssignedTo !== undefined) {
    query = onlyIfAssignedTo === null ? query.is('assigned_to_staff_id', null)
      : query.or(`assigned_to_staff_id.is.null,assigned_to_staff_id.eq.${onlyIfAssignedTo}`);
  }
  const rows = check(await query.select()) as Row[];
  return rows.length ? testRequestFromRow(rows[0]) : null;
}

export const testRequests = invalidatesOnWrite({
  // Every open request, with the patient's name, oldest first (the queue order).
  async listOpen(): Promise<TestRequest[]> {
    return cached('lab:open', DASHBOARD_TTL, async () => {
      const rows = check(await db().from('test_requests').select('*, patients(first_name, last_name)')
        .in('status', OPEN_REQUEST).order('created_at'));
      return (rows as Row[]).map(testRequestFromRow);
    });
  },

  // Requests finished in the last day, newest first, with their test's bill.
  async listRecentlyDone(): Promise<TestRequest[]> {
    const since = new Date(Date.now() - 86400000).toISOString();
    const rows = check(await db().from('test_requests').select('*, patients(first_name, last_name), patient_tests(bills(id, payment_status, total_amount))')
      .eq('status', 'Done').gte('completed_at', since).order('completed_at', { ascending: false }).limit(50));
    return (rows as Row[]).map(testRequestFromRow);
  },

  // One patient's open requests.
  async listOpenForPatient(patientId: number): Promise<TestRequest[]> {
    const rows = check(await db().from('test_requests').select('*')
      .eq('patient_id', patientId).in('status', OPEN_REQUEST).order('created_at'));
    return (rows as Row[]).map(testRequestFromRow);
  },

  // Lab technicians, on-duty first, with how many open requests each has.
  technicians(): Promise<LabTechnician[]> {
    return cached('lab:technicians', DASHBOARD_TTL, async () => {
      const rows = check(await db().rpc('lab_technicians')) as Row[];
      return rows.map(r => ({ id: Number(r.id), name: String(r.name), onDuty: !!r.on_duty, openRequests: Number(r.open_requests) }));
    });
  },

  async create(request: NewTestRequest): Promise<TestRequest> {
    const row = check(await db().from('test_requests').insert(toRow(request)).select().single());
    const saved = testRequestFromRow(row as Row);
    await addAuditEntry('patient', request.patientId, 'Test Requested',
      `${request.testTypeName} requested${request.priority === 'Urgent' ? ' (urgent)' : ''}${saved.assignedToStaffName ? ` for ${saved.assignedToStaffName}` : ''}.`);
    return saved;
  },

  // A technician takes a request: from the queue, or one already assigned to them.
  async take(id: string, staffId: number): Promise<TestRequest> {
    const taken = await updateOpenRequest(id, { assigned_to_staff_id: staffId, status: 'In progress' }, staffId);
    if (!taken) throw new Error('Another technician has already taken this request, or it is no longer open.');
    return taken;
  },

  // Puts a request back in the queue for any technician.
  async release(id: string): Promise<void> {
    if (!await updateOpenRequest(id, { assigned_to_staff_id: null, status: 'Requested' })) throw new Error('This request is no longer open.');
  },

  async cancel(request: TestRequest): Promise<void> {
    if (!await updateOpenRequest(request.id, { status: 'Cancelled' })) throw new Error('This request is no longer open.');
    await addAuditEntry('patient', request.patientId, 'Test Request Cancelled', `${request.testTypeName} request cancelled.`);
  },

  // Marks the request done with the recorded result.
  async complete(id: string, testId: string, staffId: number): Promise<void> {
    await updateOpenRequest(id, { status: 'Done', test_id: testId, assigned_to_staff_id: staffId });
  },
}, ['create', 'take', 'release', 'cancel', 'complete'], ['lab:', 'summary:']);

// ---------------------------------------------------------------------------
// Pharmacy orders (the pharmacy's queue)
// ---------------------------------------------------------------------------

type BillSummaryRow = { id: string; payment_status: string; total_amount: number } | null;

function pharmacyOrderFromRow(row: Row): PharmacyOrder {
  const { patients: patient, bills: bill, ...rest } = row as Row & { patients?: { first_name: string; last_name: string } | null; bills?: BillSummaryRow };
  const order = fromRow<PharmacyOrder>(rest);
  order.items = order.items ?? [];
  if (patient) order.patientName = `${patient.first_name} ${patient.last_name}`;
  if (bill) order.bill = { id: bill.id, status: bill.payment_status, amount: Number(bill.total_amount) };
  return order;
}

const PHARMACY_ORDER_COLUMNS = '*, patients(first_name, last_name), bills(id, payment_status, total_amount)';

export const pharmacyOrders = invalidatesOnWrite({
  // Orders waiting to be dispensed, oldest first.
  async listOpen(): Promise<PharmacyOrder[]> {
    return cached('pharmacy:open', DASHBOARD_TTL, async () => {
      const rows = check(await db().from('pharmacy_orders').select(PHARMACY_ORDER_COLUMNS).eq('status', 'Requested').order('created_at'));
      return (rows as Row[]).map(pharmacyOrderFromRow);
    });
  },

  // Dispensed in the last day, newest first, with their bills.
  async listRecentlyDispensed(): Promise<PharmacyOrder[]> {
    const since = new Date(Date.now() - 86400000).toISOString();
    const rows = check(await db().from('pharmacy_orders').select(PHARMACY_ORDER_COLUMNS)
      .eq('status', 'Dispensed').gte('dispensed_at', since).order('dispensed_at', { ascending: false }).limit(50));
    return (rows as Row[]).map(pharmacyOrderFromRow);
  },

  // One patient's orders (newest first), for the care notes they came from.
  async listForPatient(patientId: number): Promise<PharmacyOrder[]> {
    const rows = check(await db().from('pharmacy_orders').select('*, bills(id, payment_status, total_amount)')
      .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(100));
    return (rows as Row[]).map(pharmacyOrderFromRow);
  },

  async create(order: { patientId: number; careNoteId?: string; items: PharmacyOrderItem[]; notes?: string }): Promise<PharmacyOrder> {
    const row = check(await db().from('pharmacy_orders').insert(toRow(order)).select().single());
    await addAuditEntry('patient', order.patientId, 'Sent to Pharmacy', `Medicines sent to the pharmacy: ${order.items.map(i => i.medicationName).join(', ')}.`);
    return pharmacyOrderFromRow(row as Row);
  },

  // Dispenses an order: makes its pharmacy bill (Unpaid; taking the medicines out of stock)
  // and marks the order dispensed. Items with quantity 0 are left out of the bill.
  async dispense(order: PharmacyOrder, patientName: string, lines: Array<PharmacyOrderItem & { quantity: number; unitPrice: number }>): Promise<string> {
    const items: BillItem[] = lines.filter(l => l.quantity > 0).map((l, i) => ({
      id: `${order.id}-${i}`, description: l.medicationName, medicationId: l.medicationId,
      quantity: l.quantity, originalUnitPrice: l.unitPrice, unitPrice: l.unitPrice, total: l.quantity * l.unitPrice,
    }));
    if (items.length === 0) throw new Error('Enter a quantity for at least one medicine.');
    const dosages = lines.filter(l => l.dosage).map(l => `${l.medicationName} - ${l.dosage}`).join('; ');
    const fields: Omit<Bill, 'id' | 'createdAt' | 'auditLog'> = {
      patientId: order.patientId, patientName, billDate: toDMY(new Date()), billType: 'Pharmacy', items,
      totalAmount: items.reduce((sum, item) => sum + item.total, 0), paymentMethod: '', paymentStatus: 'Unpaid',
      notes: `Dispensed for pharmacy order${order.requestedByStaffName ? ` from ${order.requestedByStaffName}` : ''}.${dosages ? ` Dosages: ${dosages}` : ''}`,
    };
    const bill = billFromRow(check(await db().from('bills').insert(toRow(fields)).select().single()) as Row);
    const updated = check(await db().from('pharmacy_orders')
      .update({ status: 'Dispensed', bill_id: bill.id, items: lines.map(({ unitPrice: _price, ...item }) => item) })
      .eq('id', order.id).eq('status', 'Requested').select('id')) as Row[];
    if (updated.length === 0) {
      await db().from('bills').delete().eq('id', bill.id);
      throw new Error('This order has already been dispensed or cancelled.');
    }
    await addAuditEntry('bill', bill.id, 'Bill Created', 'Pharmacy bill created when the order was dispensed.');
    return bill.id;
  },

  async cancel(order: PharmacyOrder): Promise<void> {
    const rows = check(await db().from('pharmacy_orders').update({ status: 'Cancelled' }).eq('id', order.id).eq('status', 'Requested').select('id')) as Row[];
    if (rows.length === 0) throw new Error('This order is no longer waiting.');
    await addAuditEntry('patient', order.patientId, 'Pharmacy Order Cancelled', `Pharmacy order cancelled: ${order.items.map(i => i.medicationName).join(', ')}.`);
  },
}, ['create', 'dispense', 'cancel'], ['pharmacy:', 'summary:', 'dashboard:']);

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export type BillFields = Omit<Bill, 'id' | 'createdAt' | 'auditLog'>;

// A date range for list filters: yyyy-MM-dd, both ends inclusive, either may be left open.
export interface DateRange { from?: string; to?: string }

function billFromRow(row: Row): Bill {
  // billed_on is worked out by the database from bill_date (for date filters); never written.
  const { billed_on: _billedOn, ...rest } = row;
  const bill = fromRow<Bill>(rest);
  bill.items = bill.items ?? [];
  bill.totalAmount = Number(bill.totalAmount);
  bill.auditLog = [];
  return bill;
}

const BILL_LIST_COLUMNS = 'id, patient_id, patient_name, bill_date, bill_type, total_amount, payment_method, payment_status, '
  + 'payment_date, notes, processed_by_staff_id, processed_by_staff_name, created_at';

export const bills = invalidatesOnWrite({
  // brief: only what a list row shows (no items or attachments), for the Billing list.
  async list(filter?: { patientId?: number; status?: string; method?: string; processedBy?: number; brief?: boolean } & DateRange): Promise<Bill[]> {
    let query = db().from('bills').select(filter?.brief ? BILL_LIST_COLUMNS : '*');
    if (filter?.patientId !== undefined) query = query.eq('patient_id', filter.patientId);
    if (filter?.status) query = query.eq('payment_status', filter.status);
    if (filter?.method) query = query.eq('payment_method', filter.method);
    if (filter?.processedBy !== undefined) query = query.eq('processed_by_staff_id', filter.processedBy);
    if (filter?.from) query = query.gte('billed_on', filter.from);
    if (filter?.to) query = query.lte('billed_on', filter.to);
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

  // An unpaid bill for one test at the given price, linked to the test so it isn't billed twice.
  async createForTest(patient: Pick<Patient, 'id' | 'firstName' | 'lastName'>, test: Pick<TestEntry, 'id' | 'testTypeName' | 'datePerformed'>, price: number): Promise<Bill> {
    const fields: BillFields = {
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      billDate: toDMY(new Date()),
      billType: 'Treatment',
      items: [{ id: `${test.id}-1`, description: test.testTypeName, quantity: 1, originalUnitPrice: price, unitPrice: price, total: price }],
      totalAmount: price,
      paymentMethod: '',
      paymentStatus: 'Unpaid',
      notes: `Bill for test: ${test.testTypeName} performed on ${test.datePerformed}`,
    };
    const bill = billFromRow(check(await db().from('bills').insert(toRow(fields)).select().single()) as Row);
    await addAuditEntry('bill', bill.id, 'Bill Created', 'Treatment bill created for test.');
    check(await db().from('patient_tests').update({ bill_id: bill.id }).eq('id', test.id));
    return bill;
  },
}, ['create', 'update', 'remove', 'createForTest'], ['summary:', 'lab:']);

// ---------------------------------------------------------------------------
// Payments (clinic expenses)
// ---------------------------------------------------------------------------

export type PaymentFields = Omit<Payment, 'id' | 'createdAt' | 'auditLog'>;

function paymentFromRow(row: Row): Payment {
  // paid_on is worked out by the database from payment_date (for date filters); never written.
  const { paid_on: _paidOn, ...rest } = row;
  const payment = fromRow<Payment>(rest);
  payment.amount = Number(payment.amount);
  payment.associatedPatientIds = (payment.associatedPatientIds ?? []).map(Number);
  payment.purchasedMedications = payment.purchasedMedications ?? [];
  payment.purchasedMaterials = payment.purchasedMaterials ?? [];
  payment.auditLog = [];
  return payment;
}

export const payments = invalidatesOnWrite({
  // Newest first. With a range, only payments dated within it (by their payment date).
  async list(filter?: DateRange & { method?: string; type?: string; recordedBy?: number }): Promise<Payment[]> {
    let query = db().from('payments').select('*');
    if (filter?.from) query = query.gte('paid_on', filter.from);
    if (filter?.to) query = query.lte('paid_on', filter.to);
    if (filter?.method) query = query.eq('payment_method', filter.method);
    if (filter?.type) query = query.eq('payment_type', filter.type);
    if (filter?.recordedBy !== undefined) query = query.eq('recorded_by_staff_id', filter.recordedBy);
    const rows = check(await query.order('paid_on', { ascending: false }).order('created_at', { ascending: false }));
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
}, ['create', 'update', 'remove'], ['summary:']);
