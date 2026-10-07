
export type DoctorFeeStatus = "Pending" | "Paid";
export type PatientCondition = "Critical" | "Medium" | "Low" | "Discharged" | "Unassigned";
export type PatientAdmissionCondition = "Stable" | "Guarded" | "Serious" | "Critical" | "Undetermined" | "";

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO date string
  staffId: number;
  staffName: string;
  actionType: string; // e.g., "Condition Changed", "Care Note Added"
  changeDetails: string; // e.g., "Condition changed from Medium to Critical"
}

export interface CareNote {
  id: string;
  text: string;
  createdAt: string;
  staffId?: number;
  staffName?: string;
  templateId?: string;
  templateName?: string;
  templateFieldsData?: Record<string, string | number | boolean | string[]>;
  medicationsMentioned?: Array<{
    medicationId: string;
    medicationName: string;
    dosage?: string;
    notes?: string;
  }>;
  attachments?: string[]; // Storage paths in the patient-files bucket (data: URLs only before upload)
}

export interface TestFieldData {
  [key: string]: string | number | boolean;
}

export interface TestEntry {
  id: string;
  testTypeId: string;
  testTypeName: string;
  datePerformed: string;
  testData?: TestFieldData;
  overallResults?: string;
  notes?: string;
  performedByStaffId?: number;
  performedByStaffName?: string;
  createdAt: string;
  attachments?: string[]; // Storage paths in the patient-files bucket (data: URLs only before upload)
}

// One billed procedure type and the referral % applied to it.
export interface ReferralFeeLine {
  key: string; // billType + description, lower-cased
  description: string;
  billType: string;
  amount: number; // Total billed for this procedure type
  percent: number;
  fee: number;
}

export interface ReferralFeeBasis {
  mode: 'percent';
  lines: ReferralFeeLine[];
}

export interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  mobileNumber: string;
  emailAddress?: string;
  address?: string;
  idNumber: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  idCardType?: string;
  // Storage paths in the patient-files bucket. Aadhaar card images are never stored.
  idCardImages?: string[];
  patientPhotos?: string[];
  condition?: PatientCondition;
  careNotes?: CareNote[];
  assignedStaffIds?: number[];

  admissionDate?: string;
  referredDoctorId?: number | null;
  reasonForVisit?: string;
  initialObservationsText?: string;
  initialObservationAttachments?: string[];
  admissionCondition?: PatientAdmissionCondition;

  tests?: TestEntry[];
  auditLog?: AuditLogEntry[];

  // Department and care team. The attending doctor earns doctorFee for this case,
  // paid through a "Doctor Fee" payment (which sets doctorFeeStatus to Paid).
  departmentId?: number | null;
  attendingDoctorId?: number | null;
  attendingNurseId?: number | null;
  doctorFee?: number | null;
  doctorFeeStatus?: DoctorFeeStatus;
  doctorFeePaymentId?: string | null;

  // Fee the hospital owes the referring doctor (referredDoctorId) for this patient,
  // settled by a Referral/CC payment. The patient does not pay it.
  referralFee?: number | null;
  referralFeeBasis?: ReferralFeeBasis | null; // How referralFee was worked out; null = fixed amount
  referralFeeStatus?: DoctorFeeStatus;
  referralFeePaymentId?: string | null;

  // DPDP Act consent record, captured at registration.
  consentGivenAt?: string;
  consentVersion?: string;
  consentRecordedByStaffId?: number;
  createdAt?: string;
}
