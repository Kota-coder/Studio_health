/**
 * Single source of truth for the localStorage keys shared between modules.
 * Every page that reads or writes a collection must use these keys so that
 * patients, staff, bills, payments and catalogs stay connected.
 */
export const STORAGE_KEYS = {
  patients: 'patients',
  staffMembers: 'staffMembers',
  currentUser: 'currentUser',
  bills: 'bills',
  payments: 'paymentsData',
  medications: 'medicationsData',
  materials: 'materialsData',
  vendors: 'materialVendorsData',
  referringDoctors: 'referringDoctorsData',
  medicalTestCatalog: 'medicalTestCatalog',
  treatmentTemplates: 'userDefinedTreatmentTemplates',
  nextPatientNumber: 'nextPatientNumber',
  nextStaffId: 'nextStaffId',
  nextBillIdNumber: 'nextBillIdNumber',
  nextPaymentIdNumber: 'nextPaymentIdNumber',
  nextReferringDoctorId: 'nextReferringDoctorId',
  nextMedicationId: 'nextMedicationId',
  nextMaterialId: 'nextMaterialId',
  nextVendorId: 'nextVendorId',
  nextMedicalTestCatalogId: 'nextMedicalTestCatalogId',
  nextTreatmentTemplateId: 'nextTreatmentTemplateId',
  passwordResetVerification: 'passwordResetVerification',
} as const;

/**
 * Returns the next free numeric id for a collection and advances its counter.
 * Never returns an id that is already used, even if the counter fell behind
 * (for example after seed data was loaded).
 */
export function takeNextNumericId(counterKey: string, existing: Array<{ id: unknown }>): number {
  const counter = parseInt(localStorage.getItem(counterKey) || '1', 10) || 1;
  const maxExisting = existing.reduce((max, item) => {
    const n = typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  const id = Math.max(counter, maxExisting + 1);
  localStorage.setItem(counterKey, String(id + 1));
  return id;
}
