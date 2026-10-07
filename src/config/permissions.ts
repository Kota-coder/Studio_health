import type { StaffRole } from '@/types/staff';

/**
 * Which roles may open each section. Used by both the header menu and the pages
 * themselves, so a menu link never leads to an "Access Denied" screen.
 */
export const PAGE_ROLES = {
  dashboard: ["Admin", "Doctor", "Nurse", "Receptionist", "Accounts"],
  billing: ["Admin", "Doctor", "Nurse", "Receptionist", "Accounts"],
  payments: ["Admin", "Doctor", "Accounts"],
  financialDashboard: ["Admin", "Doctor", "Accounts"],
  patientCare: ["Admin", "Doctor", "Nurse"],
  medications: ["Admin", "Doctor", "Nurse"],
  materials: ["Admin", "Doctor", "Nurse"],
  vendors: ["Admin", "Doctor", "Nurse"],
  staff: ["Admin", "Doctor"],
  medicalTests: ["Admin", "Doctor", "Nurse"],
  referringDoctors: ["Admin", "Doctor", "Nurse", "Receptionist"],
  admin: ["Admin"],
} satisfies Record<string, StaffRole[]>;
