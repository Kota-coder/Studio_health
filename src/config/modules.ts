// Menu sections a hospital can switch off (Organization Setup → Hospital Profile → Menus).
// A switched-off section is hidden from the menu and its pages show a short notice instead.
// Patient Dashboard, patient pages, Staff Management and Hospital Profile are always on.
// This is about what a hospital uses; who may open each section is still decided by role
// (src/config/permissions.ts) and by the database's security rules.

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  paths: string[]; // URL prefixes belonging to the section
}

export const MODULES: ModuleDefinition[] = [
  { key: 'billing', label: 'Billing', description: 'Patient bills and their payment status.', paths: ['/billing'] },
  { key: 'payments', label: 'Payments', description: 'Money paid out: salaries, supplies, doctor and referral fees.', paths: ['/payments'] },
  { key: 'financialDashboard', label: 'Financial Dashboard', description: 'Totals and charts for money in and out.', paths: ['/financial-dashboard'] },
  { key: 'duty', label: 'Duty Roster & Attendance', description: 'Shifts, clock-in and attendance reports.', paths: ['/duty'] },
  { key: 'departments', label: 'Departments', description: 'Departments, care teams and doctor fees per case.', paths: ['/departments'] },
  { key: 'referringDoctors', label: 'Referring Doctors', description: 'Doctors who refer patients, and referral fees.', paths: ['/referring-doctors'] },
  { key: 'patientCare', label: 'Patient Care Templates', description: 'Structured templates for care notes.', paths: ['/patient-care'] },
  { key: 'medicalTests', label: 'Medical Tests Catalog', description: 'The tests offered and their prices.', paths: ['/medical-tests'] },
  { key: 'medications', label: 'Medications', description: 'Pharmacy medicines and prices.', paths: ['/medications'] },
  { key: 'materials', label: 'Materials', description: 'Consumables and supplies.', paths: ['/materials'] },
  { key: 'vendors', label: 'Material Vendors', description: 'Suppliers of materials and medicines.', paths: ['/vendors'] },
  { key: 'paymentMethods', label: 'Payment Methods', description: 'Managing the payment methods offered.', paths: ['/payment-methods'] },
  { key: 'sampleData', label: 'Sample Data', description: 'Loading demo data for trying the app out.', paths: ['/admin'] },
];

export const isModuleEnabled = (disabled: string[] | null | undefined, key?: string) => !key || !(disabled ?? []).includes(key);

export function moduleForPath(pathname: string): ModuleDefinition | undefined {
  return MODULES.find(m => m.paths.some(p => pathname === p || pathname.startsWith(`${p}/`)));
}
