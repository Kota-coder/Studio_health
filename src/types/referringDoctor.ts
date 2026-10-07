
export interface ReferringDoctor {
  id: number;
  name: string;
  location: string;
  phoneNumber?: string;
  contactNumber?: string;
  email?: string;
  specialization?: string;
  notes?: string;
  createdAt?: string; // Set by the database
  auditLog?: Array<{
    id: string;
    timestamp: string;
    staffId: string;
    staffName: string;
    actionType: string;
    changeDetails: string;
  }>;
}
