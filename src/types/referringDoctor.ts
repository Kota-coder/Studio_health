
export interface ReferringDoctor {
  id: number;
  name: string;
  location: string;
  contactNumber?: string;
  email?: string;
  specialization?: string;
  notes?: string;
  createdAt: string;
  auditLog?: Array<{
    id: string;
    timestamp: string;
    staffId: string;
    staffName: string;
    actionType: string;
    changeDetails: string;
  }>;
}
