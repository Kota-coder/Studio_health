
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

  // DPDP Act consent record, captured at registration.
  consentGivenAt?: string;
  consentVersion?: string;
  consentRecordedByStaffId?: number;
  createdAt?: string;
}
