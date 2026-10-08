import type { StaffRole } from '@/types/staff';

export const ALL_ROLES: StaffRole[] = ['Super Admin', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Accounts'];

/**
 * Which roles may open each section. Used by both the header menu and the pages
 * themselves, so a menu link never leads to an "Access Denied" screen.
 * The database policies in supabase/migrations enforce the same rules for payments.
 */
export const PAGE_ROLES = {
  dashboard: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts"],
  billing: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts"],
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
  duty: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts"],
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
