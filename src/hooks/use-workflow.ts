"use client";

import { useMemo } from 'react';
import { useBranding } from '@/components/branding-provider';
import { mayOpenPage, type PageKey } from '@/config/permissions';
import { isResponsible, type Duty } from '@/config/responsibilities';
import { useStaff } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import type { BillType } from '@/types/billing';

// Who does what, by department (src/config/responsibilities.ts). With Lab Requests on, the
// clinical staff request tests and the laboratory records and bills them; with Pharmacy Orders
// on, they send medicines to the pharmacy, which dispenses, bills and takes payment for them;
// Billing & Payments takes payment for everything else. With a feature off, staff record tests
// and bill medicines directly, as before. The database enforces the same (responsible()).
export function useWorkflow() {
  const { isOn } = useFeatures();
  const { role } = useStaff();
  const { profile } = useBranding();
  const config = profile.responsibilities;
  const pageAccess = profile.pageAccess;
  return useMemo(() => {
    const can = (duty: Duty) => isResponsible(duty, role, config);
    const labOn = isOn('labRequests');
    const pharmacyOn = isOn('pharmacyOrders');
    const billingOn = isOn('billing');
    // Mirrors the database's can_see_bills(): the Billing page's roles, and whoever does the
    // work that creates or settles bills.
    const seesBills = mayOpenPage('billing', role, pageAccess) || (['performTests', 'dispense', 'collectPayments', 'collectPharmacy'] as Duty[]).some(can);
    return {
      can,
      canOpenPage: (page: PageKey) => mayOpenPage(page, role, pageAccess),
      canSeeBills: billingOn && seesBills,
      labOn,
      pharmacyOn,
      canRequest: can('requestTests'),
      canSendToPharmacy: can('sendToPharmacy'),
      canProcessLab: !labOn || can('performTests'),
      canProcessPharmacy: !pharmacyOn || can('dispense'),
      // Taking payment for a bill of this type.
      canCollect: (billType: BillType | string) => billingOn && (billType === 'Pharmacy' && pharmacyOn ? can('collectPharmacy') : can('collectPayments')),
    };
  }, [isOn, role, config, pageAccess]);
}
