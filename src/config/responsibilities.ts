// Departments and the duties each carries out, and which roles do them. A hospital can change
// the roles on the Hospital Profile page (stored in hospital_profile.responsibilities); the
// database's responsible() enforces the same, with the same defaults (keep them in step).
// The Super Admin can always step in.
import type { StaffRole } from '@/types/staff';

export type Duty = 'requestTests' | 'sendToPharmacy' | 'performTests' | 'dispense' | 'collectPharmacy' | 'collectPayments';
export type Responsibilities = Partial<Record<Duty, StaffRole[]>>;

export interface DepartmentDuties {
  name: string;
  description: string;
  duties: Array<{ key: Duty; label: string; detail: string; module?: string }>;
}

export const DEPARTMENTS: DepartmentDuties[] = [
  {
    name: 'Clinical',
    description: 'Doctors and nurses caring for the patient decide what is needed.',
    duties: [
      { key: 'requestTests', label: 'Request tests', detail: 'Request Test on the patient page.', module: 'labRequests' },
      { key: 'sendToPharmacy', label: 'Prescribe medicines for the pharmacy', detail: 'Medicines on care notes go to the pharmacy.', module: 'pharmacyOrders' },
    ],
  },
  {
    name: 'Laboratory',
    description: 'Carries out the tests.',
    duties: [
      { key: 'performTests', label: 'Carry out tests and record results', detail: 'Recording a result bills the test; payment is taken by Billing.', module: 'labRequests' },
    ],
  },
  {
    name: 'Pharmacy',
    description: 'Gives out medicines and takes payment for them.',
    duties: [
      { key: 'dispense', label: 'Dispense medicines', detail: 'Dispensing makes the pharmacy bill and takes the medicines out of stock.', module: 'pharmacyOrders' },
      { key: 'collectPharmacy', label: 'Take payment for pharmacy bills', detail: 'Mark pharmacy bills paid.', module: 'pharmacyOrders' },
    ],
  },
  {
    name: 'Billing & Payments',
    description: 'Takes payment for consultations, procedures and tests.',
    duties: [
      { key: 'collectPayments', label: 'Take payment for bills', detail: 'Mark consultation, procedure and test bills paid (and pharmacy bills when Pharmacy Orders is off).', module: 'billing' },
    ],
  },
];

export const DEFAULT_RESPONSIBILITIES: Record<Duty, StaffRole[]> = {
  requestTests: ['Admin', 'Doctor', 'Nurse'],
  sendToPharmacy: ['Admin', 'Doctor', 'Nurse'],
  performTests: ['Lab Technician'],
  dispense: ['Pharmacist'],
  collectPharmacy: ['Pharmacist'],
  collectPayments: ['Admin', 'Receptionist', 'Accounts'],
};

export const rolesFor = (duty: Duty, config?: Responsibilities | null): StaffRole[] => config?.[duty] ?? DEFAULT_RESPONSIBILITIES[duty];

export const isResponsible = (duty: Duty, role: StaffRole, config?: Responsibilities | null) =>
  role === 'Super Admin' || rolesFor(duty, config).includes(role);
