import type { Patient } from '@/types/patient';
import { getRandomAttachments } from './attachments';

export const SEED_PATIENTS: Patient[] = [
  {
    id: 1,
    firstName: "Rajesh",
    lastName: "Kumar",
    gender: "Male",
    dateOfBirth: "15/05/1965",
    mobileNumber: "+91-9876501234",
    emailAddress: "rajesh.kumar@email.com",
    address: "123 MG Road, Bangalore, Karnataka 560001",
    idNumber: "ABCD1234567",
    emergencyContactName: "Priya Kumar",
    emergencyContactNumber: "+91-9876501235",
    idCardType: "Aadhaar Card",
    idCardImages: getRandomAttachments('idCard', 2),
    patientPhotos: getRandomAttachments('patientPhoto', 2),
    condition: "Medium",
    admissionDate: "2025-10-20T10:00:00.000Z",
    referredDoctorId: 1,
    reasonForVisit: "Routine Checkup",
    admissionCondition: "Stable",
    initialObservationsText: "Patient presents with mild chest discomfort during exertion. No acute distress. Vitals within normal limits.",
    initialObservationAttachments: getRandomAttachments('medical', 2),
    assignedStaffIds: [1, 3],
    careNotes: [
      {
        id: "note_1_1",
        text: "Initial cardiac assessment completed. Patient has history of hypertension, currently well controlled on medication.",
        createdAt: "2025-10-20T11:00:00.000Z",
        staffId: 1,
        staffName: "Dr. Sarah Johnson",
        templateId: "template_cardiac",
        templateName: "Cardiac Assessment",
        templateFieldsData: {
          "Blood Pressure": "130/85 mmHg",
          "Heart Rate": "72",
          "Chest Pain Assessment": "Mild, 3/10, only during heavy exertion",
          "Edema Present": "None",
          "Breathlessness Level": "Minimal"
        },
        medicationsMentioned: [
          { medicationId: "3", medicationName: "Metoprolol", dosage: "50mg twice daily", notes: "Continue current regimen" },
          { medicationId: "4", medicationName: "Lisinopril", dosage: "10mg once daily", notes: "Monitor blood pressure" }
        ],
        attachments: getRandomAttachments('medical', 2)
      },
      {
        id: "note_1_2",
        text: "Follow-up assessment shows improvement. Patient reports reduced discomfort.",
        createdAt: "2025-10-25T14:30:00.000Z",
        staffId: 1,
        staffName: "Dr. Sarah Johnson",
        templateId: "template_followup",
        templateName: "Follow-up Visit",
        templateFieldsData: {
          "Symptom Status": "Improved - chest discomfort reduced to 1/10",
          "Medication Compliance": "Excellent - taking all medications as prescribed",
          "Side Effects Noted": "None reported",
          "Next Steps": "Continue medications, schedule stress test"
        },
        attachments: getRandomAttachments('medical', 3)
      }
    ],
    tests: [
      {
        id: "test_1_1",
        testTypeId: "ecg",
        testTypeName: "ECG",
        datePerformed: "21/10/2025",
        testData: {
          "rhythm": "Sinus Rhythm",
          "rate_bpm": "72",
          "pr_interval_ms": "160",
          "qrs_duration_ms": "92",
          "qt_qtc_interval_ms": "410/425",
          "axis_degrees": "+45",
          "interpretation_notes": "Normal sinus rhythm. No ST-T wave abnormalities. No evidence of ischemia."
        },
        overallResults: "Normal ECG. No acute changes.",
        notes: "Patient tolerates well tolerated procedure well.",
        performedByStaffId: 1,
        performedByStaffName: "Dr. Sarah Johnson",
        createdAt: "2025-10-21T09:00:00.000Z",
        attachments: getRandomAttachments('lab', 2)
      },
      {
        id: "test_1_2",
        testTypeId: "blood_panel",
        testTypeName: "Blood Panel",
        datePerformed: "21/10/2025",
        testData: {
          "hemoglobin": "14.2",
          "wbc_count": "7.5",
          "platelets": "245",
          "rbc_count": "4.8"
        },
        overallResults: "All values within normal range",
        performedByStaffId: 2,
        performedByStaffName: "Dr. Raj Patel",
        createdAt: "2025-10-21T10:30:00.000Z",
        attachments: getRandomAttachments('lab', 3)
      }
    ],
    auditLog: [
      {
        id: "audit_1_1",
        timestamp: "2025-10-20T10:00:00.000Z",
        staffId: 6,
        staffName: "Priya Sharma",
        actionType: "Patient Registered",
        changeDetails: "New patient registered in the system"
      },
      {
        id: "audit_1_2",
        timestamp: "2025-10-20T10:30:00.000Z",
        staffId: 1,
        staffName: "Dr. Sarah Johnson",
        actionType: "Admission Details Recorded",
        changeDetails: "Initial admission details recorded. Reason: Routine Checkup"
      }
    ]
  },
  {
    id: 2,
    firstName: "Sunita",
    lastName: "Reddy",
    gender: "Female",
    dateOfBirth: "22/08/1978",
    mobileNumber: "+91-9876502345",
    emailAddress: "sunita.reddy@email.com",
    address: "456 Park Street, Mumbai, Maharashtra 400001",
    idNumber: "WXYZ9876543",
    emergencyContactName: "Vikram Reddy",
    emergencyContactNumber: "+91-9876502346",
    idCardType: "PAN Card",
    idCardImages: getRandomAttachments('idCard', 2),
    patientPhotos: getRandomAttachments('patientPhoto', 1),
    condition: "Critical",
    admissionDate: "2025-10-22T08:00:00.000Z",
    referredDoctorId: 2,
    reasonForVisit: "Emergency",
    admissionCondition: "Serious",
    initialObservationsText: "Patient admitted via emergency with acute chest pain. Immediate cardiac workup initiated.",
    initialObservationAttachments: getRandomAttachments('medical', 3),
    assignedStaffIds: [1, 2, 4],
    careNotes: [
      {
        id: "note_2_1",
        text: "Emergency cardiac assessment. Patient stabilized with nitroglycerin and aspirin.",
        createdAt: "2025-10-22T08:30:00.000Z",
        staffId: 1,
        staffName: "Dr. Sarah Johnson",
        templateId: "template_cardiac",
        templateName: "Cardiac Assessment",
        templateFieldsData: {
          "Blood Pressure": "150/95 mmHg",
          "Heart Rate": "95",
          "Chest Pain Assessment": "Severe, 8/10, radiating to left arm",
          "Edema Present": "Mild peripheral edema",
          "Breathlessness Level": "Moderate"
        },
        medicationsMentioned: [
          { medicationId: "1", medicationName: "Aspirin", dosage: "325mg stat, then 81mg daily", notes: "Given immediately on admission" },
          { medicationId: "5", medicationName: "Warfarin", dosage: "5mg daily", notes: "Started for anticoagulation" }
        ],
        attachments: getRandomAttachments('medical', 2)
      }
    ],
    tests: [
      {
        id: "test_2_1",
        testTypeId: "ecg",
        testTypeName: "ECG",
        datePerformed: "22/10/2025",
        testData: {
          "rhythm": "Sinus Tachycardia",
          "rate_bpm": "105",
          "pr_interval_ms": "155",
          "qrs_duration_ms": "95",
          "qt_qtc_interval_ms": "380/445",
          "axis_degrees": "+60",
          "interpretation_notes": "ST elevation in leads II, III, aVF suggesting inferior wall MI"
        },
        overallResults: "STEMI - Immediate intervention required",
        notes: "Cardiology consulted. Catheterization scheduled.",
        performedByStaffId: 1,
        performedByStaffName: "Dr. Sarah Johnson",
        createdAt: "2025-10-22T08:15:00.000Z",
        attachments: getRandomAttachments('lab', 2)
      }
    ],
    auditLog: [
      {
        id: "audit_2_1",
        timestamp: "2025-10-22T08:00:00.000Z",
        staffId: 6,
        staffName: "Priya Sharma",
        actionType: "Patient Registered",
        changeDetails: "Emergency admission - new patient registered"
      }
    ]
  },
  {
    id: 3,
    firstName: "Mohammed",
    lastName: "Ali",
    gender: "Male",
    dateOfBirth: "10/12/1955",
    mobileNumber: "+91-9876503456",
    emailAddress: "mohammed.ali@email.com",
    address: "789 Gandhi Nagar, Delhi 110001",
    idNumber: "PQRS5555666",
    emergencyContactName: "Fatima Ali",
    emergencyContactNumber: "+91-9876503457",
    idCardType: "Driving License",
    idCardImages: getRandomAttachments('idCard', 1),
    patientPhotos: getRandomAttachments('patientPhoto', 2),
    condition: "Medium",
    admissionDate: "2025-10-15T09:00:00.000Z",
    referredDoctorId: 3,
    reasonForVisit: "Follow-up",
    admissionCondition: "Stable",
    initialObservationsText: "Regular follow-up for chronic heart condition. Patient managing well at home.",
    initialObservationAttachments: getRandomAttachments('medical', 1),
    assignedStaffIds: [2, 3],
    careNotes: [
      {
        id: "note_3_1",
        text: "Routine medication review and adjustment.",
        createdAt: "2025-10-15T10:00:00.000Z",
        staffId: 2,
        staffName: "Dr. Raj Patel",
        templateId: "template_medication_review",
        templateName: "Medication Review",
        templateFieldsData: {
          "Current Medications Reviewed": "Metoprolol, Furosemide, Digoxin",
          "Adherence Issues": "None - patient compliant",
          "Dosage Adjustments": "Furosemide increased to 40mg daily",
          "New Prescriptions": "None"
        },
        medicationsMentioned: [
          { medicationId: "3", medicationName: "Metoprolol", dosage: "25mg twice daily", notes: "Continue" },
          { medicationId: "6", medicationName: "Furosemide", dosage: "40mg once daily", notes: "Increased dose" },
          { medicationId: "8", medicationName: "Digoxin", dosage: "0.25mg daily", notes: "Continue" }
        ],
        attachments: getRandomAttachments('medical', 1)
      }
    ],
    tests: [],
    auditLog: [
      {
        id: "audit_3_1",
        timestamp: "2025-10-15T09:00:00.000Z",
        staffId: 6,
        staffName: "Priya Sharma",
        actionType: "Patient Registered",
        changeDetails: "Return patient - follow-up visit"
      }
    ]
  }
];
