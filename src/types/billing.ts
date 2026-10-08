
export type { AuditLogEntry } from './patient';

import type { AuditLogEntry } from './patient'; // Import AuditLogEntry

export interface BillItem {
  id: string; // Unique ID for the item row
  description: string;
  quantity: number;
  unitPrice: number; // This will be the final, offered price.
  originalUnitPrice?: number; // The suggested list price from medication master.
  total: number; // Calculated: quantity * unitPrice
  medicationId?: string; // Pharmacy bills: the pharmacy item sold (takes it out of stock)
}

// The name of one of the managed payment methods (payment_methods table), e.g. "Cash", "UPI".
export type PaymentMethod = string;
export type PaymentStatus = "Paid" | "Unpaid" | "Partially Paid" | "Cancelled"; // Changed "Pending" to "Cancelled"
export type BillType = "Pharmacy" | "Treatment" | "";

export interface Bill {
  id: string; // Unique bill ID (e.g., BILL-001)
  patientId: number;
  patientName: string; // Denormalized for easier display
  billDate: string; // ISO string or dd/MM/yyyy
  billType: BillType;
  items: BillItem[];
  totalAmount: number; // Sum of all item totals
  paymentMethod: PaymentMethod | "";
  paymentStatus: PaymentStatus | "";
  notes?: string;
  createdAt: string; // ISO string for when the bill was created/saved
  auditLog: AuditLogEntry[];
  attachments?: string[]; // Storage paths in the patient-files bucket (data: URLs only before upload)
  paymentDate?: string; // dd/MM/yyyy format
  // Who processed the bill. Set to whoever creates it; only the Super Admin can choose someone else.
  processedByStaffId?: number | null;
  processedByStaffName?: string | null; // Filled in by the database from the staff record
}
