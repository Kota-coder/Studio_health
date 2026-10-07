
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Material } from '@/types/material';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Archive, ArrowLeft, Upload } from 'lucide-react';
import { materials as materialsRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';
import { PAGE_ROLES } from '@/config/permissions';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.materials;

export default function MaterialsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [materials, setMaterials] = useState<Material[]>([]);
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
      materialsRepo.list()
        .then(setMaterials)
        .catch(error => {
          console.error("Error loading materials:", error);
          toast({ title: "Error", description: "Could not load material data.", variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else if (currentUser && !ALLOWED_ROLES.includes(currentUser.role)){
        setIsLoading(false);
    } else {
      setMaterials([]);
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
    const expectedHeaders = ['name', 'unitofmeasure'];
    const optionalHeaders = ['category', 'listprice', 'associatedtreatmenttemplatename', 'notes'];
    
    if (!expectedHeaders.every(eh => header.includes(eh))) {
        toast({ title: "CSV Error", description: `CSV header must contain at least: ${expectedHeaders.join(', ')}. Found: ${header.join(', ')}. Optional: ${optionalHeaders.join(', ')}`, variant: "destructive" });
        return;
    }
    
    const nameIndex = header.indexOf('name');
    const categoryIndex = header.indexOf('category');
    const unitOfMeasureIndex = header.indexOf('unitofmeasure');
    const listPriceIndex = header.indexOf('listprice');
    const associatedTreatmentTemplateNameIndex = header.indexOf('associatedtreatmenttemplatename');
    const notesIndex = header.indexOf('notes');

    const newMaterials: Omit<Material, 'id'>[] = [];

    let importedCount = 0;
    let failedCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split(',').map(cell => cell.trim());
      
      const name = cells[nameIndex];
      const category = categoryIndex > -1 ? cells[categoryIndex] : "";
      const unitOfMeasure = cells[unitOfMeasureIndex];
      const listPriceStr = listPriceIndex > -1 ? cells[listPriceIndex] : undefined;
      const associatedTreatmentTemplateName = associatedTreatmentTemplateNameIndex > -1 ? cells[associatedTreatmentTemplateNameIndex] : "";
      const notes = notesIndex > -1 ? cells[notesIndex] : "";

      if (!name) { console.warn(`Skipping row ${i+1}: Name is missing.`); failedCount++; continue; }
      if (!unitOfMeasure) { console.warn(`Skipping row ${i+1} for material "${name}": Unit of Measure is missing.`); failedCount++; continue; }
      
      let listPrice: number | undefined = undefined;
      if (listPriceStr && listPriceStr.trim() !== "") {
        listPrice = parseFloat(listPriceStr);
        if (isNaN(listPrice) || listPrice < 0) {
          console.warn(`Skipping row ${i+1} for material "${name}": Invalid List Price "${listPriceStr}".`);
          failedCount++;
          continue;
        }
      }

      const newMaterial: Omit<Material, 'id'> = {
        name,
        category,
        unitOfMeasure,
        listPrice,
        associatedTreatmentTemplateName,
        notes,
      };
      newMaterials.push(newMaterial);
      importedCount++;
    }

    if (importedCount > 0) {
      try {
          await materialsRepo.createMany(newMaterials);
          setMaterials(await materialsRepo.list());
          toast({ title: "Import Successful", description: `${importedCount} materials imported. ${failedCount > 0 ? `${failedCount} rows failed.` : ''}` });
      } catch (e) {
          console.error("Error saving imported materials:", e);
          toast({ title: "Storage Error", description: "Could not save imported materials.", variant: "destructive" });
      }
    } else if (failedCount > 0) {
        toast({ title: "Import Failed", description: `No materials imported. ${failedCount} rows had errors. Check console for details.`, variant: "destructive" });
    } else {
        toast({ title: "Import Info", description: "No new materials found in CSV to import.", variant: "default"});
    }
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading materials...</p>
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
          <Archive className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Materials Management</h1>
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
            <Link href="/materials/form" passHref>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Material
                </Button>
            </Link>
        </div>
      </header>

      <Card className="shadow-md mb-6">
        <CardHeader>
            <CardTitle className="text-lg">CSV Import Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
            <p>To import materials from a CSV file, ensure your file has the following headers in the first row (case-insensitive):</p>
            <ul className="list-disc list-inside mt-2 pl-4 bg-muted/50 p-3 rounded-md">
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Name</code> (Required)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">UnitOfMeasure</code> (Required, e.g., pack, box, each)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Category</code> (Optional)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">ListPrice</code> (Optional, non-negative number)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">AssociatedTreatmentTemplateName</code> (Optional, exact name of an existing treatment template)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Notes</code> (Optional)</li>
            </ul>
            <p className="mt-2">Example CSV content:</p>
            <pre className="mt-1 p-2 bg-muted/50 rounded-md text-xs overflow-x-auto">
                Name,Category,UnitOfMeasure,ListPrice,AssociatedTreatmentTemplateName,Notes<br/>
                Surgical Gloves,Protection,box,15.99,Minor Surgery,100 pieces per box<br/>
                Gauze Pads,Wound Care,pack,8.99,Wound Dressing,50 pieces per pack
                Sutures 3-0 Silk,Surgical Supplies,pack,250.00,Post-Op Knee Checkup,Pack of 12<br/>
                Gauze Pads Large,Consumables,box,150.00,,Box of 100 sterile pads
            </pre>
        </CardContent>
      </Card>

      {materials.length === 0 ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Materials Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              There are no materials cataloged yet. Click "Add New Material" or "Import from CSV" to start.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Material List</CardTitle>
            <CardDescription>Overview of all cataloged materials.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="hidden md:table-cell text-right">List Price</TableHead>
                  <TableHead className="hidden lg:table-cell">Associated Treatment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.sort((a,b) => a.name.localeCompare(b.name)).map((mat) => (
                  <TableRow key={mat.id}>
                    <TableCell className="font-medium">{mat.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{mat.category || "N/A"}</TableCell>
                    <TableCell>{mat.unitOfMeasure}</TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                        {mat.listPrice !== undefined ? `₹${mat.listPrice.toFixed(2)}` : "N/A"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell truncate max-w-xs">{mat.associatedTreatmentTemplateName || "N/A"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link href={`/materials/form?id=${mat.id}`} passHref>
                        <Button variant="outline" size="sm" aria-label={`Edit ${mat.name}`}>
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
