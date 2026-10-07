
export type { AuditLogEntry } from './patient';

import type { AuditLogEntry } from './patient'; // Import AuditLogEntry

export interface BillItem {
  id: string; // Unique ID for the item row
  description: string;
  quantity: number;
  unitPrice: number; // This will be the final, offered price.
  originalUnitPrice?: number; // The suggested list price from medication master.
  total: number; // Calculated: quantity * unitPrice
}

export type PaymentMethod = "Cash" | "UPI" | "Online/Card" | "Arogyasree" | "Insurance" | "Other";
export type PaymentStatus = "Paid" | "Unpaid" | "Partially Paid" | "Cancelled"; // Changed "Pending" to "Cancelled"
export type BillType = "Pharmacy" | "Treatment" | "Test" | "";

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
  attachmentPath?: string | null; // Object path in the patient-files storage bucket
  paymentDate?: string; // dd/MM/yyyy format
}
