import type { AuditLogEntry } from '@/types/patient';
import type { StaffMember } from '@/types/staff';

/**
 * Returns a copy of `record` with a new audit log entry appended.
 * Shared by patients, bills and payments so every module logs changes the same way.
 */
export function addAuditLogEntry<T extends { auditLog?: AuditLogEntry[] }>(
  record: T,
  actionType: string,
  changeDetails: string,
  currentUser: StaffMember | null
): T {
  if (!currentUser) return record;

  const newLogEntry: AuditLogEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    staffId: currentUser.id,
    staffName: currentUser.name,
    actionType,
    changeDetails,
  };

  return {
    ...record,
    auditLog: [...(record.auditLog || []), newLogEntry],
  };
}
