import type { StaffRole } from '@/types/staff';

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
  vendors: ["Super Admin", "Admin", "Doctor", "Nurse"],
  staff: ["Super Admin", "Admin", "Doctor"],
  medicalTests: ["Super Admin", "Admin", "Doctor", "Nurse"],
  referringDoctors: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist"],
  admin: ["Super Admin"],
} satisfies Record<string, StaffRole[]>;
