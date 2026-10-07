
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from '@/context/AuthContext';
import {
  Users, UserPlus, CreditCard, AreaChart, ClipboardList, Pill,
  Archive, Truck, FlaskConical, HeartHandshake, FileText, DollarSign, Activity, Calendar
} from 'lucide-react';

interface DashboardCard {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
  allowedRoles: string[];
}

const dashboardCards: DashboardCard[] = [
  {
    title: 'Patient Dashboard',
    description: 'View and manage all patients, update conditions, and track care',
    href: '/dashboard',
    icon: Users,
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    allowedRoles: ["Admin", "Doctor", "Nurse", "Receptionist"]
  },
  {
    title: 'Add New Patient',
    description: 'Register a new patient with ID scanning and details capture',
    href: '/patient-intake',
    icon: UserPlus,
    color: 'bg-green-50 border-green-200 hover:bg-green-100',
    allowedRoles: ["Admin", "Doctor", "Nurse", "Receptionist"]
  },
  {
    title: 'Billing & Invoices',
    description: 'Manage patient bills, payments, and financial records',
    href: '/billing',
    icon: CreditCard,
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    allowedRoles: ["Admin", "Doctor", "Nurse", "Receptionist"]
  },
  {
    title: 'Financial Dashboard',
    description: 'View financial analytics, revenue trends, and reports',
    href: '/financial-dashboard',
    icon: AreaChart,
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    allowedRoles: ["Admin", "Doctor"]
  },
  {
    title: 'Payment Records',
    description: 'Track payment history and manage referring doctor payments',
    href: '/payments',
    icon: DollarSign,
    color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    allowedRoles: ["Admin", "Doctor", "Receptionist"]
  },
  {
    title: 'Staff Management',
    description: 'Manage staff members, roles, and permissions',
    href: '/staff',
    icon: Users,
    color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
    allowedRoles: ["Admin", "Doctor"]
  },
  {
    title: 'Care Templates',
    description: 'Create and manage patient care note templates',
    href: '/patient-care',
    icon: FileText,
    color: 'bg-teal-50 border-teal-200 hover:bg-teal-100',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  {
    title: 'Medications',
    description: 'Manage medication catalog and prescriptions',
    href: '/medications',
    icon: Pill,
    color: 'bg-pink-50 border-pink-200 hover:bg-pink-100',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  {
    title: 'Medical Tests',
    description: 'Manage test catalog and laboratory procedures',
    href: '/medical-tests',
    icon: FlaskConical,
    color: 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  {
    title: 'Materials & Inventory',
    description: 'Manage medical materials and supplies',
    href: '/materials',
    icon: Archive,
    color: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  {
    title: 'Vendors',
    description: 'Manage material vendors and suppliers',
    href: '/vendors',
    icon: Truck,
    color: 'bg-red-50 border-red-200 hover:bg-red-100',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  {
    title: 'Referring Doctors',
    description: 'Manage referring doctors and their information',
    href: '/referring-doctors',
    icon: HeartHandshake,
    color: 'bg-slate-50 border-slate-200 hover:bg-slate-100',
    allowedRoles: ["Admin", "Doctor", "Nurse", "Receptionist"]
  }
];

export default function HomePage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [patientsCount, setPatientsCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);

  useEffect(() => {
    if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setPatientsCount(JSON.parse(localStorage.getItem('patients') || '[]').length);
    setStaffCount(JSON.parse(localStorage.getItem('staffMembers') || '[]').length);
  }, []);

  if (authIsLoading || !currentUser) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  const filteredCards = useMemo(
    () => dashboardCards.filter(card => card.allowedRoles.includes(currentUser.role)),
    [currentUser.role]
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Cardio Care System</h1>
            <p className="text-lg text-muted-foreground">
              Welcome back, {currentUser.name} ({currentUser.role})
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="text-lg font-semibold text-foreground">
              {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      </div>
      {/* Additional UI removed for brevity */}
    </div>
  );
}
