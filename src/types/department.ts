export interface Department {
  id: number;
  name: string;
  description?: string;
  defaultDoctorFee?: number | null; // Suggested fee for the attending doctor per case
  active?: boolean;
  createdAt?: string; // Set by the database
}

// Department id -> staff ids (doctors and nurses) who work in it.
export type DepartmentMembers = Record<number, number[]>;
