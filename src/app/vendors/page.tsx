
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Vendor } from '@/types/vendor';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Truck, ArrowLeft, Upload } from 'lucide-react';
import { vendors as vendorsRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';
import { PAGE_ROLES } from '@/config/permissions';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.vendors;

export default function VendorsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [vendors, setVendors] = useState<Vendor[]>([]);
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
      vendorsRepo.list()
        .then(setVendors)
        .catch(error => {
          console.error("Error loading vendors:", error);
          toast({ title: "Error", description: "Could not load vendors data.", variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else if (currentUser && !ALLOWED_ROLES.includes(currentUser.role)){
        setIsLoading(false);
    } else {
      setVendors([]);
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

    const header = rows[0].split(',').map(h => h.trim().toLowerCase());
    const expectedHeaders = ['name'];
    const optionalHeaders = ['contactperson', 'phonenumber', 'email', 'address', 'notes'];
    
    if (!expectedHeaders.every(eh => header.includes(eh))) {
        toast({ title: "CSV Error", description: `CSV header must contain at least: ${expectedHeaders.join(', ')}. Found: ${header.join(', ')}. Optional: ${optionalHeaders.join(', ')}`, variant: "destructive" });
        return;
    }
    
    const nameIndex = header.indexOf('name');
    const contactPersonIndex = header.indexOf('contactperson');
    const phoneNumberIndex = header.indexOf('phonenumber');
    const emailIndex = header.indexOf('email');
    const addressIndex = header.indexOf('address');
    const notesIndex = header.indexOf('notes');

    const newItems: Omit<Vendor, 'id'>[] = [];

    let importedCount = 0;
    let failedCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split(',').map(cell => cell.trim());
      
      const name = cells[nameIndex];
      if (!name) { console.warn(`Skipping row ${i+1}: Name is missing.`); failedCount++; continue; }
      
      const newVendor: Omit<Vendor, 'id'> = {
        name,
        contactPerson: contactPersonIndex > -1 ? cells[contactPersonIndex] : undefined,
        phoneNumber: phoneNumberIndex > -1 ? cells[phoneNumberIndex] : undefined,
        email: emailIndex > -1 ? cells[emailIndex] : undefined,
        address: addressIndex > -1 ? cells[addressIndex] : undefined,
        notes: notesIndex > -1 ? cells[notesIndex] : undefined,
      };
      newItems.push(newVendor);
      importedCount++;
    }

    if (importedCount > 0) {
      try {
          await vendorsRepo.createMany(newItems);
          setVendors(await vendorsRepo.list());
          toast({ title: "Import Successful", description: `${importedCount} vendors imported. ${failedCount > 0 ? `${failedCount} rows failed.` : ''}` });
      } catch (e) {
          console.error("Error saving imported vendors:", e);
          toast({ title: "Save Error", description: "Could not save imported vendors.", variant: "destructive" });
      }
    } else if (failedCount > 0) {
        toast({ title: "Import Failed", description: `No vendors imported. ${failedCount} rows had errors. Check console for details.`, variant: "destructive" });
    } else {
        toast({ title: "Import Info", description: "No new vendors found in CSV to import.", variant: "default"});
    }
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading vendors...</p>
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
          <Truck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Material Vendors Management</h1>
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
            <Link href="/vendors/form" passHref>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Vendor
                </Button>
            </Link>
        </div>
      </header>

      <Card className="shadow-md mb-6">
        <CardHeader>
            <CardTitle className="text-lg">CSV Import Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
            <p>To import vendors from a CSV file, ensure your file has the following headers in the first row (case-insensitive):</p>
            <ul className="list-disc list-inside mt-2 pl-4 bg-muted/50 p-3 rounded-md">
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Name</code> (Required)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">ContactPerson</code> (Optional)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">PhoneNumber</code> (Optional)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Email</code> (Optional)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Address</code> (Optional)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Notes</code> (Optional)</li>
            </ul>
            <p className="mt-2">Example CSV content:</p>
            <pre className="mt-1 p-2 bg-muted/50 rounded-md text-xs overflow-x-auto">
                Name,ContactPerson,PhoneNumber,Email,Address,Notes<br/>
                ABC Medical Supplies,John Smith,123-456-7890,john@abc.com,"123 Supply Rd, City",Reliable supplier<br/>
                XYZ Pharma,Jane Doe,987-654-3210,jane@xyz.com,"456 Pharma Ave, Town",Good for bulk orders
            </pre>
        </CardContent>
      </Card>

      {vendors.length === 0 ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Material Vendors Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              There are no material vendors cataloged yet. Click "Add New Vendor" or "Import from CSV" to start.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Vendor List</CardTitle>
            <CardDescription>Overview of all cataloged material vendors.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Contact Person</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.sort((a,b) => a.name.localeCompare(b.name)).map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{vendor.contactPerson || "N/A"}</TableCell>
                    <TableCell className="hidden md:table-cell">{vendor.phoneNumber || "N/A"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{vendor.email || "N/A"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link href={`/vendors/form?id=${vendor.id}`} passHref>
                        <Button variant="outline" size="sm" aria-label={`Edit ${vendor.name}`}>
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
