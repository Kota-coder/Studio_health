// Every page in the app: where it sits in the menu, who may open it (PAGE_ROLES, which the
// database also enforces) and which switchable feature it belongs to (src/config/modules.ts).
// The menu, the page guard (components/page-guard.tsx) and the page titles all come from here.
import {
  AreaChart, Boxes, Building2, CalendarClock, ClipboardPlus, CreditCard, Database, FileText, FlaskConical, Microscope, ClipboardList,
  HeartHandshake, Hospital, LayoutDashboard, Package, Pill, Receipt, Truck, Users, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { mayOpenPage, type PageAccess, type PageKey } from '@/config/permissions';
import type { Duty } from '@/config/responsibilities';
import type { StaffRole } from '@/types/staff';

export const NAV_SECTIONS = ['Patients', 'Money', 'Pharmacy & Stock', 'Staff', 'Setup'] as const;
export type NavSection = (typeof NAV_SECTIONS)[number];

export interface NavItem {
  href: string;
  label: string; // English; shown through t() (src/lib/i18n)
  icon: LucideIcon;
  section: NavSection;
  page: PageKey; // who may open it: PAGE_ROLES[page], or the hospital's own setting
  module?: string; // switchable feature (src/config/modules.ts)
  duties?: Duty[]; // also open to whoever the hospital makes responsible for these (Hospital Profile)
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Patient Dashboard', icon: LayoutDashboard, section: 'Patients', page: 'dashboard' },
  { href: '/patients/new', label: 'Register Patient', icon: ClipboardPlus, section: 'Patients', page: 'dashboard' },
  { href: '/lab', label: 'Lab Requests', icon: Microscope, section: 'Patients', page: 'lab', module: 'labRequests', duties: ['requestTests', 'performTests'] },
  { href: '/referring-doctors', label: 'Referring Doctors', icon: HeartHandshake, section: 'Patients', page: 'referringDoctors', module: 'referringDoctors' },

  { href: '/billing', label: 'Billing', icon: CreditCard, section: 'Money', page: 'billing', module: 'billing', duties: ['collectPayments', 'collectPharmacy'] },
  { href: '/payments', label: 'Payments', icon: Receipt, section: 'Money', page: 'payments', module: 'payments' },
  { href: '/financial-dashboard', label: 'Financial Dashboard', icon: AreaChart, section: 'Money', page: 'financialDashboard', module: 'financialDashboard' },

  { href: '/inventory', label: 'Inventory', icon: Boxes, section: 'Pharmacy & Stock', page: 'inventory', module: 'inventory', duties: ['dispense'] },
  { href: '/pharmacy-orders', label: 'Pharmacy Orders', icon: ClipboardList, section: 'Pharmacy & Stock', page: 'pharmacyOrders', module: 'pharmacyOrders', duties: ['sendToPharmacy', 'dispense', 'collectPharmacy'] },
  { href: '/pharmacy', label: 'Pharmacy', icon: Pill, section: 'Pharmacy & Stock', page: 'medications', module: 'medications' },
  { href: '/materials', label: 'Materials', icon: Package, section: 'Pharmacy & Stock', page: 'materials', module: 'materials' },
  { href: '/vendors', label: 'Vendors', icon: Truck, section: 'Pharmacy & Stock', page: 'vendors', module: 'vendors' },

  { href: '/duty', label: 'Duty Roster & Attendance', icon: CalendarClock, section: 'Staff', page: 'duty', module: 'duty' },
  { href: '/staff', label: 'Staff', icon: Users, section: 'Staff', page: 'staff' },
  { href: '/departments', label: 'Departments', icon: Building2, section: 'Staff', page: 'departments', module: 'departments' },

  { href: '/hospital-profile', label: 'Hospital Profile', icon: Hospital, section: 'Setup', page: 'hospitalProfile' },
  { href: '/payment-methods', label: 'Payment Methods', icon: Wallet, section: 'Setup', page: 'paymentMethods', module: 'paymentMethods' },
  { href: '/medical-tests', label: 'Medical Tests', icon: FlaskConical, section: 'Setup', page: 'medicalTests', module: 'medicalTests' },
  { href: '/patient-care', label: 'Care Note Templates', icon: FileText, section: 'Setup', page: 'patientCare', module: 'patientCare' },
  { href: '/admin', label: 'Sample Data', icon: Database, section: 'Setup', page: 'admin', module: 'sampleData' },
];

// Pages not in the menu that belong to another page's audience (forms, prints, patient pages).
const OTHER_PAGES: Array<{ prefix: string; page: PageKey }> = [
  { prefix: '/patients', page: 'dashboard' },
];

// Who may open a page: the most specific matching prefix wins (e.g. /billing/print uses
// /billing's roles), plus whoever is responsible for one of its duties. Unknown pages are open
// to any signed-in staff member.
export function accessForPath(pathname: string): { page: PageKey; duties?: Duty[] } | null {
  const candidates = [
    ...NAV_ITEMS.map(item => ({ prefix: item.href, page: item.page, duties: item.duties })),
    ...OTHER_PAGES,
  ].filter(c => pathname === c.prefix || pathname.startsWith(`${c.prefix}/`));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.prefix.length - a.prefix.length)[0];
}

export const mayOpen = (access: { page: PageKey; duties?: Duty[] }, role: StaffRole, can: (duty: Duty) => boolean, pageAccess?: PageAccess | null) =>
  mayOpenPage(access.page, role, pageAccess) || !!access.duties?.some(can);

export const navItemForPath = (pathname: string) =>
  NAV_ITEMS.filter(i => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
