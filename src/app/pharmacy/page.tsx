
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Medication } from '@/types/medication';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Pill, ArrowLeft, Upload } from 'lucide-react';
import { medications as medicationsRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';
import { PAGE_ROLES } from '@/config/permissions';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.medications;

export default function MedicationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [medications, setMedications] = useState<Medication[]>([]);
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
      medicationsRepo.list()
        .then(setMedications)
        .catch(error => {
          console.error("Error loading medications:", error);
          toast({ title: "Error", description: "Could not load pharmacy items.", variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else if (currentUser && !ALLOWED_ROLES.includes(currentUser.role)){
        setIsLoading(false);
    }
     else {
      setMedications([]);
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
    const expectedHeaders = ['name', 'treatment', 'listprice', 'unitofmeasure']; 
    const optionalHeaders = ['quantityinpackage', 'additionalnotes'];
    
    if (!expectedHeaders.every(eh => header.includes(eh))) {
        toast({ title: "CSV Error", description: `CSV header must contain at least: ${expectedHeaders.join(', ')}. Found: ${header.join(', ')}. Optional: ${optionalHeaders.join(', ')}`, variant: "destructive" });
        return;
    }
    
    const nameIndex = header.indexOf('name');
    const treatmentIndex = header.indexOf('treatment');
    const listPriceIndex = header.indexOf('listprice');
    const quantityInPackageIndex = header.indexOf('quantityinpackage'); 
    const unitOfMeasureIndex = header.indexOf('unitofmeasure');
    const additionalNotesIndex = header.indexOf('additionalnotes'); 

    const newItems: Omit<Medication, 'id'>[] = [];

    let importedCount = 0;
    let failedCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split(',').map(cell => cell.trim());
      
      const name = cells[nameIndex];
      const treatment = cells[treatmentIndex];
      const listPriceStr = cells[listPriceIndex];
      const quantityInPackageStr = quantityInPackageIndex > -1 ? cells[quantityInPackageIndex] : undefined;
      const unitOfMeasure = cells[unitOfMeasureIndex];
      const additionalNotes = additionalNotesIndex > -1 ? cells[additionalNotesIndex] : "";

      if (!name) { console.warn(`Skipping row ${i+1}: Name is missing.`); failedCount++; continue; }
      if (!unitOfMeasure) { console.warn(`Skipping row ${i+1} for medication "${name}": UnitOfMeasure is missing.`); failedCount++; continue; }
      
      const listPrice = parseFloat(listPriceStr);
      if (isNaN(listPrice) || listPrice < 0) {
        console.warn(`Skipping row ${i+1} for medication "${name}": Invalid ListPrice "${listPriceStr}".`);
        failedCount++;
        continue;
      }

      let quantityInPackage: number | undefined = undefined;
      if (quantityInPackageStr && quantityInPackageStr.trim() !== "") {
        quantityInPackage = parseFloat(quantityInPackageStr);
        if (isNaN(quantityInPackage) || quantityInPackage <= 0) {
            console.warn(`Skipping row ${i+1} for medication "${name}": Invalid QuantityInPackage "${quantityInPackageStr}". Must be a positive number.`);
            failedCount++;
            continue;
        }
        if (quantityInPackage % 1 !== 0) {
            console.warn(`Skipping row ${i+1} for medication "${name}": QuantityInPackage "${quantityInPackageStr}" must be a whole number.`);
            failedCount++;
            continue;
        }
      }

      const newMedication: Omit<Medication, 'id'> = {
        name,
        treatment: treatment || "N/A",
        listPrice,
        quantityInPackage,
        unitOfMeasure,
        additionalNotes,
      };
      newItems.push(newMedication);
      importedCount++;
    }

    if (importedCount > 0) {
      try {
          await medicationsRepo.createMany(newItems);
          setMedications(await medicationsRepo.list());
          toast({ title: "Import Successful", description: `${importedCount} pharmacy items imported. ${failedCount > 0 ? `${failedCount} rows failed.` : ''}` });
      } catch (e) {
          console.error("Error saving imported medications:", e);
          toast({ title: "Save Error", description: "Could not save imported pharmacy items.", variant: "destructive" });
      }
    } else if (failedCount > 0) {
        toast({ title: "Import Failed", description: `No pharmacy items imported. ${failedCount} rows had errors. Check console for details.`, variant: "destructive" });
    } else {
        toast({ title: "Import Info", description: "No new pharmacy items found in CSV to import.", variant: "default"});
    }
  };

  const formatPackageDisplay = (med: Medication): string => {
    if (med.quantityInPackage !== undefined && med.quantityInPackage !== null) {
        return `${med.quantityInPackage} ${med.unitOfMeasure}`;
    }
    return med.unitOfMeasure;
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading pharmacy items...</p>
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
          <Pill className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Pharmacy</h1>
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
            <Link href="/pharmacy/form" passHref>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Pharmacy Item
                </Button>
            </Link>
        </div>
      </header>

      <Card className="shadow-md mb-6">
        <CardHeader>
            <CardTitle className="text-lg">CSV Import Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
            <p>To import pharmacy items from a CSV file, ensure your file has the following headers in the first row (case-insensitive):</p>
            <ul className="list-disc list-inside mt-2 pl-4 bg-muted/50 p-3 rounded-md">
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Name</code> (Required)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Treatment</code> (Name of treatment template)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">ListPrice</code> (Required, for the package)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">QuantityInPackage</code> (Optional, e.g., 10, 100. Whole number)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">UnitOfMeasure</code> (Required, e.g., tablet, ml, bottle)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">AdditionalNotes</code> (Optional)</li>
            </ul>
            <p className="mt-2">Example CSV content:</p>
            <pre className="mt-1 p-2 bg-muted/50 rounded-md text-xs overflow-x-auto">
                Name,Treatment,ListPrice,QuantityInPackage,UnitOfMeasure,AdditionalNotes<br/>
                Amoxicillin,Bacterial Infection,25.99,20,tablet,Take with food<br/>
                Lisinopril,Hypertension,35.50,30,tablet,Take in morning
                Amoxicillin 500mg,Antibiotic for bacterial infections,150.75,20,tablet,Take with food<br/>
                Paracetamol Syrup,Pain and fever relief,50.00,100,ml,Max 4 doses per day<br/>
                Vitamin C Tablets,Supplement,200,,tablet,1 strip of 10
            </pre>
        </CardContent>
      </Card>

      {medications.length === 0 ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Pharmacy Items Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              There are no pharmacy items yet. Click "Add Pharmacy Item" or "Import from CSV" to start.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Pharmacy Items</CardTitle>
            <CardDescription>Medicines and other items the pharmacy sells. Stock on hand is under Inventory.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Treatment/Purpose</TableHead>
                  <TableHead>List Price</TableHead>
                  <TableHead className="hidden md:table-cell">Package Details</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medications.sort((a,b) => a.name.localeCompare(b.name)).map((med) => (
                  <TableRow key={med.id}>
                    <TableCell className="font-medium">{med.name}</TableCell>
                    <TableCell className="hidden sm:table-cell truncate max-w-xs">{med.treatment}</TableCell>
                    <TableCell>₹{med.listPrice.toFixed(2)}</TableCell>
                    <TableCell className="hidden md:table-cell">{formatPackageDisplay(med)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link href={`/pharmacy/form?id=${med.id}`} passHref>
                        <Button variant="outline" size="sm" aria-label={`Edit ${med.name}`}>
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
