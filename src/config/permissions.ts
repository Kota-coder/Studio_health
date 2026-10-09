import type { StaffRole } from '@/types/staff';

export const ALL_ROLES: StaffRole[] = ['Super Admin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Accounts', 'Lab Technician', 'Pharmacist'];

/**
 * Which roles may open each section. Used by both the header menu and the pages
 * themselves (via src/config/navigation.ts and the page guard).
 * The database policies in supabase/migrations enforce the same rules for payments.
 */
export const PAGE_ROLES = {
  dashboard: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts", "Lab Technician", "Pharmacist"],
  // The lab queue (the database's home_summary() shows its tile to the same roles).
  lab: ["Super Admin", "Admin", "Doctor", "Nurse", "Lab Technician"],
  // The pharmacy's queue of medicines ordered on patient pages (home_summary() likewise).
  pharmacyOrders: ["Super Admin", "Admin", "Doctor", "Nurse", "Pharmacist"],
  // Lab technicians and pharmacists collect payment for what they complete.
  billing: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts", "Lab Technician", "Pharmacist"],
  payments: ["Super Admin", "Admin", "Doctor", "Accounts"],
  financialDashboard: ["Super Admin", "Admin", "Doctor", "Accounts"],
  patientCare: ["Super Admin", "Admin", "Doctor", "Nurse"],
  medications: ["Super Admin", "Admin", "Doctor", "Nurse", "Pharmacist"],
  materials: ["Super Admin", "Admin", "Doctor", "Nurse"],
  // Also who may record stock entries (the database enforces the same).
  inventory: ["Super Admin", "Admin", "Doctor", "Nurse", "Accounts", "Pharmacist"],
  vendors: ["Super Admin", "Admin", "Doctor", "Nurse", "Pharmacist"],
  staff: ["Super Admin", "Admin", "Doctor"],
  departments: ["Super Admin", "Admin"],
  paymentMethods: ["Super Admin"],
  hospitalProfile: ["Super Admin"],
  duty: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts", "Lab Technician", "Pharmacist"],
  medicalTests: ["Super Admin", "Admin", "Doctor", "Nurse"],
  referringDoctors: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist"],
  admin: ["Super Admin"],
} satisfies Record<string, StaffRole[]>;

// Who asks for tests and medicines on the patient page, and who carries them out and bills
// them while Lab Requests / Pharmacy Orders are on (the database's can_process_lab() and
// can_process_pharmacy() enforce the processing side). The Super Admin can step in for both.
export const REQUEST_ROLES: StaffRole[] = ["Super Admin", "Admin", "Doctor", "Nurse"];
export const LAB_ROLES: StaffRole[] = ["Lab Technician", "Super Admin"];
export const PHARMACY_ROLES: StaffRole[] = ["Pharmacist", "Super Admin"];

// Who plans the duty roster and corrects attendance (the database enforces the same).
export const DUTY_MANAGER_ROLES: StaffRole[] = ["Super Admin", "Admin"];
// Who can see everyone's attendance (Accounts for salaries); others see their own.
export const ATTENDANCE_VIEW_ROLES: StaffRole[] = ["Super Admin", "Admin", "Accounts"];
// Who may set and settle doctor and referral fees (the database enforces the same).
export const FEE_ROLES: StaffRole[] = ["Super Admin", "Admin", "Accounts"];
// Who may delete a mistaken manual stock entry (the database enforces the same).
export const STOCK_CORRECTION_ROLES: StaffRole[] = ["Super Admin", "Admin"];

// Whether a role may open one of the sections above.
export const canOpen = (page: keyof typeof PAGE_ROLES, role: StaffRole) => (PAGE_ROLES[page] as readonly StaffRole[]).includes(role);
