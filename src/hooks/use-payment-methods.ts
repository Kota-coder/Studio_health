"use client";

import { useEffect, useState } from 'react';
import { paymentMethods as paymentMethodsRepo } from '@/lib/data';
import type { PaymentMethodOption } from '@/types/paymentMethod';

// The managed payment methods (cached; see lib/data/cache.ts).
export function usePaymentMethods(): PaymentMethodOption[] {
  const [methods, setMethods] = useState<PaymentMethodOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    paymentMethodsRepo.list()
      .then(list => { if (!cancelled) setMethods(list); })
      .catch(error => console.error('Could not load payment methods', error));
    return () => { cancelled = true; };
  }, []);
  return methods;
}
