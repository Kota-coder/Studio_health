export type StaffRole = "Super Admin" | "Admin" | "Doctor" | "Nurse" | "Receptionist" | "Accounts" | "Lab Technician";

export interface StaffMember {
  id: number;
  name: string;
  phoneNumber: string;
  email: string;
  role: StaffRole;
  hireDate: string; // dd/MM/yyyy
  salary?: number;
  preferredLanguage?: 'en' | 'te';
}
