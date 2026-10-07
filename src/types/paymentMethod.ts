// A way money is received (bills) or paid out (payments), managed by the Super Admin
// under Organization Setup → Payment Methods.
export type PaymentMethodUse = 'Both' | 'Bills' | 'Payments';

export interface PaymentMethodOption {
  id: number;
  name: string;
  usedFor: PaymentMethodUse;
  active: boolean;
  sortOrder: number;
  createdAt?: string;
}

// The active methods offered for bills or payments, keeping `current` (e.g. a method since
// switched off) so an existing record still shows its value.
export function methodChoices(all: PaymentMethodOption[], use: 'Bills' | 'Payments', current?: string): string[] {
  const names = all.filter(m => m.active && (m.usedFor === 'Both' || m.usedFor === use)).map(m => m.name);
  return current && !names.includes(current) ? [...names, current] : names;
}
