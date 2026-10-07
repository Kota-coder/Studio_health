export interface ReferringDoctor {
  id: number;
  name: string;
  location: string; // Hospital / clinic name
  phoneNumber?: string;
  email?: string;
  specialization?: string;
  createdAt?: string; // Set by the database
}
