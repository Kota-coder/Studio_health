import { SEED_PATIENTS } from './patients';
import { SEED_STAFF } from './staff';
import { SEED_MEDICATIONS } from './medications';
import { SEED_REFERRING_DOCTORS } from './referringDoctors';
import { SEED_BILLS } from './bills';
import { bills, countRows, medications, patients, referringDoctors } from '@/lib/data';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/;
const DMY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seed records are dated around Oct 2025. Shift every activity date (not birth
 * dates) forward so the newest record lands on today; otherwise the dashboards,
 * which show the last few months, look empty.
 */
function shiftSeedDates<T>(value: T, offsetMs: number): T {
  if (typeof value === 'string') {
    const iso = value.match(ISO_DATE);
    if (iso && Number(iso[1]) >= 2020) {
      const shifted = new Date(new Date(iso[4] ? value : `${value}T00:00:00.000Z`).getTime() + offsetMs);
      return (iso[4] ? shifted.toISOString() : shifted.toISOString().slice(0, 10)) as T;
    }
    const dmy = value.match(DMY_DATE);
    if (dmy && Number(dmy[3]) >= 2020) {
      const shifted = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) + offsetMs);
      const dd = String(shifted.getUTCDate()).padStart(2, '0');
      const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${shifted.getUTCFullYear()}` as T;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(v => shiftSeedDates(v, offsetMs)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, shiftSeedDates(v, offsetMs)])
    ) as T;
  }
  return value;
}

function seedDateOffsetMs(): number {
  const latest = SEED_BILLS.reduce((max, bill) => Math.max(max, Date.parse(bill.createdAt) || 0), 0);
  if (!latest) return 0;
  // Whole days only, so dd/MM/yyyy and ISO dates move together.
  return Math.max(0, Math.floor((Date.now() - latest) / DAY_MS)) * DAY_MS;
}

export interface SampleDataSummary {
  referringDoctors: number;
  medications: number;
  patients: number;
  careNotes: number;
  tests: number;
  bills: number;
}

/**
 * Loads the demo referring doctors, medications, patients (with notes and tests)
 * and bills into the database. Only for an empty database: it refuses to run once
 * any patient exists, so it can never mix demo records into real ones.
 *
 * Sample staff are not created (staff logins are invited by email), so demo
 * patients are assigned to the person loading the data. Sample image
 * placeholders are skipped.
 */
export async function loadSampleDataIntoDatabase(currentStaff: { id: number; name: string }): Promise<SampleDataSummary> {
  if (await countRows('patients') > 0) {
    throw new Error('The database already has patients. Sample data can only be loaded into an empty database.');
  }
  const offset = seedDateOffsetMs();
  const summary: SampleDataSummary = { referringDoctors: 0, medications: 0, patients: 0, careNotes: 0, tests: 0, bills: 0 };

  const createdDoctors = await referringDoctors.createMany(SEED_REFERRING_DOCTORS.map(({ id: _id, ...doctor }) => doctor));
  const doctorIdMap = new Map(SEED_REFERRING_DOCTORS.map((doctor, i) => [doctor.id, createdDoctors[i]?.id]));
  summary.referringDoctors = createdDoctors.length;

  summary.medications = (await medications.createMany(SEED_MEDICATIONS.map(({ id: _id, ...medication }) => medication))).length;

  const patientIdMap = new Map<number, number>();
  for (const seed of shiftSeedDates(SEED_PATIENTS, offset)) {
    const { id: seedId, careNotes = [], tests = [], auditLog: _auditLog, ...fields } = seed;
    const created = await patients.create({
      ...fields,
      idCardImages: [],
      patientPhotos: [],
      initialObservationAttachments: [],
      assignedStaffIds: [currentStaff.id],
      referredDoctorId: fields.referredDoctorId ? doctorIdMap.get(fields.referredDoctorId) ?? null : null,
      consentGivenAt: new Date().toISOString(),
      consentVersion: 'sample-data',
      consentRecordedByStaffId: currentStaff.id,
    }, { actionType: 'Patient Registered', details: 'Sample patient loaded for testing.' });
    patientIdMap.set(seedId, created.id);
    summary.patients++;

    for (const { id: _noteId, createdAt: _noteCreated, ...note } of careNotes) {
      await patients.addCareNote(created.id, { ...note, staffId: currentStaff.id, staffName: currentStaff.name, attachments: [] });
      summary.careNotes++;
    }
    for (const { id: _testId, createdAt: _testCreated, ...test } of tests) {
      await patients.addTest(created.id, { ...test, performedByStaffId: currentStaff.id, performedByStaffName: currentStaff.name, attachments: [] });
      summary.tests++;
    }
  }

  for (const seed of shiftSeedDates(SEED_BILLS, offset)) {
    const { id: _id, createdAt: _createdAt, auditLog: _auditLog, ...fields } = seed;
    const patientId = patientIdMap.get(fields.patientId);
    if (!patientId) continue;
    await bills.create({ ...fields, patientId, attachments: [] }, 'Sample bill loaded for testing.');
    summary.bills++;
  }

  return summary;
}

// Export seed data for direct access if needed
export {
  SEED_PATIENTS,
  SEED_STAFF,
  SEED_MEDICATIONS,
  SEED_REFERRING_DOCTORS,
  SEED_BILLS
};
