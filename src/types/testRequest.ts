// A test asked for from the patient page, waiting for (or being done by) a lab technician.
export type TestRequestStatus = 'Requested' | 'In progress' | 'Done' | 'Cancelled';
export type TestRequestPriority = 'Routine' | 'Urgent';

export interface TestRequest {
  id: string;
  patientId: number;
  testTypeId: string;
  testTypeName: string;
  priority: TestRequestPriority;
  notes?: string;
  status: TestRequestStatus;
  requestedByStaffId?: number;
  requestedByStaffName?: string;
  assignedToStaffId?: number; // empty: waiting in the queue for any technician
  assignedToStaffName?: string;
  testId?: string; // the recorded result
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  patientName?: string; // filled in by the lab queue
}

export interface LabTechnician {
  id: number;
  name: string;
  onDuty: boolean;
  openRequests: number;
}

export const isOpenRequest = (r: Pick<TestRequest, 'status'>) => r.status === 'Requested' || r.status === 'In progress';
