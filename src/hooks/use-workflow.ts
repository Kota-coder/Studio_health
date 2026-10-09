"use client";

import { LAB_ROLES, PHARMACY_ROLES, REQUEST_ROLES } from '@/config/permissions';
import { useStaff } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';

// Who does what with tests and medicines on the patient page. With Lab Requests on, doctors
// and nurses request tests and the lab records and bills them; with Pharmacy Orders on, they
// send medicines to the pharmacy, which dispenses and bills them. With a feature off, staff
// record tests and bill medicines directly, as before.
export function useWorkflow() {
  const { isOn } = useFeatures();
  const { role } = useStaff();
  const labOn = isOn('labRequests');
  const pharmacyOn = isOn('pharmacyOrders');
  return {
    labOn,
    pharmacyOn,
    canRequest: REQUEST_ROLES.includes(role),
    canProcessLab: !labOn || LAB_ROLES.includes(role),
    canProcessPharmacy: !pharmacyOn || PHARMACY_ROLES.includes(role),
  };
}
