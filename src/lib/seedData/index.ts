import { SEED_PATIENTS } from './patients';
import { SEED_STAFF } from './staff';
import { SEED_MEDICATIONS } from './medications';
import { SEED_REFERRING_DOCTORS } from './referringDoctors';
import { SEED_BILLS } from './bills';

export interface SeedDataConfig {
  clearExisting?: boolean;
  includePatients?: boolean;
  includeStaff?: boolean;
  includeMedications?: boolean;
  includeReferringDoctors?: boolean;
  includeBills?: boolean;
}

const DEFAULT_CONFIG: SeedDataConfig = {
  clearExisting: true,
  includePatients: true,
  includeStaff: true,
  includeMedications: true,
  includeReferringDoctors: true,
  includeBills: true
};

/**
 * Initialize the application with comprehensive seed data
 * This will populate localStorage with sample data for testing and demonstration
 */
export function initializeSeedData(config: SeedDataConfig = DEFAULT_CONFIG): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Clear existing data if requested
    if (finalConfig.clearExisting) {
      console.log('Clearing existing data...');
      if (finalConfig.includePatients) localStorage.removeItem('patients');
      if (finalConfig.includeStaff) localStorage.removeItem('staff');
      if (finalConfig.includeMedications) localStorage.removeItem('medications');
      if (finalConfig.includeReferringDoctors) localStorage.removeItem('referringDoctors');
      if (finalConfig.includeBills) localStorage.removeItem('bills');
    }

    // Load seed data
    if (finalConfig.includePatients) {
      console.log(`Loading ${SEED_PATIENTS.length} patients...`);
      localStorage.setItem('patients', JSON.stringify(SEED_PATIENTS));
    }

    if (finalConfig.includeStaff) {
      console.log(`Loading ${SEED_STAFF.length} staff members...`);
      localStorage.setItem('staff', JSON.stringify(SEED_STAFF));
    }

    if (finalConfig.includeMedications) {
      console.log(`Loading ${SEED_MEDICATIONS.length} medications...`);
      localStorage.setItem('medications', JSON.stringify(SEED_MEDICATIONS));
    }

    if (finalConfig.includeReferringDoctors) {
      console.log(`Loading ${SEED_REFERRING_DOCTORS.length} referring doctors...`);
      localStorage.setItem('referringDoctors', JSON.stringify(SEED_REFERRING_DOCTORS));
    }

    if (finalConfig.includeBills) {
      console.log(`Loading ${SEED_BILLS.length} bills...`);
      localStorage.setItem('bills', JSON.stringify(SEED_BILLS));
    }

    console.log('✅ Seed data initialized successfully!');
    console.log('📊 Summary:');
    if (finalConfig.includePatients) console.log(`   - ${SEED_PATIENTS.length} patients with care notes, tests, and attachments`);
    if (finalConfig.includeStaff) console.log(`   - ${SEED_STAFF.length} staff members`);
    if (finalConfig.includeMedications) console.log(`   - ${SEED_MEDICATIONS.length} medications`);
    if (finalConfig.includeReferringDoctors) console.log(`   - ${SEED_REFERRING_DOCTORS.length} referring doctors`);
    if (finalConfig.includeBills) console.log(`   - ${SEED_BILLS.length} bills`);
  } catch (error) {
    console.error('❌ Error initializing seed data:', error);
    throw error;
  }
}

/**
 * Clear all application data from localStorage
 */
export function clearAllData(): void {
  console.log('Clearing all application data...');
  localStorage.removeItem('patients');
  localStorage.removeItem('staff');
  localStorage.removeItem('medications');
  localStorage.removeItem('referringDoctors');
  localStorage.removeItem('bills');
  console.log('✅ All data cleared!');
}

/**
 * Get a summary of current data in localStorage
 */
export function getDataSummary(): { [key: string]: number } {
  const summary: { [key: string]: number } = {};
  
  try {
    const patients = JSON.parse(localStorage.getItem('patients') || '[]');
    summary.patients = Array.isArray(patients) ? patients.length : 0;
  } catch { summary.patients = 0; }

  try {
    const staff = JSON.parse(localStorage.getItem('staff') || '[]');
    summary.staff = Array.isArray(staff) ? staff.length : 0;
  } catch { summary.staff = 0; }

  try {
    const medications = JSON.parse(localStorage.getItem('medications') || '[]');
    summary.medications = Array.isArray(medications) ? medications.length : 0;
  } catch { summary.medications = 0; }

  try {
    const referringDoctors = JSON.parse(localStorage.getItem('referringDoctors') || '[]');
    summary.referringDoctors = Array.isArray(referringDoctors) ? referringDoctors.length : 0;
  } catch { summary.referringDoctors = 0; }

  try {
    const bills = JSON.parse(localStorage.getItem('bills') || '[]');
    summary.bills = Array.isArray(bills) ? bills.length : 0;
  } catch { summary.bills = 0; }

  return summary;
}

// Export seed data for direct access if needed
export {
  SEED_PATIENTS,
  SEED_STAFF,
  SEED_MEDICATIONS,
  SEED_REFERRING_DOCTORS,
  SEED_BILLS
};
