"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Datepicker from "@/components/ui/datepicker";
import { useToast } from "@/hooks/use-toast";
import { StaffMember, StaffRole } from '@/types/staff';
import { ArrowLeft, Save, UserCog } from 'lucide-react'; 
import { format, parse, isValid, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext'; 

const SYSTEM_STAFF_ROLES: StaffRole[] = ["Doctor", "Nurse", "Admin", "Receptionist", "Super Admin"]; // Renamed for clarity
const ALLOWED_ROLES: StaffRole[] = ["Admin", "Doctor", "Super Admin"]; // Added "Doctor"

const isValidEmail = (email: string) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhoneNumber = (number: string) => {
  if (!number) return false;
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(number);
};

export default function StaffFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const staffIdToEdit = searchParams.get('id');
  const isEditMode = Boolean(staffIdToEdit);

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [hireDate, setHireDate] = useState<Date | null>(null);
  const [hireDateInput, setHireDateInput] = useState<string>("");
  const [salary, setSalary] = useState<string>(""); // Salary stored as string for input, converted to number on save

  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<number | null>(null);
  const [formIsLoading, setFormIsLoading] = useState(true);


  useEffect(() => {
     if (!authIsLoading && currentUser && !ALLOWED_ROLES.includes(currentUser.role)) {
      toast({ title: "Access Denied", description: "You do not have permission to access this page.", variant: "destructive" });
      router.replace('/dashboard');
    } else if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router, toast]);

  useEffect(() => {
    if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role) && !authIsLoading)) { 
        setFormIsLoading(false);
        return;
    }
    setFormIsLoading(true);
    if (isEditMode && staffIdToEdit) {
      const staffMembersJSON = localStorage.getItem('staffMembers');
      if (staffMembersJSON) {
        const staffMembers: StaffMember[] = JSON.parse(staffMembersJSON);
        const staffToEdit = staffMembers.find(s => s.id === parseInt(staffIdToEdit, 10));
        if (staffToEdit) {
          setCurrentStaffId(staffToEdit.id);
          setName(staffToEdit.name);
          setPhoneNumber(staffToEdit.phoneNumber);
          setEmail(staffToEdit.email);
          setRole(staffToEdit.role);
          setSalary(staffToEdit.salary !== undefined ? String(staffToEdit.salary) : "");
          if (staffToEdit.hireDate) {
            try {
              let parsedDate = parse(staffToEdit.hireDate, 'dd/MM/yyyy', new Date());
              if (!isValid(parsedDate)) {
                parsedDate = parseISO(staffToEdit.hireDate);
              }
              if (isValid(parsedDate)) {
                setHireDate(parsedDate);
                setHireDateInput(format(parsedDate, 'dd/MM/yyyy'));
              } else {
                 setHireDateInput(staffToEdit.hireDate); 
              }
            } catch (e) {
              setHireDateInput(staffToEdit.hireDate);
            }
          }
        } else {
          toast({ title: "Error", description: "Staff member not found.", variant: "destructive" });
          router.push('/staff');
        }
      }
    }
    setFormIsLoading(false);
  }, [isEditMode, staffIdToEdit, router, toast, currentUser, authIsLoading]);

  const handleHireDateChange = (selectedDate: Date | undefined) => {
    setHireDate(selectedDate || null);
    if (selectedDate) {
      setHireDateInput(format(selectedDate, 'dd/MM/yyyy'));
    } else {
      setHireDateInput("");
    }
  };

  const handleHireDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHireDateInput(val);
    if (val.length === 10 && /^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        try {
            const parsedDate = parse(val, 'dd/MM/yyyy', new Date());
            if (isValid(parsedDate)) {
                setHireDate(parsedDate);
            } else {
                setHireDate(null); 
            }
        } catch (error) {
            setHireDate(null); 
        }
    } else {
        setHireDate(null); 
    }
  };


  const handleSubmit = () => {
    let hasError = false;
    if (!name.trim()) { toast({ title: "Validation Error", description: "Name is required.", variant: "destructive" }); hasError = true; }
    if (!isValidPhoneNumber(phoneNumber)) { setPhoneError("Phone number must be 10 digits."); hasError = true; } else { setPhoneError(null); }
    if (!isValidEmail(email)) { setEmailError("Please enter a valid email address."); hasError = true; } else { setEmailError(null); }
    if (!role) { toast({ title: "Validation Error", description: "Role is required.", variant: "destructive" }); hasError = true; }

    let finalHireDateString = "";
    if (hireDate) {
        finalHireDateString = format(hireDate, 'dd/MM/yyyy');
    } else if (hireDateInput) {
        try {
            const parsed = parse(hireDateInput, 'dd/MM/yyyy', new Date());
            if(!isValid(parsed) || format(parsed, 'dd/MM/yyyy') !== hireDateInput) { 
                 toast({ title: "Validation Error", description: "Hire Date must be in dd/MM/yyyy format.", variant: "destructive" }); hasError = true;
            } else {
                finalHireDateString = hireDateInput;
            }
        } catch {
            toast({ title: "Validation Error", description: "Hire Date must be in dd/MM/yyyy format.", variant: "destructive" }); hasError = true;
        }
    } else {
      toast({ title: "Validation Error", description: "Hire Date is required.", variant: "destructive" }); hasError = true;
    }

    let numericSalary: number | undefined = undefined;
    if (salary.trim() !== "") {
      numericSalary = parseFloat(salary);
      if (isNaN(numericSalary) || numericSalary < 0) {
        toast({ title: "Validation Error", description: "Salary must be a valid non-negative number if provided.", variant: "destructive" });
        hasError = true;
      }
    }


    if (hasError) {
      toast({
            title: "Error",
            description: "Please correct the highlighted fields and ensure all required fields are filled.",
            variant: "destructive",
        });
      return;
    }

    const staffMemberData: Omit<StaffMember, 'id'> = {
      name: name.trim(),
      phoneNumber,
      email,
      role: role as StaffRole,
      hireDate: finalHireDateString,
      salary: numericSalary,
    };

    try {
      const staffMembersJSON = localStorage.getItem('staffMembers');
      let staffMembers: StaffMember[] = staffMembersJSON ? JSON.parse(staffMembersJSON) : [];

      if (isEditMode && currentStaffId !== null) {
        if (currentStaffId === currentUser?.id && staffMemberData.email !== currentUser.email) {
            toast({ title: "Action Denied", description: "You cannot change your own login email.", variant: "destructive" });
            return;
        }
        staffMembers = staffMembers.map(s => s.id === currentStaffId ? { ...staffMemberData, id: currentStaffId } : s);
        toast({ title: "Success", description: "Staff member details updated." });
      } else {
        // Check if email already exists for a new staff member
        if (staffMembers.some(s => s.email.toLowerCase() === email.toLowerCase())) {
            toast({ title: "Error", description: "A staff member with this email already exists.", variant: "destructive" });
            return;
        }
        const nextStaffIdJSON = localStorage.getItem('nextStaffId');
        let nextStaffId = nextStaffIdJSON ? parseInt(nextStaffIdJSON, 10) : 1;
        const newStaffMember: StaffMember = { ...staffMemberData, id: nextStaffId };
        staffMembers.push(newStaffMember);
        localStorage.setItem('nextStaffId', (nextStaffId + 1).toString());
        toast({ title: "Success", description: "New staff member added." });
      }

      localStorage.setItem('staffMembers', JSON.stringify(staffMembers));
      router.push('/staff');

    } catch (e) {
      console.error("Failed to save staff member to localStorage", e);
      toast({
        title: "Storage Error",
        description: "Could not save staff data.",
        variant: "destructive",
      });
    }
  };

  if (authIsLoading || formIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading form...</p></div>;
  }

  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-lg mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <UserCog className="mr-3 h-7 w-7 text-primary" />
            {isEditMode ? "Edit Staff Member" : "Add New Staff Member"}
          </CardTitle>
          <CardDescription>
            {isEditMode ? "Update the details for this staff member." : "Fill in the details to add a new staff member."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="phoneNumber">Phone Number *</Label>
            <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (e.target.value && !isValidPhoneNumber(e.target.value)) {
                    setPhoneError("Phone number must be 10 digits.");
                } else {
                    setPhoneError(null);
                }
            }} required />
            {phoneError && <p className="text-destructive text-sm mt-1">{phoneError}</p>}
          </div>
          <div>
            <Label htmlFor="email">Email Address * (Used for login)</Label>
            <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => {
                    setEmail(e.target.value);
                    if (e.target.value && !isValidEmail(e.target.value)) {
                        setEmailError("Please enter a valid email address.");
                    } else {
                        setEmailError(null);
                    }
                }} 
                required 
                disabled={isEditMode && currentStaffId === currentUser?.id} 
            />
            {emailError && <p className="text-destructive text-sm mt-1">{emailError}</p>}
             {isEditMode && currentStaffId === currentUser?.id && <p className="text-xs text-muted-foreground mt-1">Your login email cannot be changed here.</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select onValueChange={(value) => setRole(value as StaffRole)} value={role} required>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  {currentUser?.role === "Super Admin" && (
                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                  )}
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Doctor">Doctor</SelectItem>
                  <SelectItem value="Nurse">Nurse</SelectItem>
                  <SelectItem value="Receptionist">Receptionist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="salary">Salary (₹) (Optional)</Label>
              <Input 
                id="salary" 
                type="number" 
                value={salary} 
                onChange={(e) => setSalary(e.target.value)} 
                placeholder="e.g., 50000"
                min="0"
                step="any"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="hireDate">Hire Date (dd/MM/yyyy) *</Label>
            <div className="flex items-center">
                <Input
                    type="text"
                    id="hireDate"
                    placeholder="dd/MM/yyyy"
                    value={hireDateInput}
                    onChange={handleHireDateInputChange}
                    className="rounded-r-none"
                    required
                />
                <Datepicker
                    selected={hireDate}
                    onDateChange={handleHireDateChange}
                    triggerClassName="rounded-l-none border-l-0 w-auto p-2.5"
                    placeholderText="Select Date"
                />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.push('/staff')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" /> {isEditMode ? "Save Changes" : "Add Staff Member"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}