// Features that are built but switched off. Flip a flag to true to enable it in
// both the UI and its API route.

// Patient data requests (DPDP Act): Super Admins can download everything held
// about a patient as JSON, or erase it. See /api/patients/[patientId]/data.
export const PATIENT_DATA_REQUESTS_ENABLED = false;
