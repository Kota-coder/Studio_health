export interface ReferringDoctor {
  id: number;
  name: string;
  location: string; // Hospital / clinic name
  phoneNumber?: string;
  email?: string;
  specialization?: string;
  notes?: string;
  defaultReferralFee?: number | null; // Suggested referral fee per referred patient
  createdAt?: string; // Set by the database
}
