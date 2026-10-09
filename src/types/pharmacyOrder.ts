// Medicines prescribed on the patient page and sent to the pharmacy, which dispenses and
// bills them (Pharmacy Orders feature).
export type PharmacyOrderStatus = 'Requested' | 'Dispensed' | 'Cancelled';

export interface PharmacyOrderItem {
  medicationId: string;
  medicationName: string;
  dosage?: string;
  quantity?: number; // set by the pharmacy when dispensing
}

export interface PharmacyOrder {
  id: string;
  patientId: number;
  careNoteId?: string;
  items: PharmacyOrderItem[];
  notes?: string;
  status: PharmacyOrderStatus;
  requestedByStaffId?: number;
  requestedByStaffName?: string;
  dispensedByStaffName?: string;
  dispensedAt?: string;
  billId?: string;
  createdAt: string;
  patientName?: string; // filled in by the pharmacy queue
  bill?: { id: string; status: string; amount: number };
}
