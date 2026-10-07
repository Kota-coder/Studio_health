export type StaffRole = "Super Admin" | "Admin" | "Doctor" | "Nurse" | "Receptionist";

export interface StaffMember {
  id: number;
  name: string;
  phoneNumber: string;
  email: string;
  role: StaffRole;
  hireDate: string; // Store as ISO string (e.g., "yyyy-MM-dd") or dd/MM/yyyy string
  salary?: number;
}