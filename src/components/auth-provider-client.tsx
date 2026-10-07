
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
import { Menu as MenuIcon, LayoutDashboard, FileText, CreditCard, Receipt, Pill, Archive, Truck, Users, FlaskConical, HeartHandshake, LogIn, LogOut, UserCircle, AreaChart } from 'lucide-react'; // Added AreaChart
import React from 'react';
import type { StaffRole } from '@/types/staff';

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
}

const allMenuItems: MenuItemConfig[] = [
  // Primary Patient-Facing & Operational Links
  { href: '/dashboard', label: 'Patient Dashboard', icon: LayoutDashboard, allowedRoles: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist"], isPrimary: true },
  { href: '/billing', label: 'Billing', icon: CreditCard, allowedRoles: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist"], isPrimary: true },
  { href: '/payments', label: 'Payments', icon: Receipt, allowedRoles: ["Super Admin", "Admin", "Doctor"], isPrimary: true },
  { href: '/financial-dashboard', label: 'Financial Dashboard', icon: AreaChart, allowedRoles: ["Super Admin", "Admin", "Doctor"], isPrimary: true },

  // Organization Setup Links
  { href: '/patient-care', label: 'Patient Care Templates', icon: FileText, allowedRoles: ["Super Admin", "Admin", "Doctor", "Nurse"], isPrimary: false },
  { href: '/medications', label: 'Medications', icon: Pill, allowedRoles: ["Super Admin", "Admin", "Doctor", "Nurse"], isPrimary: false },
  { href: '/materials', label: 'Materials', icon: Archive, allowedRoles: ["Super Admin", "Admin", "Doctor", "Nurse"], isPrimary: false },
  { href: '/vendors', label: 'Material Vendors', icon: Truck, allowedRoles: ["Super Admin", "Admin", "Doctor", "Nurse"], isPrimary: false },
  { href: '/staff', label: 'Staff Management', icon: Users, allowedRoles: ["Super Admin", "Admin", "Doctor"], isPrimary: false },
  { href: '/medical-tests', label: 'Medical Tests Catalog', icon: FlaskConical, allowedRoles: ["Super Admin", "Admin", "Doctor", "Nurse"], isPrimary: false },
  { href: '/referring-doctors', label: 'Referring Doctors', icon: HeartHandshake, allowedRoles: ["Super Admin", "Admin", "Doctor", "Nurse", "Receptionist"], isPrimary: false },
];


// Extracted Header logic into a client component that uses the useAuth hook
export function AppHeaderMenu() {
  const { currentUser, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
       <Button variant="ghost" size="icon" aria-label="Loading menu" disabled>
          <MenuIcon className="h-5 w-5 animate-spin" />
       </Button>
    );
  }

  const getVisibleMenuItems = (isPrimarySection: boolean) => {
    if (!currentUser) return [];
    return allMenuItems.filter(item => item.isPrimary === isPrimarySection && item.allowedRoles.includes(currentUser.role));
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
