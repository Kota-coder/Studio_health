// UIDAI rules: don't keep full Aadhaar numbers or unmasked card copies. We store
// only the last four digits ("XXXX XXXX 1234") and never upload the card image.

export function isAadhaarCard(idCardType: string | undefined): boolean {
  // Matches the common spellings: Aadhaar, Aadhar, Adhar.
  return !!idCardType && /aa?dh?aa?r/i.test(idCardType);
}

export function maskAadhaarNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return value;
  return `XXXX XXXX ${digits.slice(-4)}`;
}
