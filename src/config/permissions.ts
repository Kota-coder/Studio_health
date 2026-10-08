import type { StaffRole } from '@/types/staff';

export const ALL_ROLES: StaffRole[] = ['Super Admin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Accounts', 'Lab Technician'];

/**
 * Which roles may open each section. Used by both the header menu and the pages
 * themselves (via src/config/navigation.ts and the page guard).
 * The database policies in supabase/migrations enforce the same rules for payments.
 */
export const PAGE_ROLES = {
  dashboard: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts", "Lab Technician"],
  // The lab queue (the database's home_summary() shows its tile to the same roles).
  lab: ["Super Admin", "Admin", "Doctor", "Nurse", "Lab Technician"],
  // Lab technicians collect payment for the tests they complete.
  billing: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts", "Lab Technician"],
  payments: ["Super Admin", "Admin", "Doctor", "Accounts"],
  financialDashboard: ["Super Admin", "Admin", "Doctor", "Accounts"],
  patientCare: ["Super Admin", "Admin", "Doctor", "Nurse"],
  medications: ["Super Admin", "Admin", "Doctor", "Nurse"],
  materials: ["Super Admin", "Admin", "Doctor", "Nurse"],
  // Also who may record stock entries (the database enforces the same).
  inventory: ["Super Admin", "Admin", "Doctor", "Nurse", "Accounts"],
  vendors: ["Super Admin", "Admin", "Doctor", "Nurse"],
  staff: ["Super Admin", "Admin", "Doctor"],
  departments: ["Super Admin", "Admin"],
  paymentMethods: ["Super Admin"],
  hospitalProfile: ["Super Admin"],
  duty: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts", "Lab Technician"],
  medicalTests: ["Super Admin", "Admin", "Doctor", "Nurse"],
  referringDoctors: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist"],
  admin: ["Super Admin"],
} satisfies Record<string, StaffRole[]>;

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
