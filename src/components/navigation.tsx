import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  UserPlus, 
  CreditCard, 
  AreaChart, 
  ClipboardList, 
  Users, 
  Pill, 
  Archive, 
  Truck, 
  FlaskConical, 
  HeartHandshake,
  FileText,
  DollarSign
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ElementType;
  description: string;
  allowedRoles: string[];
}

const navigationItems: NavigationItem[] = [
  { 
    href: '/dashboard', 
    label: 'Patient Dashboard', 
    icon: Users, 
    description: 'View and manage all patients',
    allowedRoles: ["Admin", "Doctor", "Nurse", "Receptionist"]
  },
  { 
    href: '/patient-intake', 
    label: 'Add New Patient', 
    icon: UserPlus, 
    description: 'Register a new patient',
    allowedRoles: ["Admin", "Doctor", "Nurse", "Receptionist"]
  },
  { 
    href: '/billing', 
    label: 'Billing Overview', 
    icon: CreditCard, 
    description: 'View all bills and payments',
    allowedRoles: ["Admin", "Doctor", "Nurse", "Receptionist"]
  },
  { 
    href: '/payments', 
    label: 'Payment Records', 
    icon: DollarSign, 
    description: 'Track payment history',
    allowedRoles: ["Admin", "Doctor", "Receptionist"]
  },
  { 
    href: '/financial-dashboard', 
    label: 'Financial Dashboard', 
    icon: AreaChart, 
    description: 'View financial analytics and reports',
    allowedRoles: ["Admin", "Doctor"]
  },
  { 
    href: '/staff', 
    label: 'Staff Management', 
    icon: Users, 
    description: 'Manage staff members',
    allowedRoles: ["Admin", "Doctor"]
  },
  { 
    href: '/patient-care', 
    label: 'Care Templates', 
    icon: FileText, 
    description: 'Manage patient care templates',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  { 
    href: '/medications', 
    label: 'Medications', 
    icon: Pill, 
    description: 'Manage medication catalog',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  { 
    href: '/medical-tests', 
    label: 'Medical Tests', 
    icon: FlaskConical, 
    description: 'Manage test catalog',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  { 
    href: '/materials', 
    label: 'Materials', 
    icon: Archive, 
    description: 'Manage medical materials',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  { 
    href: '/vendors', 
    label: 'Vendors', 
    icon: Truck, 
    description: 'Manage material vendors',
    allowedRoles: ["Admin", "Doctor", "Nurse"]
  },
  { 
    href: '/referring-doctors', 
    label: 'Referring Doctors', 
    icon: HeartHandshake, 
    description: 'Manage referring doctors',
    allowedRoles: ["Admin", "Doctor", "Nurse", "Receptionist"]
  },
];

export function QuickNavigation() {
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  const filteredItems = navigationItems.filter(item => 
    item.allowedRoles.includes(currentUser.role)
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Quick Navigation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} passHref>
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start text-left w-full hover:bg-accent"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}