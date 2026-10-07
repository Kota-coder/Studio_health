export type StaffRole = "Doctor" | "Nurse" | "Admin" | "Receptionist" | "Accounts";

export interface StaffMember {
  id: number;
  name: string;
  phoneNumber: string;
  email: string;
  role: StaffRole;
  hireDate: string; // Store as ISO string (e.g., "yyyy-MM-dd") or dd/MM/yyyy string
  salary?: number;
  password?: string; // Optional for backward compatibility
}