
"use client";

import { AuthProvider, useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu as MenuIcon, LayoutDashboard, FileText, CreditCard, Receipt, Pill, Archive, Truck, Users, FlaskConical, HeartHandshake, LogIn, LogOut, UserCircle, AreaChart, Database, Building2, CalendarClock, Wallet, Hospital } from 'lucide-react';
import React from 'react';
import type { StaffRole } from '@/types/staff';
import { PAGE_ROLES } from '@/config/permissions';
import { isModuleEnabled } from '@/config/modules';
import { useBranding } from '@/components/branding-provider';

// This component wraps AuthProvider and renders the menu based on auth state
export function AuthProviderClient({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}

interface MenuItemConfig {
  href: string;
  label: string;
  icon: React.ElementType;
  allowedRoles: StaffRole[];
  isPrimary?: boolean;
  module?: string; // switchable section (src/config/modules.ts)
}

const allMenuItems: MenuItemConfig[] = [
  // Primary Patient-Facing & Operational Links
  { href: '/dashboard', label: 'Patient Dashboard', icon: LayoutDashboard, allowedRoles: PAGE_ROLES.dashboard, isPrimary: true },
  { href: '/billing', label: 'Billing', icon: CreditCard, allowedRoles: PAGE_ROLES.billing, isPrimary: true , module: 'billing' },
  { href: '/payments', label: 'Payments', icon: Receipt, allowedRoles: PAGE_ROLES.payments, isPrimary: true , module: 'payments' },
  { href: '/financial-dashboard', label: 'Financial Dashboard', icon: AreaChart, allowedRoles: PAGE_ROLES.financialDashboard, isPrimary: true , module: 'financialDashboard' },
  { href: '/duty', label: 'Duty Roster & Attendance', icon: CalendarClock, allowedRoles: PAGE_ROLES.duty, isPrimary: true , module: 'duty' },

  // Organization Setup Links
  { href: '/hospital-profile', label: 'Hospital Profile', icon: Hospital, allowedRoles: PAGE_ROLES.hospitalProfile, isPrimary: false },
  { href: '/patient-care', label: 'Patient Care Templates', icon: FileText, allowedRoles: PAGE_ROLES.patientCare, isPrimary: false , module: 'patientCare' },
  { href: '/medications', label: 'Medications', icon: Pill, allowedRoles: PAGE_ROLES.medications, isPrimary: false , module: 'medications' },
  { href: '/materials', label: 'Materials', icon: Archive, allowedRoles: PAGE_ROLES.materials, isPrimary: false , module: 'materials' },
  { href: '/vendors', label: 'Material Vendors', icon: Truck, allowedRoles: PAGE_ROLES.vendors, isPrimary: false , module: 'vendors' },
  { href: '/departments', label: 'Departments', icon: Building2, allowedRoles: PAGE_ROLES.departments, isPrimary: false , module: 'departments' },
  { href: '/payment-methods', label: 'Payment Methods', icon: Wallet, allowedRoles: PAGE_ROLES.paymentMethods, isPrimary: false , module: 'paymentMethods' },
  { href: '/staff', label: 'Staff Management', icon: Users, allowedRoles: PAGE_ROLES.staff, isPrimary: false },
  { href: '/medical-tests', label: 'Medical Tests Catalog', icon: FlaskConical, allowedRoles: PAGE_ROLES.medicalTests, isPrimary: false , module: 'medicalTests' },
  { href: '/referring-doctors', label: 'Referring Doctors', icon: HeartHandshake, allowedRoles: PAGE_ROLES.referringDoctors, isPrimary: false , module: 'referringDoctors' },
  { href: '/admin', label: 'Sample Data', icon: Database, allowedRoles: PAGE_ROLES.admin, isPrimary: false , module: 'sampleData' },
];

// Extracted Header logic into a client component that uses the useAuth hook
export function AppHeaderMenu() {
  const { currentUser, logout, isLoading } = useAuth();
  const { profile: hospital } = useBranding();

  if (isLoading) {
    return (
       <Button variant="ghost" size="icon" aria-label="Loading menu" disabled>
          <MenuIcon className="h-5 w-5 opacity-50" />
       </Button>
    );
  }

  const getVisibleMenuItems = (isPrimarySection: boolean) => {
    if (!currentUser) return [];
    return allMenuItems.filter(item => item.isPrimary === isPrimarySection && item.allowedRoles.includes(currentUser.role)
      && isModuleEnabled(hospital.disabledModules, item.module));
  };

  const primaryItems = getVisibleMenuItems(true);
  const setupItems = getVisibleMenuItems(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <MenuIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {currentUser ? (
          <>
            <DropdownMenuLabel className="flex items-center">
              <UserCircle className="mr-2 h-4 w-4" />
              {currentUser.name} ({currentUser.role})
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {primaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="flex items-center w-full">
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}

            {setupItems.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Organization Setup</DropdownMenuLabel>
                {setupItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href} className="flex items-center w-full">
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}

            {(primaryItems.length > 0 || setupItems.length > 0) && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={logout} className="flex items-center w-full cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/login" className="flex items-center w-full">
              <LogIn className="mr-2 h-4 w-4" />
              <span>Login</span>
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
