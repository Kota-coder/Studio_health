
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
  attachmentDataUrl?: string | null; // Deprecated: use attachments instead
  attachments?: string[]; // Array of image data URLs for multiple attachments
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
  attachmentDataUrl?: string | null; // Deprecated: use attachments instead
  attachments?: string[]; // Array of image data URLs for multiple attachments
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
  imageSrc?: string | null;
  idCardImages?: string[]; // Array of ID card image data URLs for multiple attachments
  idCardType?: string;
  patientPhotoDataUrl?: string | null;
  patientPhotos?: string[]; // Array of patient photo data URLs for multiple attachments
  condition?: PatientCondition;
  careNotes?: CareNote[];
  assignedStaffIds?: number[];

  admissionDate?: string;
  referredDoctorId?: number | null;
  reasonForVisit?: string;
  initialObservationsText?: string;
  initialObservationAttachmentDataUrl?: string | null;
  initialObservationAttachments?: string[];
  admissionCondition?: PatientAdmissionCondition;

  tests?: TestEntry[];
  auditLog?: AuditLogEntry[];
}
