
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReferringDoctor } from '@/types/referringDoctor';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, HeartHandshake, ArrowLeft, Upload } from 'lucide-react';
import { referringDoctors as referringDoctorsRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import { useFeatures } from '@/hooks/use-features';
import type { StaffRole } from '@/types/staff';
import { PAGE_ROLES } from '@/config/permissions';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.referringDoctors;

const isValidEmailOptional = (email?: string): boolean => {
  if (!email || email.trim() === "") return true; // Optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhoneNumberOptional = (number?: string): boolean => {
  if (!number || number.trim() === "") return true; // Optional
  const phoneRegex = /^[0-9\s\-()+]{7,15}$/;
  return phoneRegex.test(number);
};

export default function ReferringDoctorsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const { isOn } = useFeatures();

  const [referringDoctors, setReferringDoctors] = useState<ReferringDoctor[]>([]);
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
      referringDoctorsRepo.list()
        .then(setReferringDoctors)
        .catch(error => {
          console.error("Error loading referring doctor:", error);
          toast({ title: "Error", description: "Could not load referring doctor data.", variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else if (currentUser && !ALLOWED_ROLES.includes(currentUser.role)){
        setIsLoading(false);
    } else {
      setReferringDoctors([]);
      setIsLoading(false);
    }
  }, [toast, currentUser]);

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
        fileInputRef.current.value = ""; // Reset file input
    }
  };

  const processCSV = async (csvText: string) => {
    const rows = csvText.split(/\r\n|\n/).filter(row => row.trim() !== '');
    if (rows.length < 2) {
      toast({ title: "CSV Error", description: "CSV file must contain a header row and at least one data row.", variant: "destructive" });
      return;
    }

    const header = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '')); // Normalize headers
    const expectedHeaders = ['name', 'hospital/clinicname'];
    const optionalHeaders = ['phonenumber', 'email'];

    if (!expectedHeaders.every(eh => header.includes(eh))) {
        toast({ title: "CSV Error", description: `CSV header must contain at least: Name, Hospital/Clinic Name. Found: ${header.join(', ')}. Optional: PhoneNumber, Email`, variant: "destructive" });
        return;
    }

    const nameIndex = header.indexOf('name');
    const locationIndex = header.indexOf('hospital/clinicname'); // Use normalized header
    const phoneNumberIndex = header.indexOf('phonenumber');
    const emailIndex = header.indexOf('email');

    const newItems: Omit<ReferringDoctor, 'id'>[] = [];

    let importedCount = 0;
    let failedCount = 0;
    const failures: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split(',').map(cell => cell.trim());
      let rowError = "";

      const name = cells[nameIndex];
      const location = cells[locationIndex];
      const phoneNumber = phoneNumberIndex > -1 ? cells[phoneNumberIndex] : "";
      const email = emailIndex > -1 ? cells[emailIndex] : "";

      if (!name) rowError += "Name is missing. ";
      if (!location) rowError += "Hospital/Clinic Name is missing. ";
      if (phoneNumber && !isValidPhoneNumberOptional(phoneNumber)) rowError += "Invalid Phone Number format. ";
      if (email && !isValidEmailOptional(email)) rowError += "Invalid Email format. ";
      
      if ([...referringDoctors, ...newItems].some(doc => doc.name.toLowerCase() === name.toLowerCase() && doc.location.toLowerCase() === location.toLowerCase())) {
        rowError += `Doctor "${name}" at "${location}" already exists. `;
      }

      if (rowError) {
        console.warn(`Skipping row ${i+1} (Name: ${name || 'N/A'}): ${rowError}`);
        failures.push(`Row ${i+1} (Name: ${name || 'N/A'}): ${rowError}`);
        failedCount++;
        continue;
      }

      const newDoctor: Omit<ReferringDoctor, 'id'> = {
        name,
        location, // This is now Hospital/Clinic Name
        phoneNumber,
        email,
      };
      newItems.push(newDoctor);
      importedCount++;
    }

    if (importedCount > 0) {
      try {
          await referringDoctorsRepo.createMany(newItems);
          setReferringDoctors(await referringDoctorsRepo.list());
          toast({ title: "Import Successful", description: `${importedCount} referring doctors imported. ${failedCount > 0 ? `${failedCount} rows failed.` : ''}` });
      } catch (e) {
          console.error("Error saving imported referring doctors:", e);
          toast({ title: "Save Error", description: "Could not save imported referring doctors.", variant: "destructive" });
      }
    } else if (failedCount > 0) {
         toast({ title: "Import Failed", description: `No referring doctors imported. ${failedCount} rows had errors. Check console for details.`, variant: "destructive" });
    } else {
         toast({ title: "Import Info", description: "No new referring doctors found in the CSV to import.", variant: "default" });
    }
    if (failures.length > 0) {
        console.error("CSV Import Failures (Referring Doctors):\n" + failures.join("\n"));
    }
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading referring doctors...</p>
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
          <HeartHandshake className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Referring Doctors</h1>
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
            <Link href="/referring-doctors/form" passHref>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Referring Doctor
                </Button>
            </Link>
        </div>
      </header>

      <Card className="shadow-md mb-6">
        <CardHeader>
            <CardTitle className="text-lg">CSV Import Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
            <p>To import referring doctors from a CSV file, ensure your file has the following headers in the first row (case-insensitive):</p>
            <ul className="list-disc list-inside mt-2 pl-4 bg-muted/50 p-3 rounded-md">
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Name</code> (Required)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Hospital/Clinic Name</code> (Required, was previously 'Location')</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">PhoneNumber</code> (Optional)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Email</code> (Optional)</li>
            </ul>
            <p className="mt-2">Example CSV content:</p>
            <pre className="mt-1 p-2 bg-muted/50 rounded-md text-xs overflow-x-auto">
                Name,"Hospital/Clinic Name",PhoneNumber,Email<br/>
                Dr. Emily Carter,"City General Hospital",555-1234,emily.carter@cgh.com<br/>
                Dr. Ben Smith,"City Clinic",555-5678,ben.smith@cityclinic.com
            </pre>
        </CardContent>
      </Card>

      {referringDoctors.length === 0 ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Referring Doctors Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              There are no referring doctor profiles registered yet. Click "Add New Referring Doctor" or "Import from CSV" to begin.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Referring Doctor Profiles</CardTitle>
            <CardDescription>List of all registered referring doctors.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Hospital/Clinic Name</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  {isOn('referralFees') && <TableHead className="hidden sm:table-cell text-right">Referral Fee</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referringDoctors.sort((a,b) => a.name.localeCompare(b.name)).map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell className="font-medium">{doctor.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{doctor.location}</TableCell>
                    <TableCell className="hidden md:table-cell">{doctor.phoneNumber}</TableCell>
                    <TableCell className="hidden lg:table-cell">{doctor.email}</TableCell>
                    {isOn('referralFees') && <TableCell className="hidden sm:table-cell text-right">{[doctor.defaultReferralFee != null ? `₹${doctor.defaultReferralFee.toFixed(2)}` : null, doctor.defaultReferralPercent != null ? `${doctor.defaultReferralPercent}%` : null].filter(Boolean).join(' or ') || '—'}</TableCell>}
                    <TableCell className="text-right space-x-2">
                      <Link href={`/referring-doctors/form?id=${doctor.id}`} passHref>
                        <Button variant="outline" size="sm" aria-label={`Edit ${doctor.name}`}>
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
