// Features a hospital can switch off (Organization Setup → Hospital Profile → Menus).
// A switched-off feature disappears everywhere: its menu item, its pages (which show a short
// notice instead) and its parts of other screens (e.g. Billing off removes the bills card and
// "Bill Test" buttons on the patient page). Patients, Staff Management and Hospital Profile
// are always on. This is about what a hospital uses; who may open each section is still
// decided by role (src/config/permissions.ts) and by the database's security rules.

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  paths: string[]; // URL prefixes belonging to the feature
  requires?: string[]; // also off when any of these is off
  requiresAny?: string[]; // also off when all of these are off
}

export const MODULES: ModuleDefinition[] = [
  { key: 'billing', label: 'Billing', description: 'Patient bills, "Bill Test" and "Bill Meds" on the patient page.', paths: ['/billing'] },
  { key: 'payments', label: 'Payments', description: 'Money paid out: salaries, supplies, doctor and referral fees.', paths: ['/payments'] },
  { key: 'doctorFees', label: 'Doctor Fees', description: "The attending doctor's fee per case, paid through Payments.", paths: [], requires: ['departments', 'payments'] },
  { key: 'referringDoctors', label: 'Referrals', description: 'Referring doctors, and who referred each patient.', paths: ['/referring-doctors'] },
  { key: 'referralFees', label: 'Referral Fees', description: 'Fees paid to referring doctors, through Payments.', paths: [], requires: ['referringDoctors', 'payments'] },
  { key: 'financialDashboard', label: 'Financial Dashboard', description: 'Totals and charts for money in and out.', paths: ['/financial-dashboard'], requiresAny: ['billing', 'payments'] },
  { key: 'paymentMethods', label: 'Payment Methods', description: 'Managing the payment methods offered.', paths: ['/payment-methods'], requiresAny: ['billing', 'payments'] },
  { key: 'duty', label: 'Duty Roster & Attendance', description: 'Shifts, clock-in and attendance reports.', paths: ['/duty'] },
  { key: 'departments', label: 'Departments', description: 'Departments and care teams (attending doctor and nurse).', paths: ['/departments'] },
  { key: 'patientCare', label: 'Patient Care Templates', description: 'Structured templates for care notes.', paths: ['/patient-care'] },
  { key: 'medicalTests', label: 'Medical Tests Catalog', description: 'Managing the tests offered and their prices.', paths: ['/medical-tests'] },
  { key: 'medications', label: 'Pharmacy', description: 'Medicines the pharmacy sells; "Add Medication" on care notes.', paths: ['/pharmacy'] },
  { key: 'materials', label: 'Materials', description: 'Consumables and supplies.', paths: ['/materials'] },
  { key: 'inventory', label: 'Inventory', description: 'Stock on hand, its value, and what needs refilling.', paths: ['/inventory'], requiresAny: ['medications', 'materials'] },
  { key: 'vendors', label: 'Material Vendors', description: 'Suppliers of materials and medicines.', paths: ['/vendors'] },
  { key: 'sampleData', label: 'Sample Data', description: 'Loading demo data for trying the app out.', paths: ['/admin'] },
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

export function moduleForPath(pathname: string): ModuleDefinition | undefined {
  return MODULES.find(m => m.paths.some(p => pathname === p || pathname.startsWith(`${p}/`)));
}
