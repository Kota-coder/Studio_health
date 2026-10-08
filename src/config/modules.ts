// Features a hospital can switch off (Setup → Hospital Profile → Menus and features).
// A switched-off feature disappears everywhere: its menu item, its pages (which show a short
// notice instead) and its parts of other screens (e.g. Billing off removes the bills card and
// "Bill Test" buttons on the patient page). Patients, Staff Management and Hospital Profile
// are always on. This is about what a hospital uses; who may open each section is still
// decided by role (src/config/permissions.ts) and by the database's security rules.

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  requires?: string[]; // also off when any of these is off
  requiresAny?: string[]; // also off when all of these are off
}

export const MODULES: ModuleDefinition[] = [
  { key: 'billing', label: 'Billing', description: 'Patient bills, "Bill Test" and "Bill Meds" on the patient page.' },
  { key: 'payments', label: 'Payments', description: 'Money paid out: salaries, supplies, doctor and referral fees.' },
  { key: 'doctorFees', label: 'Doctor Fees', description: "The attending doctor's fee per case, paid through Payments.", requires: ['departments', 'payments'] },
  { key: 'referringDoctors', label: 'Referrals', description: 'Referring doctors, and who referred each patient.' },
  { key: 'referralFees', label: 'Referral Fees', description: 'Fees paid to referring doctors, through Payments.', requires: ['referringDoctors', 'payments'] },
  { key: 'financialDashboard', label: 'Financial Dashboard', description: 'Totals and charts for money in and out.', requiresAny: ['billing', 'payments'] },
  { key: 'paymentMethods', label: 'Payment Methods', description: 'Managing the payment methods offered.', requiresAny: ['billing', 'payments'] },
  { key: 'duty', label: 'Duty Roster & Attendance', description: 'Shifts, clock-in and attendance reports.' },
  { key: 'departments', label: 'Departments', description: 'Departments and care teams (attending doctor and nurse).' },
  { key: 'patientCare', label: 'Care Note Templates', description: 'Structured templates for care notes.' },
  { key: 'medicalTests', label: 'Medical Tests', description: 'Managing the tests offered and their prices.' },
  { key: 'medications', label: 'Pharmacy', description: 'Medicines the pharmacy sells; "Add Medication" on care notes.' },
  { key: 'materials', label: 'Materials', description: 'Consumables and supplies.' },
  { key: 'inventory', label: 'Inventory', description: 'Stock on hand, its value, and what needs refilling.', requiresAny: ['medications', 'materials'] },
  { key: 'vendors', label: 'Vendors', description: 'Suppliers of medicines and materials.' },
  { key: 'sampleData', label: 'Sample Data', description: 'Loading demo data for trying the app out.' },
];

const BY_KEY = new Map(MODULES.map(m => [m.key, m]));

// Every feature that is off: the ones switched off plus the ones whose required features are off.
export function effectiveDisabled(disabled: string[] | null | undefined): Set<string> {
  const off = new Set(disabled ?? []);
  for (let changed = true; changed;) {
    changed = false;
    for (const m of MODULES) {
      if (off.has(m.key)) continue;
      const missing = m.requires?.some(k => off.has(k)) || (m.requiresAny && m.requiresAny.every(k => off.has(k)));
      if (missing) { off.add(m.key); changed = true; }
    }
  }
  return off;
}

export const isModuleEnabled = (disabled: string[] | null | undefined, key?: string) => !key || !effectiveDisabled(disabled).has(key);

// Why a switched-on feature is still off, e.g. "Needs Payments".
export function blockedBy(disabled: string[] | null | undefined, key: string): string | null {
  const m = BY_KEY.get(key);
  if (!m) return null;
  const off = effectiveDisabled(disabled);
  const missing = m.requires?.filter(k => off.has(k)) ?? [];
  if (missing.length) return `Needs ${missing.map(k => BY_KEY.get(k)?.label ?? k).join(' and ')}`;
  if (m.requiresAny?.every(k => off.has(k))) return `Needs ${m.requiresAny.map(k => BY_KEY.get(k)?.label ?? k).join(' or ')}`;
  return null;
}

export const moduleByKey = (key?: string) => (key ? BY_KEY.get(key) : undefined);
