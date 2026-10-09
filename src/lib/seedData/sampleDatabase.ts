// Sample data for trying Seva out: about six months of a small hospital's activity
// (patients, notes, tests, bills, payments, fees, catalogs and the duty roster) so every screen
// and chart has something to show. Every sample record is marked so it can be
// removed again with removeSampleDataFromDatabase().

import {
  bills, countRows, departments, inventory, materials, medications, patients, payments, pharmacyOrders, referringDoctors, testCatalog, testRequests, vendors,
} from '@/lib/data';
import { maskAadhaarNumber, isAadhaarCard } from '@/lib/aadhaar';
import { SHIFT_PRESETS, dateKey, shiftWindow, weekStartOf } from '@/lib/duty';
import { billedProcedures, referralLines, referralTotal } from '@/lib/referralFee';
import type { Bill, BillItem, PaymentMethod, PaymentStatus } from '@/types/billing';
import type { CareNote, PatientCondition, PatientAdmissionCondition, TestEntry, TestFieldData } from '@/types/patient';
import type { MedicalTestCatalogItem } from '@/types/medicalTestCatalogItem';
import type { Payment } from '@/types/payment';
import type { ShiftType, StaffShift } from '@/types/duty';
import { SEED_PATIENTS } from './patients';
import { SEED_MEDICATIONS } from './medications';
import { SEED_REFERRING_DOCTORS } from './referringDoctors';

// Markers that identify sample records for removal.
export const SAMPLE_MARK = 'Sample data';
const SAMPLE_CONSENT_VERSION = 'sample-data';
const SAMPLE_PAYMENT_PREFIX = 'SAMPLE-';
const MEDICATION_MARK = `(${SAMPLE_MARK.toLowerCase()})`;

const DAY = 24 * 60 * 60 * 1000;

export interface SampleDataSummary {
  staff: number;
  departments: number;
  doctorFeePayments: number;
  referralFeePayments: number;
  shifts: number;
  attendance: number;
  referringDoctors: number;
  medications: number;
  materials: number;
  vendors: number;
  testCatalog: number;
  patients: number;
  careNotes: number;
  tests: number;
  testRequests: number;
  bills: number;
  payments: number;
}

interface SampleStaff { id: number; name: string; role: string }

// Small deterministic random generator, so every load produces the same data set.
function createRandom(seed: number) {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
  };
}

const dmy = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
// What the pharmacy pays its supplier: 70% of the price it charges patients.
const purchaseCost = (listPrice: number) => Math.round(listPrice * 70) / 100;
const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const daysAgo = (days: number, hour = 10) => {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const FIRST_NAMES_F = ['Ananya', 'Priya', 'Lakshmi', 'Fatima', 'Deepa', 'Kavitha', 'Sneha', 'Rekha'];
const FIRST_NAMES_M = ['Arun', 'Vikram', 'Imran', 'Suresh', 'Rahul', 'Gopal', 'Naveen', 'Joseph'];
const LAST_NAMES = ['Sharma', 'Reddy', 'Nair', 'Khan', 'Patel', 'Iyer', 'Gupta', 'Menon', 'Das', 'Rao', 'Pillai', 'Singh'];
const CITIES = ['Hyderabad', 'Bengaluru', 'Chennai', 'Vijayawada', 'Visakhapatnam', 'Warangal'];
const REASONS = ['Chest pain on exertion', 'Palpitations', 'Breathlessness', 'Hypertension review', 'Post-angioplasty follow-up', 'Routine cardiac check', 'Dizziness', 'Diabetes with cardiac risk'];
const NOTE_TEXTS = [
  'BP reviewed and medication adjusted. Advised low-salt diet and daily walks.',
  'Patient reports better exercise tolerance. Continue current treatment.',
  'Mild ankle swelling noted. Diuretic dose reviewed; recheck in two weeks.',
  'ECG stable. Counselled on smoking cessation.',
  'Lipid profile reviewed. Statin dose increased.',
  'Discussed results with family. Plan for follow-up echo next month.',
];
const ID_TYPES = ['Aadhar Card', 'PAN Card', "Driver's License", 'Voter ID'];
const CONDITIONS: PatientCondition[] = ['Critical', 'Medium', 'Medium', 'Low', 'Low', 'Discharged', 'Unassigned'];
const ADMISSION_CONDITIONS: PatientAdmissionCondition[] = ['Stable', 'Stable', 'Guarded', 'Serious', 'Critical'];
const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'UPI', 'UPI', 'Online/Card', 'Insurance', 'Arogyasree'];

const SAMPLE_DEPARTMENTS: Array<[string, number]> = [
  ['Cardiology', 1500],
  ['General Medicine', 800],
  ['Orthopaedics', 2000],
];
const SAMPLE_MATERIALS = [
  { name: 'ECG Electrodes (pack of 50)', category: 'Consumables', unitOfMeasure: 'pack', listPrice: 450 },
  { name: 'Disposable Syringes 5ml (box of 100)', category: 'Consumables', unitOfMeasure: 'box', listPrice: 650 },
  { name: 'IV Cannula 20G', category: 'Consumables', unitOfMeasure: 'each', listPrice: 35 },
  { name: 'Ultrasound Gel 5L', category: 'Diagnostics', unitOfMeasure: 'can', listPrice: 900 },
  { name: 'Nitrile Gloves (box of 100)', category: 'Protective', unitOfMeasure: 'box', listPrice: 550 },
  { name: 'ECG Paper Roll', category: 'Diagnostics', unitOfMeasure: 'roll', listPrice: 120 },
];
const SAMPLE_VENDORS = [
  { name: 'MedSupply India Pvt Ltd', contactPerson: 'Ravi Kumar', phoneNumber: '9811100001', email: 'orders@medsupply.example', address: 'Ameerpet, Hyderabad' },
  { name: 'Apollo Pharmacy Wholesale', contactPerson: 'Sunil Varma', phoneNumber: '9811100002', email: 'wholesale@apollo.example', address: 'Begumpet, Hyderabad' },
  { name: 'CardioTech Equipment', contactPerson: 'Neha Shah', phoneNumber: '9811100003', email: 'sales@cardiotech.example', address: 'Whitefield, Bengaluru' },
  { name: 'City Surgicals', contactPerson: 'Abdul Rahman', phoneNumber: '9811100004', email: 'citysurgicals@example.com', address: 'Koti, Hyderabad' },
];
// Names matching the built-in test forms (ECG, Blood Panel, X-Ray) get their result fields.
// Tests without fields use the built-in result template for their name (ECG, X-Ray).
const SAMPLE_TESTS: Array<Omit<MedicalTestCatalogItem, 'id' | 'description'>> = [
  { name: 'ECG', category: 'Cardiology', defaultPrice: 300 },
  { name: 'Blood Panel', category: 'Blood Work', defaultPrice: 650, fields: [
    { id: 'hemoglobin', label: 'Hemoglobin', type: 'number', unit: 'g/dL', low: 12, high: 17, required: true },
    { id: 'wbc_count', label: 'WBC Count', type: 'number', unit: 'x10^9/L', low: 4, high: 11 },
    { id: 'platelets', label: 'Platelets', type: 'number', unit: 'x10^9/L', low: 150, high: 400 },
    { id: 'rbc_count', label: 'RBC Count', type: 'number', unit: 'x10^12/L', low: 4.2, high: 5.9 },
  ] },
  { name: 'X-Ray', category: 'Imaging', defaultPrice: 500 },
  { name: '2D Echo', category: 'Cardiology', defaultPrice: 1800, fields: [
    { id: 'ejection_fraction', label: 'Ejection Fraction', type: 'number', unit: '%', low: 55, high: 70, required: true },
    { id: 'valves', label: 'Valves', type: 'choice', options: ['Normal', 'Mild regurgitation', 'Moderate regurgitation', 'Severe regurgitation'] },
    { id: 'impression', label: 'Impression', type: 'textarea' },
  ] },
  { name: 'TMT (Treadmill Test)', category: 'Cardiology', defaultPrice: 2200, fields: [
    { id: 'result', label: 'Result', type: 'choice', options: ['Negative', 'Positive', 'Inconclusive'], required: true },
    { id: 'max_heart_rate', label: 'Max Heart Rate', type: 'number', unit: 'bpm' },
    { id: 'duration_min', label: 'Exercise Duration', type: 'number', unit: 'min' },
  ] },
  { name: 'Lipid Profile', category: 'Blood Work', defaultPrice: 550, fields: [
    { id: 'total_cholesterol', label: 'Total Cholesterol', type: 'number', unit: 'mg/dL', high: 200, required: true },
    { id: 'ldl', label: 'LDL', type: 'number', unit: 'mg/dL', high: 100 },
    { id: 'hdl', label: 'HDL', type: 'number', unit: 'mg/dL', low: 40 },
    { id: 'triglycerides', label: 'Triglycerides', type: 'number', unit: 'mg/dL', high: 150 },
  ] },
];

async function sampleStaffApi(method: 'POST' | 'DELETE'): Promise<SampleStaff[]> {
  const response = await fetch('/api/sample-data', { method });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((result as { error?: string }).error ?? 'Could not update sample staff.');
  return (result as { staff?: SampleStaff[] }).staff ?? [];
}

// Records created here carry a past timestamp; the data layer passes extra fields through.
type WithCreatedAt<T> = T & { createdAt?: string };

/**
 * Loads the sample data. Only for a database with no patients yet, so it can
 * never mix demo records into real ones.
 */
export async function loadSampleDataIntoDatabase(
  currentStaff: { id: number; name: string },
  onProgress?: (message: string) => void,
): Promise<SampleDataSummary> {
  if (await countRows('patients') > 0) {
    throw new Error('The database already has patients. Sample data can only be loaded into an empty database.');
  }
  const random = createRandom(20261007);
  const summary: SampleDataSummary = {
    staff: 0, departments: 0, doctorFeePayments: 0, referralFeePayments: 0, shifts: 0, attendance: 0, referringDoctors: 0, medications: 0, materials: 0, vendors: 0, testCatalog: 0,
    patients: 0, careNotes: 0, tests: 0, testRequests: 0, bills: 0, payments: 0,
  };

  onProgress?.('Adding sample staff...');
  const staff = await sampleStaffApi('POST');
  summary.staff = staff.length;
  const doctors = staff.filter(s => s.role === 'Doctor');
  // Bills are processed at the front desk or by accounts, payments by accounts.
  const billingDesk = staff.filter(s => s.role === 'Receptionist' || s.role === 'Accounts');
  const accounts = staff.find(s => s.role === 'Accounts');
  const paymentProcessor = accounts ?? currentStaff;
  const nurses = staff.filter(s => s.role === 'Nurse');
  const labTechnician = staff.find(s => s.role === 'Lab Technician');

  // Departments, each with one sample doctor and nurse (in order).
  onProgress?.('Adding departments...');
  const sampleDepartments: Array<{ id: number; name: string; fee: number; doctor?: SampleStaff; nurse?: SampleStaff }> = [];
  for (const [index, [name, fee]] of SAMPLE_DEPARTMENTS.entries()) {
    const created = await departments.create({ name, description: SAMPLE_MARK, defaultDoctorFee: fee, active: true });
    const doctor = doctors[index];
    const nurse = nurses[index];
    await departments.setMembers(created.id, [doctor?.id, nurse?.id].filter((id): id is number => id !== undefined));
    sampleDepartments.push({ id: created.id, name, fee, doctor, nurse });
  }
  summary.departments = sampleDepartments.length;
  // Each patient goes to a department; its doctor and nurse are the care team.
  const careTeam = (visitDaysAgo: number) => {
    const department = random.pick(sampleDepartments);
    const team = [currentStaff.id, department.doctor?.id, department.nurse?.id].filter((id): id is number => id !== undefined);
    return {
      departmentId: department.id,
      attendingDoctorId: department.doctor?.id ?? null,
      attendingNurseId: department.nurse?.id ?? null,
      // Recent admissions may not have a fee agreed yet.
      doctorFee: department.doctor && visitDaysAgo > 3 ? department.fee : null,
      assignedStaffIds: team,
      doctorName: department.doctor?.name,
    };
  };

  onProgress?.('Adding catalogs...');
  // Some referring doctors are paid a fixed fee per patient, some a % of the procedures
  // billed, and one has no agreed fee yet.
  const referralTerms: Array<{ defaultReferralFee?: number; defaultReferralPercent?: number }> = [
    { defaultReferralFee: 500 }, { defaultReferralPercent: 10 }, { defaultReferralFee: 750 }, { defaultReferralPercent: 5 }, {},
  ];
  const createdDoctors = await referringDoctors.createMany(
    SEED_REFERRING_DOCTORS.map(({ id: _id, ...doctor }, i) => ({ ...doctor, ...referralTerms[i % referralTerms.length], notes: SAMPLE_MARK }) as typeof doctor),
  );
  summary.referringDoctors = createdDoctors.length;
  const createdMedications = await medications.createMany(
    SEED_MEDICATIONS.map(({ id: _id, ...medication }) => ({
      ...medication,
      additionalNotes: `${medication.additionalNotes ?? ''} ${MEDICATION_MARK}`.trim(),
      reorderLevel: 10,
    })),
  );
  summary.medications = createdMedications.length;
  const createdMaterials = await materials.createMany(SAMPLE_MATERIALS.map(m => ({ ...m, notes: SAMPLE_MARK, reorderLevel: 3 })));
  summary.materials = createdMaterials.length;
  const createdVendors = await vendors.createMany(SAMPLE_VENDORS.map(v => ({ ...v, notes: SAMPLE_MARK })));
  summary.vendors = createdVendors.length;
  const createdTests = await testCatalog.createMany(SAMPLE_TESTS.map(t => ({ ...t, fields: t.fields ?? [], description: SAMPLE_MARK })));
  summary.testCatalog = createdTests.length;

  // Stock on the shelves six months ago, so the Inventory page starts from real numbers.
  // The first two pharmacy items start short, so they show as needing a refill.
  const openingDate = ymd(daysAgo(185));
  await inventory.record([
    ...createdMedications.map((med, i) => ({
      kind: 'pharmacy' as const, itemId: med.id, reason: 'opening' as const, movedOn: openingDate, note: SAMPLE_MARK,
      quantity: i < 2 ? random.int(2, 4) : random.int(25, 45), unitCost: purchaseCost(med.listPrice),
    })),
    ...createdMaterials.map(material => ({
      kind: 'material' as const, itemId: material.id, reason: 'opening' as const, movedOn: openingDate, note: SAMPLE_MARK,
      quantity: random.int(4, 10), unitCost: material.listPrice ?? 0,
    })),
  ]);
  // Materials used on the wards each month, and one batch that expired.
  const usage = Array.from({ length: 6 }, (_, month) => {
    const material = random.pick(createdMaterials);
    return { kind: 'material' as const, itemId: material.id, reason: 'used' as const, quantity: -random.int(1, 3),
      movedOn: ymd(daysAgo(month * 30 + 20)), note: `Ward use · ${SAMPLE_MARK}` };
  });
  const expiring = createdMedications[createdMedications.length - 1];
  await inventory.record([...usage,
    { kind: 'pharmacy', itemId: expiring.id, reason: 'expired', quantity: -3, movedOn: ymd(daysAgo(40)), note: `Batch expired · ${SAMPLE_MARK}` }]);

  // The three detailed patients from the original seed, then generated ones.
  type PatientPlan = {
    fields: Parameters<typeof patients.create>[0];
    notes: Array<Omit<CareNote, 'id' | 'createdAt'> & { createdAt: string }>;
    tests: Array<Omit<TestEntry, 'id' | 'createdAt'> & { createdAt: string }>;
    visitDaysAgo: number;
  };
  const plans: PatientPlan[] = [];

  SEED_PATIENTS.forEach((seed, index) => {
    const { id: _id, careNotes = [], tests = [], auditLog: _auditLog, ...fields } = seed;
    const visitDaysAgo = 3 + index * 9;
    const { doctorName: _doctorName, ...team } = careTeam(visitDaysAgo);
    plans.push({
      visitDaysAgo,
      fields: {
        ...fields,
        idNumber: isAadhaarCard(fields.idCardType) ? maskAadhaarNumber(fields.idNumber) : fields.idNumber,
        idCardImages: [], patientPhotos: [], initialObservationAttachments: [],
        ...team,
        referredDoctorId: createdDoctors[index % createdDoctors.length]?.id ?? null,
        admissionDate: daysAgo(visitDaysAgo).toISOString(),
        consentGivenAt: daysAgo(visitDaysAgo).toISOString(),
        consentVersion: SAMPLE_CONSENT_VERSION,
        consentRecordedByStaffId: currentStaff.id,
      },
      // The original seed points at staff ids that don't exist here; credit the sample doctors instead.
      notes: careNotes.map(({ id: _n, createdAt: _c, attachments: _a, ...note }, i) => {
        const author = doctors.length ? doctors[i % doctors.length] : currentStaff;
        const medicationsMentioned = (note.medicationsMentioned ?? []).map(m => ({
          ...m, medicationId: createdMedications.find(c => c.name === m.medicationName)?.id ?? m.medicationId,
        }));
        return { ...note, medicationsMentioned, staffId: author.id, staffName: author.name, attachments: [], createdAt: daysAgo(visitDaysAgo - i - 1, 11).toISOString() };
      }),
      tests: tests.map(({ id: _t, createdAt: _c, attachments: _a, ...test }, i) => {
        const performer = doctors.length ? doctors[i % doctors.length] : currentStaff;
        const catalogTest = createdTests.find(t => t.name.toLowerCase() === test.testTypeName.toLowerCase());
        return {
          ...test, testTypeId: catalogTest?.id ?? test.testTypeId,
          performedByStaffId: performer.id, performedByStaffName: performer.name,
          attachments: [], datePerformed: dmy(daysAgo(visitDaysAgo - i)), createdAt: daysAgo(visitDaysAgo - i, 12).toISOString(),
        };
      }),
    });
  });

  for (let i = 0; i < 27; i++) {
    const female = i % 2 === 0;
    const firstName = random.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
    const lastName = random.pick(LAST_NAMES);
    const visitDaysAgo = random.int(1, 175);
    const idCardType = random.pick(ID_TYPES);
    const idNumber = isAadhaarCard(idCardType) ? maskAadhaarNumber(String(random.int(100000000000, 999999999999)))
      : `${String.fromCharCode(65 + random.int(0, 25))}${String.fromCharCode(65 + random.int(0, 25))}${random.int(1000000, 9999999)}`;
    const dob = new Date(random.int(1945, 1995), random.int(0, 11), random.int(1, 28));
    const { doctorName, ...team } = careTeam(visitDaysAgo);
    const doctorOnNote = team.attendingDoctorId && doctorName ? { id: team.attendingDoctorId, name: doctorName } : { id: currentStaff.id, name: currentStaff.name };
    plans.push({
      visitDaysAgo,
      fields: {
        firstName, lastName,
        gender: female ? 'Female' : 'Male',
        dateOfBirth: dmy(dob),
        mobileNumber: `9${random.int(100000000, 999999999)}`,
        emailAddress: `${firstName}.${lastName}@example.com`.toLowerCase(),
        address: `${random.int(1, 400)}, ${random.pick(['MG Road', 'Station Road', 'Main Street', 'Gandhi Nagar'])}, ${random.pick(CITIES)}`,
        idCardType, idNumber,
        emergencyContactName: `${random.pick(female ? FIRST_NAMES_M : FIRST_NAMES_F)} ${lastName}`,
        emergencyContactNumber: `9${random.int(100000000, 999999999)}`,
        idCardImages: [], patientPhotos: [], initialObservationAttachments: [],
        condition: random.pick(CONDITIONS),
        ...team,
        admissionDate: daysAgo(visitDaysAgo).toISOString(),
        referredDoctorId: random.next() < 0.6 && createdDoctors.length ? random.pick(createdDoctors).id : null,
        reasonForVisit: random.pick(REASONS),
        admissionCondition: random.pick(ADMISSION_CONDITIONS),
        initialObservationsText: 'Vitals recorded at admission. See care notes for the treatment plan.',
        consentGivenAt: daysAgo(visitDaysAgo).toISOString(),
        consentVersion: SAMPLE_CONSENT_VERSION,
        consentRecordedByStaffId: currentStaff.id,
      },
      notes: Array.from({ length: random.int(1, 3) }, (_, n) => {
        const med = createdMedications.length ? random.pick(createdMedications) : null;
        return {
          text: random.pick(NOTE_TEXTS),
          staffId: doctorOnNote.id, staffName: doctorOnNote.name,
          medicationsMentioned: med ? [{ medicationId: med.id, medicationName: med.name, dosage: random.pick(['1-0-1 after food', '0-0-1 at night', '1-0-0 before breakfast']) }] : [],
          attachments: [],
          createdAt: daysAgo(Math.max(0, visitDaysAgo - n * 7), 11).toISOString(),
        };
      }),
      tests: Array.from({ length: random.int(0, 2) }, (_, n) => {
        const test = random.pick(createdTests);
        const testData: TestFieldData = test.name === 'ECG'
          ? { rhythm: random.pick(['Sinus Rhythm', 'Sinus Tachycardia', 'Atrial Fibrillation']), rate_bpm: random.int(58, 112) }
          : test.name === 'Blood Panel' ? { hemoglobin: random.int(105, 160) / 10, platelets: random.int(150, 400) } : {};
        return {
          testTypeId: test.id, testTypeName: test.name,
          datePerformed: dmy(daysAgo(Math.max(0, visitDaysAgo - n))),
          testData,
          overallResults: random.pick(['Within normal limits', 'Mild abnormality, review in 4 weeks', 'Abnormal, discussed with patient']),
          performedByStaffId: doctorOnNote.id, performedByStaffName: doctorOnNote.name,
          attachments: [],
          createdAt: daysAgo(Math.max(0, visitDaysAgo - n), 12).toISOString(),
        };
      }),
    });
  }

  const billPlans: Array<WithCreatedAt<Omit<Bill, 'id' | 'createdAt' | 'auditLog'>>> = [];
  const createdCases: Array<{ id: number; doctorId?: number | null; fee?: number | null; referredDoctorId?: number | null; visitDaysAgo: number }> = [];
  for (const [index, plan] of plans.entries()) {
    onProgress?.(`Adding patient ${index + 1} of ${plans.length}...`);
    const created = await patients.create(plan.fields, { actionType: 'Patient Registered', details: 'Sample patient loaded for testing.' });
    summary.patients++;
    createdCases.push({ id: created.id, doctorId: plan.fields.attendingDoctorId, fee: plan.fields.doctorFee, referredDoctorId: plan.fields.referredDoctorId, visitDaysAgo: plan.visitDaysAgo });
    for (const note of plan.notes) {
      await patients.addCareNote(created.id, note as WithCreatedAt<typeof note>);
      summary.careNotes++;
    }
    for (const test of plan.tests) {
      await patients.addTest(created.id, test as WithCreatedAt<typeof test>);
      summary.tests++;
    }

    // One to three bills per patient, spread after the visit.
    for (let b = 0; b < random.int(2, 4); b++) {
      const when = daysAgo(Math.max(0, plan.visitDaysAgo - b * random.int(3, 20)), 15);
      const pharmacy = random.next() < 0.45;
      const items: BillItem[] = pharmacy
        ? Array.from({ length: random.int(1, 3) }, (_, k) => {
            const med = random.pick(createdMedications);
            const quantity = random.int(1, 3);
            return { id: `item-${k}`, description: med.name, quantity, unitPrice: med.listPrice, originalUnitPrice: med.listPrice, total: med.listPrice * quantity };
          })
        : [
            { id: 'item-0', description: 'Consultation', quantity: 1, unitPrice: 800, originalUnitPrice: 800, total: 800 },
            ...(random.next() < 0.6 ? [(() => {
              const test = random.pick(createdTests);
              const price = test.defaultPrice ?? 0;
              return { id: 'item-1', description: test.name, quantity: 1, unitPrice: price, originalUnitPrice: price, total: price };
            })()] : []),
            ...(random.next() < 0.45 ? [(() => {
              const [description, price] = random.pick([['Coronary Angiography', 18000], ['Holter Monitoring (24h)', 3500], ['Day-care Observation', 5000]] as const);
              return { id: 'item-2', description, quantity: 1, unitPrice: price, originalUnitPrice: price, total: price };
            })()] : []),
          ];
      const status: PaymentStatus = when.getTime() > Date.now() - 10 * DAY
        ? random.pick<PaymentStatus>(['Unpaid', 'Paid', 'Partially Paid'])
        : random.pick<PaymentStatus>(['Paid', 'Paid', 'Paid', 'Partially Paid']);
      const processor = billingDesk.length ? random.pick(billingDesk) : currentStaff;
      billPlans.push({
        processedByStaffId: processor.id,
        patientId: created.id,
        patientName: `${plan.fields.firstName} ${plan.fields.lastName}`,
        billDate: dmy(when),
        billType: pharmacy ? 'Pharmacy' : 'Treatment',
        items,
        totalAmount: items.reduce((sum, item) => sum + item.total, 0),
        paymentMethod: status === 'Unpaid' ? '' : random.pick(PAYMENT_METHODS),
        paymentStatus: status,
        paymentDate: status === 'Paid' ? dmy(when) : undefined,
        notes: SAMPLE_MARK,
        attachments: [],
        createdAt: when.toISOString(),
      });
    }
  }

  // A few tests waiting for the lab: two in the queue (one urgent), one assigned to the
  // sample technician and one they have started.
  onProgress?.('Adding lab requests...');
  const inCare = createdCases.filter((_, i) => plans[i].fields.condition !== 'Discharged').slice(-4);
  for (const [i, patientCase] of inCare.entries()) {
    const test = createdTests[i % createdTests.length];
    const request = await testRequests.create({
      patientId: patientCase.id, testTypeId: test.id, testTypeName: test.name,
      priority: i === 0 ? 'Urgent' : 'Routine',
      notes: i === 0 ? 'Chest pain since morning, please do first.' : undefined,
      assignedToStaffId: i >= 2 ? labTechnician?.id : undefined,
    });
    if (i === 3 && labTechnician) await testRequests.take(request.id, labTechnician.id);
    summary.testRequests++;
  }

  // Two prescriptions waiting at the pharmacy.
  for (const patientCase of inCare.slice(0, 2)) {
    const meds = [random.pick(createdMedications), random.pick(createdMedications)].filter((m, i, all) => all.indexOf(m) === i);
    await pharmacyOrders.create({
      patientId: patientCase.id,
      items: meds.map(m => ({ medicationId: m.id, medicationName: m.name, dosage: random.pick(['1-0-1 after food for 5 days', '0-0-1 at night for 10 days']) })),
    });
  }

  onProgress?.('Adding bills...');
  billPlans.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  for (const bill of billPlans) {
    await bills.create(bill, 'Sample bill loaded for testing.');
    summary.bills++;
  }

  onProgress?.('Adding payments...');
  const paymentPlans: Array<WithCreatedAt<Omit<Payment, 'id' | 'createdAt' | 'auditLog'>>> = [];
  let paymentNumber = 1;
  const addPayment = (daysBack: number, fields: Omit<Payment, 'id' | 'createdAt' | 'auditLog' | 'recordedByStaffId' | 'recordedByStaffName' | 'transactionId'>) => {
    const when = daysAgo(daysBack, 17);
    paymentPlans.push({
      ...fields,
      paymentDate: dmy(when),
      transactionId: `${SAMPLE_PAYMENT_PREFIX}${String(paymentNumber++).padStart(3, '0')}`,
      recordedByStaffId: paymentProcessor.id,
      recordedByStaffName: paymentProcessor.name,
      notes: SAMPLE_MARK,
      createdAt: when.toISOString(),
    });
  };
  for (let month = 5; month >= 0; month--) {
    const monthDays = month * 30 + 2;
    // Doctors are visiting consultants (paid from consultation fees), so only other staff draw a salary.
    for (const member of staff.filter(s => s.role !== 'Doctor')) {
      addPayment(monthDays, {
        paymentDate: '', paymentType: 'Salary', payeeId: member.id, payeeName: member.name, payeeType: 'StaffMember',
        description: `Monthly salary – ${member.name}`, amount: ({ Nurse: 15000, Receptionist: 10000, Accounts: 12000, 'Lab Technician': 14000, Pharmacist: 16000 } as Record<string, number>)[member.role] ?? 10000,
        paymentMethod: 'Bank Transfer',
      });
    }
    const vendor = random.pick(createdVendors);
    const material = random.pick(createdMaterials);
    const quantity = random.int(2, 10);
    addPayment(monthDays + 10, {
      paymentDate: '', paymentType: 'Material', payeeId: vendor.id, payeeName: vendor.name, payeeType: 'Vendor',
      description: `Monthly consumables order`, amount: (material.listPrice ?? 0) * quantity, paymentMethod: 'UPI',
      purchasedMaterials: [{ materialId: material.id, materialName: material.name, quantityPurchased: quantity, unitPriceAtPurchase: material.listPrice, listPriceSnapshot: material.listPrice }],
    });
    const med = random.pick(createdMedications);
    const medQuantity = random.int(10, 40);
    addPayment(monthDays + 15, {
      paymentDate: '', paymentType: 'Pharmacy', payeeId: vendor.id, payeeName: vendor.name, payeeType: 'Vendor',
      description: 'Pharmacy stock purchase', amount: purchaseCost(med.listPrice) * medQuantity, paymentMethod: 'Bank Transfer',
      purchasedMedications: [{ medicationId: med.id, medicationName: med.name, quantityPurchased: medQuantity, unitPriceAtPurchase: purchaseCost(med.listPrice), listPriceSnapshot: med.listPrice }],
    });
    addPayment(monthDays + 5, {
      paymentDate: '', paymentType: 'Other', payeeName: 'Electricity Board', payeeType: 'Other',
      description: 'Electricity bill', amount: random.int(4000, 7000), paymentMethod: 'UPI',
    });
  }
  for (const payment of paymentPlans.filter(p => Date.parse(p.createdAt ?? '') <= Date.now())) {
    await payments.create(payment, 'Sample payment loaded for testing.');
    summary.payments++;
  }

  // Doctor fees for cases older than a month have been paid, one payment per doctor;
  // newer cases stay pending so Payments → Doctor Fee has something to settle.
  onProgress?.('Adding doctor fee payments...');
  for (const doctor of doctors) {
    const paidCases = createdCases.filter(c => c.doctorId === doctor.id && c.fee != null && c.visitDaysAgo > 30);
    if (paidCases.length === 0) continue;
    const when = daysAgo(20, 16);
    const payment = await payments.create({
      paymentDate: dmy(when), paymentType: 'Doctor Fee', payeeId: doctor.id, payeeName: doctor.name, payeeType: 'StaffMember',
      associatedPatientIds: paidCases.map(c => c.id),
      description: `Doctor fee for ${paidCases.length} cases`,
      amount: paidCases.reduce((sum, c) => sum + (c.fee ?? 0), 0),
      paymentMethod: 'Bank Transfer',
      transactionId: `${SAMPLE_PAYMENT_PREFIX}${String(paymentNumber++).padStart(3, '0')}`,
      recordedByStaffId: paymentProcessor.id, recordedByStaffName: paymentProcessor.name,
      notes: SAMPLE_MARK,
      createdAt: when.toISOString(),
    } as WithCreatedAt<Omit<Payment, 'id' | 'createdAt' | 'auditLog'>>, 'Sample doctor fee payment loaded for testing.');
    await patients.setDoctorFeePayment(paidCases.map(c => c.id), payment.id);
    summary.payments++;
    summary.doctorFeePayments++;
  }

  // Referral fees: worked out from each referring doctor's terms (a % of what was billed,
  // pharmacy excluded, or their fixed fee). Referrals older than a month have been paid,
  // one payment per doctor; newer ones are pending for Payments → Referral/CC.
  onProgress?.('Adding referral fees...');
  const referralFees = new Map<number, number>();
  for (const c of createdCases) {
    const doctor = createdDoctors.find(d => d.id === c.referredDoctorId);
    if (!doctor) continue;
    if (doctor.defaultReferralPercent != null) {
      const percent = String(doctor.defaultReferralPercent);
      const procedures = billedProcedures(billPlans.filter(b => b.patientId === c.id) as Bill[]);
      const lines = referralLines(procedures, Object.fromEntries(procedures.map(p => [p.key, p.billType === 'Pharmacy' ? '0' : percent])));
      const fee = referralTotal(lines);
      await patients.update(c.id, { referralFee: fee, referralFeeBasis: { mode: 'percent', lines } },
        { actionType: 'Care Team Updated', details: `Referral fee: ₹${fee.toFixed(2)} (${percent}% of procedures billed).` });
      referralFees.set(c.id, fee);
    } else if (doctor.defaultReferralFee != null) {
      referralFees.set(c.id, doctor.defaultReferralFee);
    }
  }
  for (const doctor of createdDoctors) {
    const paid = createdCases.filter(c => c.referredDoctorId === doctor.id && c.visitDaysAgo > 30 && referralFees.has(c.id));
    if (paid.length === 0) continue;
    const when = daysAgo(15, 16);
    const amount = paid.reduce((sum, c) => sum + (referralFees.get(c.id) ?? 0), 0);
    const payment = await payments.create({
      paymentDate: dmy(when), paymentType: 'Referral/CC', payeeId: doctor.id, payeeName: doctor.name, payeeType: 'ReferringDoctor',
      associatedPatientIds: paid.map(c => c.id),
      description: `Referral fees for ${paid.length} patient${paid.length > 1 ? 's' : ''}`,
      amount: Math.round(amount * 100) / 100,
      paymentMethod: 'Bank Transfer',
      transactionId: `${SAMPLE_PAYMENT_PREFIX}${String(paymentNumber++).padStart(3, '0')}`,
      recordedByStaffId: paymentProcessor.id, recordedByStaffName: paymentProcessor.name,
      notes: SAMPLE_MARK,
      createdAt: when.toISOString(),
    } as WithCreatedAt<Omit<Payment, 'id' | 'createdAt' | 'auditLog'>>, 'Sample referral fee payment loaded for testing.');
    await patients.setReferralFeePayment(paid.map(c => ({ patientId: c.id, fee: referralFees.get(c.id) ?? null })), payment.id);
    summary.payments++;
    summary.referralFeePayments++;
  }

  onProgress?.('Adding the duty roster and attendance...');
  const duty = buildSampleDuty(staff, sampleDepartments, currentStaff.id, random);
  const response = await fetch('/api/sample-data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(duty),
  });
  const dutyResult = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((dutyResult as { error?: string }).error ?? 'Could not add the duty roster.');
  summary.shifts = duty.shifts.length;
  summary.attendance = duty.attendance.length;

  // A stock count today, as a pharmacy would do: one item has run out, one is low, and
  // anything sold beyond the recorded stock is counted back to a sensible level.
  onProgress?.('Counting stock...');
  const stock = (await inventory.summary()).filter(i => createdMedications.some(m => m.id === i.id));
  const target = (index: number, onHand: number) => (index === 0 ? 0 : index === 1 ? 4 : onHand < 0 ? 15 : onHand);
  await inventory.record(createdMedications.flatMap((med, index) => {
    const item = stock.find(i => i.id === med.id);
    const change = item ? target(index, item.onHand) - item.onHand : 0;
    return item && change !== 0
      ? [{ kind: 'pharmacy' as const, itemId: med.id, reason: 'adjustment' as const, quantity: change,
          movedOn: ymd(new Date()), note: `Stock count · ${SAMPLE_MARK}` }]
      : [];
  }));

  return summary;
}

type Random = ReturnType<typeof createRandom>;

// Three weeks of past shifts with clock-ins, and two weeks planned ahead:
// doctors work weekdays with a Saturday on-call rota, nurses rotate between morning,
// evening and night weeks, and front-desk and accounts staff work days. Most people
// clock in on time; a few are late, leave early or miss a shift.
function buildSampleDuty(
  staff: SampleStaff[],
  sampleDepartments: Array<{ id: number; doctor?: SampleStaff; nurse?: SampleStaff }>,
  recordedById: number,
  random: Random,
) {
  const departmentOf = (id: number) => sampleDepartments.find(d => d.doctor?.id === id || d.nurse?.id === id)?.id ?? null;
  const start = weekStartOf(new Date(Date.now() - 21 * DAY));
  const shiftRows: Array<Omit<StaffShift, 'id'>> = [];
  const doctors = staff.filter(s => s.role === 'Doctor');
  const nurses = staff.filter(s => s.role === 'Nurse');
  const NURSE_ROTATION: ShiftType[] = ['Morning', 'Evening', 'Night'];

  for (let dayIndex = 0; dayIndex < 35; dayIndex++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayIndex);
    const week = Math.floor(dayIndex / 7);
    const weekday = dayIndex % 7; // 0 = Monday
    const add = (person: SampleStaff, shiftType: ShiftType, notes?: string) => shiftRows.push({
      staffId: person.id, shiftDate: dateKey(day), shiftType,
      startTime: SHIFT_PRESETS[shiftType].start, endTime: SHIFT_PRESETS[shiftType].end,
      departmentId: departmentOf(person.id), notes,
    });
    doctors.forEach((doctor, i) => {
      if (weekday < 5) add(doctor, 'Day');
      else if (weekday === 5 && (week + i) % doctors.length === 0) add(doctor, 'On Call', 'Weekend on-call cover');
    });
    nurses.forEach((nurse, i) => {
      if (weekday === (i * 2 + week) % 7) return; // one day off a week, varying
      add(nurse, NURSE_ROTATION[(i + week) % NURSE_ROTATION.length]);
    });
    for (const person of staff.filter(s => s.role === 'Receptionist')) if (weekday < 6) add(person, 'Morning');
    for (const person of staff.filter(s => s.role === 'Accounts')) if (weekday < 5) add(person, 'Day');
    for (const person of staff.filter(s => s.role === 'Lab Technician' || s.role === 'Pharmacist')) if (weekday < 6) add(person, 'Day');
  }

  const now = new Date();
  const minutes = (n: number) => n * 60 * 1000;
  const attendance: Array<Record<string, unknown>> = [];
  const open = new Set<number>();
  const lastOut = new Map<number, number>();
  shiftRows.sort((a, b) => shiftWindow(a).start.getTime() - shiftWindow(b).start.getTime());
  for (const shift of shiftRows) {
    const { start: from, end: to } = shiftWindow(shift);
    if (from > now) continue;
    const roll = random.next();
    if (roll < 0.04 && to <= now) continue; // absent
    const lateBy = roll < 0.12 ? random.int(15, 45) : random.int(-12, 6);
    // Never before the same person's previous clock-out (night shift into a morning week).
    const clockIn = new Date(Math.max(from.getTime() + minutes(lateBy), (lastOut.get(shift.staffId) ?? 0) + minutes(1)));
    if (clockIn > now) continue;
    let clockOut: Date | null = new Date(to.getTime() + minutes(roll > 0.95 ? -random.int(30, 60) : random.int(-4, 20)));
    if (clockOut > now) {
      if (open.has(shift.staffId)) continue;
      clockOut = null; // still on duty
      open.add(shift.staffId);
    }
    if (clockOut) lastOut.set(shift.staffId, clockOut.getTime());
    const forgot = clockOut && random.next() < 0.04;
    attendance.push({
      staff_id: shift.staffId,
      clock_in: clockIn.toISOString(),
      clock_out: clockOut?.toISOString() ?? null,
      source: forgot ? 'Manual' : 'Clock',
      notes: forgot ? 'Forgot to clock out; corrected by admin' : null,
      recorded_by_staff_id: forgot ? recordedById : null,
    });
  }
  // A doctor called in outside the roster.
  if (doctors[0]) {
    const callIn = new Date(start.getTime() + 6 * DAY + 2 * 60 * 60 * 1000);
    if (callIn < now) attendance.push({
      staff_id: doctors[0].id, clock_in: callIn.toISOString(), clock_out: new Date(callIn.getTime() + minutes(150)).toISOString(),
      source: 'Clock', notes: 'Called in for an emergency', recorded_by_staff_id: null,
    });
  }

  return {
    shifts: shiftRows.map(s => ({
      staff_id: s.staffId, shift_date: s.shiftDate, start_time: s.startTime, end_time: s.endTime,
      shift_type: s.shiftType, department_id: s.departmentId, notes: s.notes ?? null,
    })),
    attendance,
  };
}

/**
 * Removes everything loadSampleDataIntoDatabase() created, leaving records
 * entered by staff untouched. The audit trail of the removed records stays.
 */
export async function removeSampleDataFromDatabase(onProgress?: (message: string) => void): Promise<number> {
  let removed = 0;
  onProgress?.('Removing sample patients and bills...');
  const samplePatients = (await patients.listBasic()).filter(p => p.consentVersion === SAMPLE_CONSENT_VERSION);
  for (const patient of samplePatients) {
    for (const bill of await bills.list({ patientId: patient.id })) {
      await bills.remove(bill.id);
      removed++;
    }
    await patients.remove(patient.id); // care notes and tests go with it
    removed++;
  }

  onProgress?.('Removing sample payments and catalogs...');
  for (const payment of (await payments.list()).filter(p => p.transactionId?.startsWith(SAMPLE_PAYMENT_PREFIX))) {
    await payments.remove(payment.id);
    removed++;
  }
  const removeMarked = async <T extends { id: string | number }>(
    repo: { list(): Promise<T[]>; remove(id: T['id']): Promise<void> },
    isSample: (item: T) => boolean,
  ) => {
    for (const item of (await repo.list()).filter(isSample)) {
      await repo.remove(item.id);
      removed++;
    }
  };
  await removeMarked(referringDoctors, d => d.notes === SAMPLE_MARK);
  await removeMarked(medications, m => !!m.additionalNotes?.includes(MEDICATION_MARK));
  await removeMarked(materials, m => m.notes === SAMPLE_MARK);
  await removeMarked(vendors, v => v.notes === SAMPLE_MARK);
  await removeMarked(testCatalog, t => t.description === SAMPLE_MARK);
  await removeMarked(departments, d => d.description === SAMPLE_MARK);

  onProgress?.('Removing sample staff...');
  await sampleStaffApi('DELETE');
  return removed;
}
