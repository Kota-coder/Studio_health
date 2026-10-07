import { SEED_PATIENTS } from './patients';
import { SEED_STAFF } from './staff';
import { SEED_MEDICATIONS } from './medications';
import { SEED_REFERRING_DOCTORS } from './referringDoctors';
import { SEED_BILLS } from './bills';
import { STORAGE_KEYS } from '@/lib/storage';
import type { StaffMember } from '@/types/staff';

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

// Everything the app stores, used by "clear all data".
const ALL_APP_KEYS = Object.values(STORAGE_KEYS).filter(key => key !== STORAGE_KEYS.currentUser);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/;
const DMY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seed records are dated around Oct 2025. Shift every activity date (not birth
 * dates) forward so the newest record lands on today; otherwise the dashboards,
 * which show the last few months, look empty.
 */
function shiftSeedDates<T>(value: T, offsetMs: number): T {
  if (typeof value === 'string') {
    const iso = value.match(ISO_DATE);
    if (iso && Number(iso[1]) >= 2020) {
      const shifted = new Date(new Date(iso[4] ? value : `${value}T00:00:00.000Z`).getTime() + offsetMs);
      return (iso[4] ? shifted.toISOString() : shifted.toISOString().slice(0, 10)) as T;
    }
    const dmy = value.match(DMY_DATE);
    if (dmy && Number(dmy[3]) >= 2020) {
      const shifted = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) + offsetMs);
      const dd = String(shifted.getUTCDate()).padStart(2, '0');
      const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${shifted.getUTCFullYear()}` as T;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(v => shiftSeedDates(v, offsetMs)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, shiftSeedDates(v, offsetMs)])
    ) as T;
  }
  return value;
}

function seedDateOffsetMs(): number {
  const latest = SEED_BILLS.reduce((max, bill) => Math.max(max, Date.parse(bill.createdAt) || 0), 0);
  if (!latest) return 0;
  // Whole days only, so dd/MM/yyyy and ISO dates move together.
  return Math.max(0, Math.floor((Date.now() - latest) / DAY_MS)) * DAY_MS;
}

function maxNumericId(items: Array<{ id: unknown }>): number {
  return items.reduce((max, item) => {
    const n = parseInt(String(item.id).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

/**
 * Initialize the application with comprehensive seed data
 * This will populate localStorage with sample data for testing and demonstration
 */
export function initializeSeedData(config: SeedDataConfig = DEFAULT_CONFIG): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const offset = seedDateOffsetMs();
  // Read before clearing so accounts that are not part of the seed (e.g. the logged-in admin) survive.
  const existingStaff: StaffMember[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.staffMembers) || '[]');

  try {
    if (finalConfig.clearExisting) {
      if (finalConfig.includePatients) localStorage.removeItem(STORAGE_KEYS.patients);
      if (finalConfig.includeStaff) localStorage.removeItem(STORAGE_KEYS.staffMembers);
      if (finalConfig.includeMedications) localStorage.removeItem(STORAGE_KEYS.medications);
      if (finalConfig.includeReferringDoctors) localStorage.removeItem(STORAGE_KEYS.referringDoctors);
      if (finalConfig.includeBills) localStorage.removeItem(STORAGE_KEYS.bills);
    }

    // Each collection also sets its id counter past the seeded ids, so records
    // created afterwards never overwrite a seeded one.
    if (finalConfig.includePatients) {
      localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(shiftSeedDates(SEED_PATIENTS, offset)));
      localStorage.setItem(STORAGE_KEYS.nextPatientNumber, String(maxNumericId(SEED_PATIENTS) + 1));
    }

    if (finalConfig.includeStaff) {
      const seededEmails = new Set(SEED_STAFF.map(s => s.email.toLowerCase()));
      const seedIds = new Set(SEED_STAFF.map(s => s.id));
      let nextId = maxNumericId([...SEED_STAFF, ...existingStaff]) + 1;
      const kept = existingStaff
        .filter(s => !s.email || !seededEmails.has(s.email.toLowerCase()))
        .map(s => (seedIds.has(s.id) ? { ...s, id: nextId++ } : s));
      const staff = [...shiftSeedDates(SEED_STAFF, offset), ...kept];
      // If the logged-in user was renumbered, keep their session pointing at their own record.
      const currentUser: StaffMember | null = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentUser) || 'null');
      const self = currentUser && staff.find(s => s.email && s.email.toLowerCase() === currentUser.email?.toLowerCase());
      if (currentUser && self && self.id !== currentUser.id) {
        localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(self));
      }
      localStorage.setItem(STORAGE_KEYS.staffMembers, JSON.stringify(staff));
      localStorage.setItem(STORAGE_KEYS.nextStaffId, String(maxNumericId(staff) + 1));
    }

    if (finalConfig.includeMedications) {
      localStorage.setItem(STORAGE_KEYS.medications, JSON.stringify(SEED_MEDICATIONS));
      localStorage.setItem(STORAGE_KEYS.nextMedicationId, `med_${maxNumericId(SEED_MEDICATIONS) + 1}`);
    }

    if (finalConfig.includeReferringDoctors) {
      localStorage.setItem(STORAGE_KEYS.referringDoctors, JSON.stringify(SEED_REFERRING_DOCTORS));
      localStorage.setItem(STORAGE_KEYS.nextReferringDoctorId, String(maxNumericId(SEED_REFERRING_DOCTORS) + 1));
    }

    if (finalConfig.includeBills) {
      localStorage.setItem(STORAGE_KEYS.bills, JSON.stringify(shiftSeedDates(SEED_BILLS, offset)));
      localStorage.setItem(STORAGE_KEYS.nextBillIdNumber, String(maxNumericId(SEED_BILLS) + 1));
    }
  } catch (error) {
    console.error('Error initializing seed data:', error);
    throw error;
  }
}

/**
 * Clear all application data from localStorage (the logged-in session is kept)
 */
export function clearAllData(): void {
  ALL_APP_KEYS.forEach(key => localStorage.removeItem(key));
}

/**
 * Get a summary of current data in localStorage
 */
export function getDataSummary(): { [key: string]: number } {
  const count = (key: string) => {
    try {
      const items = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(items) ? items.length : 0;
    } catch {
      return 0;
    }
  };

  return {
    patients: count(STORAGE_KEYS.patients),
    staff: count(STORAGE_KEYS.staffMembers),
    medications: count(STORAGE_KEYS.medications),
    referringDoctors: count(STORAGE_KEYS.referringDoctors),
    bills: count(STORAGE_KEYS.bills),
    payments: count(STORAGE_KEYS.payments),
  };
}

// Export seed data for direct access if needed
export {
  SEED_PATIENTS,
  SEED_STAFF,
  SEED_MEDICATIONS,
  SEED_REFERRING_DOCTORS,
  SEED_BILLS
};
