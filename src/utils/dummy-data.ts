import { Patient, PatientCondition } from '../types/patient';

export const DUMMY_PATIENTS: Omit<Patient, 'id'>[] = [
  {
    firstName: "John",
    lastName: "Smith",
    gender: "Male",
    dateOfBirth: "1985-03-15",
    mobileNumber: "+1-555-0123",
    emailAddress: "john.smith@email.com",
    address: "123 Main St, Springfield, IL 62701",
    idNumber: "SSN123456789",
    emergencyContactName: "Jane Smith",
    emergencyContactNumber: "+1-555-0124",
    idCardType: "Driver's License",
    condition: "Medium" as PatientCondition,
    careNotes: [{
      id: "note1",
      text: "Patient reports chest pain during exercise. Recommended stress test.",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 1,
      staffName: "Dr. Wilson"
    }],
    assignedStaffIds: [1, 2],
    admissionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 1,
    reasonForVisit: "Chest pain and shortness of breath",
    initialObservationsText: "Patient appears stable, mild discomfort noted",
    admissionCondition: "Stable",
    tests: [],
    auditLog: [{
      id: "audit1",
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 1,
      staffName: "Dr. Wilson",
      actionType: "Patient Registered",
      changeDetails: "New patient John Smith registered."
    }]
  },
  {
    firstName: "Maria",
    lastName: "Garcia",
    gender: "Female",
    dateOfBirth: "1978-07-22",
    mobileNumber: "+1-555-0234",
    emailAddress: "maria.garcia@email.com",
    address: "456 Oak Ave, Denver, CO 80202",
    idNumber: "SSN987654321",
    emergencyContactName: "Carlos Garcia",
    emergencyContactNumber: "+1-555-0235",
    idCardType: "State ID",
    condition: "Critical" as PatientCondition,
    careNotes: [{
      id: "note2",
      text: "Patient admitted with acute myocardial infarction. Started on IV medications.",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 2,
      staffName: "Dr. Johnson"
    }],
    assignedStaffIds: [2, 3],
    admissionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 2,
    reasonForVisit: "Severe chest pain, suspected heart attack",
    initialObservationsText: "Patient in acute distress, immediate intervention required",
    admissionCondition: "Critical",
    tests: [],
    auditLog: [{
      id: "audit2",
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 2,
      staffName: "Dr. Johnson",
      actionType: "Patient Registered",
      changeDetails: "New patient Maria Garcia registered."
    }]
  },
  {
    firstName: "Robert",
    lastName: "Johnson",
    gender: "Male",
    dateOfBirth: "1965-12-08",
    mobileNumber: "+1-555-0345",
    emailAddress: "robert.johnson@email.com",
    address: "789 Pine St, Seattle, WA 98101",
    idNumber: "SSN456789123",
    emergencyContactName: "Susan Johnson",
    emergencyContactNumber: "+1-555-0346",
    idCardType: "Passport",
    condition: "Low" as PatientCondition,
    careNotes: [{
      id: "note3",
      text: "Routine cardiology follow-up. Blood pressure well controlled.",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 1,
      staffName: "Dr. Wilson"
    }],
    assignedStaffIds: [1],
    admissionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 1,
    reasonForVisit: "Routine cardiac check-up",
    initialObservationsText: "Patient stable, no acute concerns",
    admissionCondition: "Stable",
    tests: [],
    auditLog: [{
      id: "audit3",
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 1,
      staffName: "Dr. Wilson",
      actionType: "Patient Registered",
      changeDetails: "New patient Robert Johnson registered."
    }]
  },
  {
    firstName: "Emily",
    lastName: "Davis",
    gender: "Female",
    dateOfBirth: "1992-04-18",
    mobileNumber: "+1-555-0456",
    emailAddress: "emily.davis@email.com",
    address: "321 Elm St, Austin, TX 73301",
    idNumber: "SSN789123456",
    emergencyContactName: "Michael Davis",
    emergencyContactNumber: "+1-555-0457",
    idCardType: "Driver's License",
    condition: "Medium" as PatientCondition,
    careNotes: [{
      id: "note4",
      text: "Young patient with palpitations. ECG shows minor irregularities.",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 3,
      staffName: "Dr. Brown"
    }],
    assignedStaffIds: [3],
    admissionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 3,
    reasonForVisit: "Heart palpitations and anxiety",
    initialObservationsText: "Patient anxious but vitally stable",
    admissionCondition: "Stable",
    tests: [],
    auditLog: [{
      id: "audit4",
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 3,
      staffName: "Dr. Brown",
      actionType: "Patient Registered",
      changeDetails: "New patient Emily Davis registered."
    }]
  },
  {
    firstName: "William",
    lastName: "Brown",
    gender: "Male",
    dateOfBirth: "1955-09-30",
    mobileNumber: "+1-555-0567",
    emailAddress: "william.brown@email.com",
    address: "654 Maple Dr, Phoenix, AZ 85001",
    idNumber: "SSN321654987",
    emergencyContactName: "Betty Brown",
    emergencyContactNumber: "+1-555-0568",
    idCardType: "State ID",
    condition: "Discharged" as PatientCondition,
    careNotes: [{
      id: "note5",
      text: "Post-operative recovery complete. Patient discharged with medication instructions.",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 2,
      staffName: "Dr. Johnson"
    }],
    assignedStaffIds: [],
    admissionDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 2,
    reasonForVisit: "Cardiac catheterization procedure",
    initialObservationsText: "Pre-operative assessment completed",
    admissionCondition: "Stable",
    tests: [],
    auditLog: [{
      id: "audit5",
      timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 2,
      staffName: "Dr. Johnson",
      actionType: "Patient Registered",
      changeDetails: "New patient William Brown registered."
    }]
  },
  {
    firstName: "Sarah",
    lastName: "Wilson",
    gender: "Female",
    dateOfBirth: "1988-11-12",
    mobileNumber: "+1-555-0678",
    emailAddress: "sarah.wilson@email.com",
    address: "789 Cedar St, Miami, FL 33101",
    idNumber: "SSN654321098",
    emergencyContactName: "David Wilson",
    emergencyContactNumber: "+1-555-0679",
    idCardType: "Driver's License",
    condition: "Critical" as PatientCondition,
    careNotes: [{
      id: "note6",
      text: "Patient experiencing acute arrhythmia. Continuous cardiac monitoring required.",
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      staffId: 1,
      staffName: "Dr. Wilson"
    }],
    assignedStaffIds: [1, 3],
    admissionDate: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 1,
    reasonForVisit: "Severe chest pain and irregular heartbeat",
    initialObservationsText: "Patient in acute distress, immediate cardiac evaluation needed",
    admissionCondition: "Critical",
    tests: [],
    auditLog: [{
      id: "audit6",
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      staffId: 1,
      staffName: "Dr. Wilson",
      actionType: "Patient Registered",
      changeDetails: "New patient Sarah Wilson registered."
    }]
  },
  {
    firstName: "Michael",
    lastName: "Chen",
    gender: "Male",
    dateOfBirth: "1970-06-25",
    mobileNumber: "+1-555-0789",
    emailAddress: "michael.chen@email.com",
    address: "456 Birch Ave, San Francisco, CA 94102",
    idNumber: "SSN098765432",
    emergencyContactName: "Lisa Chen",
    emergencyContactNumber: "+1-555-0790",
    idCardType: "Passport",
    condition: "Medium" as PatientCondition,
    careNotes: [{
      id: "note7",
      text: "Hypertension management, medication adjustment needed. Blood pressure stabilizing.",
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 2,
      staffName: "Dr. Johnson"
    }],
    assignedStaffIds: [2],
    admissionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 2,
    reasonForVisit: "High blood pressure and chest discomfort",
    initialObservationsText: "Elevated blood pressure readings, patient stable",
    admissionCondition: "Stable",
    tests: [],
    auditLog: [{
      id: "audit7",
      timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 2,
      staffName: "Dr. Johnson",
      actionType: "Patient Registered",
      changeDetails: "New patient Michael Chen registered."
    }]
  },
  {
    firstName: "Jessica",
    lastName: "Taylor",
    gender: "Female",
    dateOfBirth: "1995-02-14",
    mobileNumber: "+1-555-0891",
    emailAddress: "jessica.taylor@email.com",
    address: "123 Willow St, Boston, MA 02101",
    idNumber: "SSN567890123",
    emergencyContactName: "Mark Taylor",
    emergencyContactNumber: "+1-555-0892",
    idCardType: "State ID",
    condition: "Low" as PatientCondition,
    careNotes: [{
      id: "note8",
      text: "Young patient with occasional palpitations. Stress-related symptoms, monitoring vitals.",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 3,
      staffName: "Dr. Brown"
    }],
    assignedStaffIds: [3],
    admissionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 3,
    reasonForVisit: "Heart palpitations and fatigue",
    initialObservationsText: "Patient anxious but vital signs stable",
    admissionCondition: "Stable",
    tests: [],
    auditLog: [{
      id: "audit8",
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 3,
      staffName: "Dr. Brown",
      actionType: "Patient Registered",
      changeDetails: "New patient Jessica Taylor registered."
    }]
  },
  {
    firstName: "David",
    lastName: "Martinez",
    gender: "Male",
    dateOfBirth: "1960-08-03",
    mobileNumber: "+1-555-0902",
    emailAddress: "david.martinez@email.com",
    address: "987 Palm St, Los Angeles, CA 90210",
    idNumber: "SSN234567890",
    emergencyContactName: "Carmen Martinez",
    emergencyContactNumber: "+1-555-0903",
    idCardType: "Driver's License",
    condition: "Medium" as PatientCondition,
    careNotes: [{
      id: "note9",
      text: "Post-operative monitoring after stent placement. Recovery progressing well.",
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      staffId: 1,
      staffName: "Dr. Wilson"
    }],
    assignedStaffIds: [1, 2],
    admissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 1,
    reasonForVisit: "Follow-up after cardiac stent procedure",
    initialObservationsText: "Post-operative patient, vital signs stable",
    admissionCondition: "Stable",
    tests: [],
    auditLog: [{
      id: "audit9",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      staffId: 1,
      staffName: "Dr. Wilson",
      actionType: "Patient Registered",
      changeDetails: "New patient David Martinez registered."
    }]
  },
  {
    firstName: "Amanda",
    lastName: "Rodriguez",
    gender: "Female",
    dateOfBirth: "1982-01-28",
    mobileNumber: "+1-555-1013",
    emailAddress: "amanda.rodriguez@email.com",
    address: "555 Oak Ridge Dr, Atlanta, GA 30301",
    idNumber: "SSN345678901",
    emergencyContactName: "Luis Rodriguez",
    emergencyContactNumber: "+1-555-1014",
    idCardType: "State ID",
    condition: "Unassigned" as PatientCondition,
    careNotes: [{
      id: "note10",
      text: "New admission pending initial cardiac assessment. Preliminary vitals taken.",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      staffId: 3,
      staffName: "Dr. Brown"
    }],
    assignedStaffIds: [],
    admissionDate: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    referredDoctorId: 3,
    reasonForVisit: "Chest pain and dizziness episodes",
    initialObservationsText: "Patient alert and oriented, awaiting full evaluation",
    admissionCondition: "Undetermined",
    tests: [],
    auditLog: [{
      id: "audit10",
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      staffId: 3,
      staffName: "Dr. Brown",
      actionType: "Patient Registered",
      changeDetails: "New patient Amanda Rodriguez registered."
    }]
  }
];

export function addDummyPatients(): void {
  try {
    const existingPatients = localStorage.getItem('patients');
    let patients: Patient[] = existingPatients ? JSON.parse(existingPatients) : [];

    // Get next patient ID
    const nextPatientNumber = localStorage.getItem('nextPatientNumber');
    let currentId = nextPatientNumber ? parseInt(nextPatientNumber) : 1;

    // Add dummy patients with sequential IDs
    const newPatients: Patient[] = DUMMY_PATIENTS.map(patientData => ({
      ...patientData,
      id: currentId++
    }));

    // Merge with existing patients (avoid duplicates by checking names)
    newPatients.forEach(newPatient => {
      const exists = patients.some(p => 
        p.firstName === newPatient.firstName && 
        p.lastName === newPatient.lastName
      );
      if (!exists) {
        patients.push(newPatient);
      }
    });

    // Save to localStorage
    localStorage.setItem('patients', JSON.stringify(patients));
    localStorage.setItem('nextPatientNumber', currentId.toString());

    console.log(`Added ${newPatients.length} dummy patients to localStorage`);
  } catch (error) {
    console.error('Error adding dummy patients:', error);
  }
}

import { StaffMember } from '../types/staff';
export const dummyStaffMembers: StaffMember[] = [
  {
    id: 0,
    name: "System Administrator", 
    role: "Super Admin",
    email: "superadmin@hospital.com",
    phoneNumber: "+1000000000",
    department: "Administration",
    isActive: true,
    dateJoined: "2023-01-01"
  },
  {
    id: 1,
    name: "Dr. Sarah Johnson",
    role: "Doctor",
    email: "sarah.johnson@hospital.com",
    phoneNumber: "+1234567890",
    department: "Cardiology",
    isActive: true,
    dateJoined: "2023-01-15"
  },
  {
    id: 2,
    name: "Nurse Emily White",
    role: "Nurse",
    email: "emily.white@hospital.com",
    phoneNumber: "+1987654321",
    department: "Cardiology",
    isActive: true,
    dateJoined: "2023-02-01"
  },
  {
    id: 3,
    name: "Receptionist Tom Hanks",
    role: "Receptionist",
    email: "tom.hanks@hospital.com",
    phoneNumber: "+1122334455",
    department: "Front Desk",
    isActive: true,
    dateJoined: "2023-03-10"
  },
  {
    id: 4,
    name: "Dr. Michael Brown",
    role: "Doctor",
    email: "michael.brown@hospital.com",
    phoneNumber: "+15556667777",
    department: "Neurology",
    isActive: true,
    dateJoined: "2023-04-01"
  },
  {
    id: 5,
    name: "Nurse Ashley Green",
    role: "Nurse",
    email: "ashley.green@hospital.com",
    phoneNumber: "+11112223333",
    department: "Neurology",
    isActive: true,
    dateJoined: "2023-05-01"
  },
  {
    id: 6,
    name: "Admin John Doe",
    role: "Admin",
    email: "john.doe@hospital.com",
    phoneNumber: "+14445556666",
    department: "Administration",
    isActive: true,
    dateJoined: "2023-06-01"
  },
];