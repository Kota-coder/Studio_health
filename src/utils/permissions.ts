
import { StaffRole } from '@/types/staff';

export const hasDeletePermission = (userRole: StaffRole): boolean => {
  return userRole === "Super Admin";
};

export const hasEditPermission = (userRole: StaffRole): boolean => {
  return ["Super Admin", "Admin", "Doctor", "Nurse"].includes(userRole);
};

export const hasReadPermission = (userRole: StaffRole): boolean => {
  return ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist"].includes(userRole);
};

export const canAccessFinancials = (userRole: StaffRole): boolean => {
  return ["Super Admin", "Admin", "Doctor"].includes(userRole);
};

export const canManageStaff = (userRole: StaffRole): boolean => {
  return ["Super Admin", "Admin", "Doctor"].includes(userRole);
};
