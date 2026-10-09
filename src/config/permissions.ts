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
  // Pharmacists take payment for pharmacy bills; whoever else the hospital makes responsible
  // for taking payments can open it too (src/config/responsibilities.ts).
  billing: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist", "Accounts", "Pharmacist"],
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

export type PageKey = keyof typeof PAGE_ROLES;
// Where the hospital has changed who may open a page (Hospital Profile → Who can see what).
export type PageAccess = Partial<Record<PageKey, StaffRole[]>>;

// The roles that may open a page: the hospital's setting, or the defaults above. The Super
// Admin may always open every page. The database enforces this for the pages that hold
// billing, payment and stock data (page_allowed() in the schema).
export const rolesForPage = (page: PageKey, overrides?: PageAccess | null): readonly StaffRole[] => overrides?.[page] ?? PAGE_ROLES[page];
export const mayOpenPage = (page: PageKey, role: StaffRole, overrides?: PageAccess | null) =>
  role === 'Super Admin' || rolesForPage(page, overrides).includes(role);

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
