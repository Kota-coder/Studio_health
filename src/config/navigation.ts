// Every page in the app: where it sits in the menu, who may open it (PAGE_ROLES, which the
// database also enforces) and which switchable feature it belongs to (src/config/modules.ts).
// The menu, the page guard (components/page-guard.tsx) and the page titles all come from here.
import {
  AreaChart, Boxes, Building2, CalendarClock, ClipboardPlus, CreditCard, Database, FileText, FlaskConical, Microscope,
  HeartHandshake, Hospital, LayoutDashboard, Package, Pill, Receipt, Truck, Users, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PAGE_ROLES } from '@/config/permissions';
import type { StaffRole } from '@/types/staff';

export const NAV_SECTIONS = ['Patients', 'Money', 'Pharmacy & Stock', 'Staff', 'Setup'] as const;
export type NavSection = (typeof NAV_SECTIONS)[number];

export interface NavItem {
  href: string;
  label: string; // English; shown through t() (src/lib/i18n)
  icon: LucideIcon;
  section: NavSection;
  roles: readonly StaffRole[];
  module?: string; // switchable feature (src/config/modules.ts)
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Patient Dashboard', icon: LayoutDashboard, section: 'Patients', roles: PAGE_ROLES.dashboard },
  { href: '/patients/new', label: 'Register Patient', icon: ClipboardPlus, section: 'Patients', roles: PAGE_ROLES.dashboard },
  { href: '/lab', label: 'Lab Requests', icon: Microscope, section: 'Patients', roles: PAGE_ROLES.lab, module: 'labRequests' },
  { href: '/referring-doctors', label: 'Referring Doctors', icon: HeartHandshake, section: 'Patients', roles: PAGE_ROLES.referringDoctors, module: 'referringDoctors' },

  { href: '/billing', label: 'Billing', icon: CreditCard, section: 'Money', roles: PAGE_ROLES.billing, module: 'billing' },
  { href: '/payments', label: 'Payments', icon: Receipt, section: 'Money', roles: PAGE_ROLES.payments, module: 'payments' },
  { href: '/financial-dashboard', label: 'Financial Dashboard', icon: AreaChart, section: 'Money', roles: PAGE_ROLES.financialDashboard, module: 'financialDashboard' },

  { href: '/inventory', label: 'Inventory', icon: Boxes, section: 'Pharmacy & Stock', roles: PAGE_ROLES.inventory, module: 'inventory' },
  { href: '/pharmacy', label: 'Pharmacy', icon: Pill, section: 'Pharmacy & Stock', roles: PAGE_ROLES.medications, module: 'medications' },
  { href: '/materials', label: 'Materials', icon: Package, section: 'Pharmacy & Stock', roles: PAGE_ROLES.materials, module: 'materials' },
  { href: '/vendors', label: 'Vendors', icon: Truck, section: 'Pharmacy & Stock', roles: PAGE_ROLES.vendors, module: 'vendors' },

  { href: '/duty', label: 'Duty Roster & Attendance', icon: CalendarClock, section: 'Staff', roles: PAGE_ROLES.duty, module: 'duty' },
  { href: '/staff', label: 'Staff', icon: Users, section: 'Staff', roles: PAGE_ROLES.staff },
  { href: '/departments', label: 'Departments', icon: Building2, section: 'Staff', roles: PAGE_ROLES.departments, module: 'departments' },

  { href: '/hospital-profile', label: 'Hospital Profile', icon: Hospital, section: 'Setup', roles: PAGE_ROLES.hospitalProfile },
  { href: '/payment-methods', label: 'Payment Methods', icon: Wallet, section: 'Setup', roles: PAGE_ROLES.paymentMethods, module: 'paymentMethods' },
  { href: '/medical-tests', label: 'Medical Tests', icon: FlaskConical, section: 'Setup', roles: PAGE_ROLES.medicalTests, module: 'medicalTests' },
  { href: '/patient-care', label: 'Care Note Templates', icon: FileText, section: 'Setup', roles: PAGE_ROLES.patientCare, module: 'patientCare' },
  { href: '/admin', label: 'Sample Data', icon: Database, section: 'Setup', roles: PAGE_ROLES.admin, module: 'sampleData' },
];

// Pages not in the menu that belong to another page's audience (forms, prints, patient pages).
const OTHER_PAGES: Array<{ prefix: string; roles: readonly StaffRole[] }> = [
  { prefix: '/patients', roles: PAGE_ROLES.dashboard },
];

// Who may open a page: the most specific matching prefix wins (e.g. /billing/print uses
// /billing's roles). Unknown pages are open to any signed-in staff member.
export function rolesForPath(pathname: string): readonly StaffRole[] | null {
  const candidates = [
    ...NAV_ITEMS.map(item => ({ prefix: item.href, roles: item.roles })),
    ...OTHER_PAGES,
  ].filter(c => pathname === c.prefix || pathname.startsWith(`${c.prefix}/`));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.prefix.length - a.prefix.length)[0].roles;
}

export const navItemForPath = (pathname: string) =>
  NAV_ITEMS.filter(i => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
