
import type { AuditLogEntry } from './patient';

export type PaymentType = "Referral/CC" | "Material" | "Pharmacy" | "Salary" | "Doctor Fee" | "Other" | "";
export type PaymentMethodSpent = "Cash" | "Cheque" | "Bank Transfer" | "UPI" | "Card" | "Other" | "";

export interface PurchasedMedicationItem {
  medicationId: string;
  medicationName: string;
  quantityPurchased: number;
  unitPriceAtPurchase?: number; // Price paid per unit for this specific purchase
  listPriceSnapshot?: number; // Snapshot of the medication's list price at time of entry
}

export interface PurchasedMaterialItem {
  materialId: string;
  materialName: string;
  quantityPurchased: number;
  unitPriceAtPurchase?: number; // Price paid per unit for this specific purchase
  listPriceSnapshot?: number; // Snapshot of the material's list price at time of entry
}

export interface Payment {
  id: string; // Unique payment ID (e.g., PAY-001)
  paymentDate: string; // dd/MM/yyyy
  paymentType: PaymentType;
  
  // Payee details - conditional based on paymentType
  payeeId?: string | number; // ID of ReferringDoctor or StaffMember or Vendor
  payeeName?: string; // Name of ReferringDoctor, StaffMember, Vendor or custom payee
  payeeType?: "ReferringDoctor" | "StaffMember" | "Vendor" | "Other";
  associatedPatientIds?: number[]; // Patients this payment covers (referral cases, or the cases a Doctor Fee pays for)

  description: string;
  amount: number; // Total amount of the payment
  paymentMethod: PaymentMethodSpent;
  transactionId?: string;
  notes?: string;
  
  purchasedMedications?: PurchasedMedicationItem[]; // For Pharmacy payment type
  purchasedMaterials?: PurchasedMaterialItem[]; // For Material payment type

  recordedByStaffId: number;
  recordedByStaffName: string;
  createdAt: string; // ISO string for when the payment record was created
  auditLog?: AuditLogEntry[];
}
