
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StaffMember, StaffRole } from '@/types/staff';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Users, ArrowLeft, Upload } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { useAuth } from '@/context/AuthContext'; 
import { PAGE_ROLES } from '@/config/permissions';
import { staff as staffRepo } from '@/lib/data';

const SYSTEM_STAFF_ROLES: StaffRole[] = ["Doctor", "Nurse", "Admin", "Receptionist", "Accounts", "Super Admin"];
const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.staff;

export default function StaffPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authIsLoading && currentUser && !ALLOWED_ROLES.includes(currentUser.role)) {
      toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
      router.replace('/dashboard');
    } else if (!authIsLoading && !currentUser) {
      router.replace('/login');
    }
  }, [authIsLoading, currentUser, router, toast]);

  useEffect(() => {
    if (currentUser && ALLOWED_ROLES.includes(currentUser.role)) { 
      setIsLoading(true);
      staffRepo.list()
        .then(setStaffMembers)
        .catch(error => {
          console.error("Error loading staff:", error);
          toast({ title: "Error", description: "Could not load staff data.", variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else if (currentUser && !ALLOWED_ROLES.includes(currentUser.role)){
        setIsLoading(false); // Stop loading if not authorized, redirect will handle it
    } else {
      setStaffMembers([]);
      setIsLoading(false);
    }
  }, [toast, currentUser]);
  
  const formatDateSafe = (dateString: string) => {
    if(!dateString) return 'N/A';
    try {
      const date = parse(dateString, 'dd/MM/yyyy', new Date());
      if (isValid(date)) {
        return format(date, 'dd/MM/yyyy');
      }
      const isoDate = new Date(dateString);
      if(isValid(isoDate)) {
          return format(isoDate, 'dd/MM/yyyy');
      }
    } catch (e) { /* ignore */ }
    return dateString;
  };

  const formatSalary = (salary?: number) => {
    if (salary === undefined || salary === null) return 'N/A';
    return `₹${salary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({ title: "File Error", description: "No file selected.", variant: "destructive" });
      return;
    }

    if (file.type !== "text/csv") {
      toast({ title: "File Error", description: "Invalid file type. Please upload a CSV file.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "File Error", description: "Could not read file content.", variant: "destructive"});
        return;
      }
      processCSV(text);
    };
    reader.onerror = () => {
        toast({ title: "File Error", description: "Error reading file.", variant: "destructive"});
    }
    reader.readAsText(file);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const processCSV = async (csvText: string) => {
    const rows = csvText.split(/\r\n|\n/).filter(row => row.trim() !== '');
    if (rows.length < 2) {
      toast({ title: "CSV Error", description: "CSV file must contain a header row and at least one data row.", variant: "destructive" });
      return;
    }

    const header = rows[0].split(',').map(h => h.trim().toLowerCase());
    const expectedHeaders = ['name', 'phonenumber', 'email', 'role', 'hiredate']; // Salary is optional
    const salaryHeader = 'salary';
    
    if (!expectedHeaders.every(eh => header.includes(eh))) {
        toast({ title: "CSV Error", description: `CSV header must contain: ${expectedHeaders.join(', ')}. Optional: ${salaryHeader}. Found: ${header.join(', ')}`, variant: "destructive" });
        return;
    }
    
    const nameIndex = header.indexOf('name');
    const phoneIndex = header.indexOf('phonenumber');
    const emailIndex = header.indexOf('email');
    const roleIndex = header.indexOf('role');
    const hireDateIndex = header.indexOf('hiredate');
    const salaryIndex = header.indexOf(salaryHeader); // Will be -1 if not present

    let currentStaff: Omit<StaffMember, 'id'>[] = [];

    let importedCount = 0;
    let failedCount = 0;
    const failures: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split(',').map(cell => cell.trim());
      
      const name = cells[nameIndex];
      const phoneNumber = cells[phoneIndex];
      const email = cells[emailIndex];
      const role = cells[roleIndex] as StaffRole;
      const hireDateStr = cells[hireDateIndex];
      const salaryStr = salaryIndex > -1 ? cells[salaryIndex] : undefined;

      let rowError = "";
      if (!name) rowError += "Name is missing. ";
      if (!phoneNumber || !/^[0-9]{10}$/.test(phoneNumber)) rowError += "Phone number must be 10 digits. ";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowError += "Invalid email format. ";
      else if (currentStaff.some(s => s.email.toLowerCase() === email.toLowerCase()) || staffMembers.some(s => s.email.toLowerCase() === email.toLowerCase())) rowError += "Email already exists. ";
      if (!role || !SYSTEM_STAFF_ROLES.includes(role)) rowError += `Invalid role (must be one of: ${SYSTEM_STAFF_ROLES.join(', ')}). `;
      
      let parsedHireDate = null;
      if (!hireDateStr) {
        rowError += "Hire Date is missing. ";
      } else {
        try {
            parsedHireDate = parse(hireDateStr, 'dd/MM/yyyy', new Date());
            if (!isValid(parsedHireDate)) {
                rowError += "Hire Date format must be dd/MM/yyyy. ";
            }
        } catch {
            rowError += "Hire Date format must be dd/MM/yyyy. ";
        }
      }
      
      let numericSalary: number | undefined = undefined;
      if (salaryStr && salaryStr.trim() !== "") {
        numericSalary = parseFloat(salaryStr);
        if (isNaN(numericSalary) || numericSalary < 0) {
          rowError += "Salary must be a valid non-negative number if provided. ";
        }
      }

      if (rowError) {
        console.warn(`Skipping row ${i+1} (Name: ${name || 'N/A'}): ${rowError}`);
        failures.push(`Row ${i+1} (Name: ${name || 'N/A'}): ${rowError}`);
        failedCount++;
        continue;
      }

      const newStaffMember: Omit<StaffMember, 'id'> = {
        name,
        phoneNumber,
        email,
        role,
        hireDate: format(parsedHireDate!, 'dd/MM/yyyy'),
        salary: numericSalary,
      };
      currentStaff.push(newStaffMember);
      importedCount++;
    }

    if (importedCount > 0) {
        try {
            const result = await staffRepo.createMany(currentStaff);
            failures.push(...result.failures);
            failedCount += result.failures.length;
            setStaffMembers(await staffRepo.list());
            toast({ title: "Import Complete", description: `${result.created.length} staff members imported and emailed an invite to set their password. ${failedCount > 0 ? `${failedCount} rows failed.` : ''}` });
        } catch (e: any) {
            console.error("Error saving imported staff:", e);
            toast({ title: "Save Error", description: e?.message || "Could not save imported staff.", variant: "destructive" });
        }
    } else if (failedCount > 0) {
         toast({ title: "Import Failed", description: `No staff members imported. ${failedCount} rows had errors. Check console for details.`, variant: "destructive" });
    } else {
         toast({ title: "Import Info", description: "No new staff members were found in the CSV to import.", variant: "default" });
    }

    if (failures.length > 0) {
        console.error("CSV Import Failures:\n" + failures.join("\n"));
    }
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading staff members...</p>
      </div>
    );
  }

  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Staff Management</h1>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-end gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
             <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Import from CSV
            </Button>
          <Link href="/staff/form" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Staff Manually
            </Button>
          </Link>
        </div>
      </header>

      <Card className="shadow-md mb-6">
        <CardHeader>
            <CardTitle className="text-lg">CSV Import Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
            <p>To import staff members from a CSV file, ensure your file has the following headers in the first row (case-insensitive, order doesn't matter):</p>
            <ul className="list-disc list-inside mt-2 pl-4 bg-muted/50 p-3 rounded-md">
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Name</code> (Required)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">PhoneNumber</code> (Required, 10 digits)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Email</code> (Required, unique, valid format)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Role</code> (Required, one of: {SYSTEM_STAFF_ROLES.join(', ')})</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">HireDate</code> (Required, dd/MM/yyyy format)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Salary</code> (Optional, non-negative number)</li>
            </ul>
            <p className="mt-2">Example CSV content:</p>
            <pre className="mt-1 p-2 bg-muted/50 rounded-md text-xs overflow-x-auto">
                Name,PhoneNumber,Email,Role,HireDate,Salary<br/>
                Dr. John Doe,1234567890,john.doe@example.com,Doctor,01/08/2023,120000<br/>
                Nurse Jane Smith,0987654321,jane.smith@example.com,Nurse,15/07/2022,65000.50
            </pre>
        </CardContent>
      </Card>

      {staffMembers.length === 0 ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Staff Members Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              There are no staff members registered yet. Click "Add New Staff Manually" or "Import from CSV" to begin.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Staff List</CardTitle>
            <CardDescription>Overview of all registered staff members. You can add staff manually or import from a CSV file using the buttons above.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Hire Date</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Salary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffMembers.sort((a,b) => a.name.localeCompare(b.name)).map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{staff.email}</TableCell>
                    <TableCell className="hidden md:table-cell">{staff.phoneNumber}</TableCell>
                    <TableCell>{staff.role}</TableCell>
                    <TableCell className="hidden lg:table-cell">{formatDateSafe(staff.hireDate)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right">{formatSalary(staff.salary)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link href={`/staff/form?id=${staff.id}`} passHref>
                        <Button variant="outline" size="sm" aria-label={`Edit ${staff.name}`}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
