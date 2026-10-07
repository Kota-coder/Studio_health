export interface ReferringDoctor {
  id: number;
  name: string;
  location: string; // Hospital / clinic name
  phoneNumber?: string;
  email?: string;
  specialization?: string;
  notes?: string;
  defaultReferralFee?: number | null; // Suggested fixed referral fee per referred patient
  defaultReferralPercent?: number | null; // Suggested % of billed procedures, used instead of the fixed fee when set
  createdAt?: string; // Set by the database
}
