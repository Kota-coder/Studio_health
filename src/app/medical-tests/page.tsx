
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MedicalTestCatalogItem } from '@/types/medicalTestCatalogItem';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Trash2, FlaskConical, ArrowLeft, Upload } from 'lucide-react';
import { testCatalog as testCatalogRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PAGE_ROLES } from '@/config/permissions';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.medicalTests;

export default function MedicalTestsCatalogPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [testCatalog, setTestCatalog] = useState<MedicalTestCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<MedicalTestCatalogItem | null>(null);
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
      testCatalogRepo.list()
        .then(setTestCatalog)
        .catch(error => {
          console.error("Error loading medical test catalog:", error);
          toast({ title: "Error", description: "Could not load medical test catalog data.", variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else if (currentUser && !ALLOWED_ROLES.includes(currentUser.role)){
        setIsLoading(false);
    } else {
      setTestCatalog([]);
      setIsLoading(false);
    }
  }, [toast, currentUser]);

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await testCatalogRepo.remove(itemToDelete.id);
      setTestCatalog(testCatalog.filter(item => item.id !== itemToDelete.id));
      toast({ title: "Success", description: `Test "${itemToDelete.name}" deleted from catalog.` });
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting test catalog item:", error);
      toast({ title: "Error", description: "Could not delete test item.", variant: "destructive" });
    }
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
    const expectedHeaders = ['name', 'category']; // description and defaultprice are optional
    
    if (!expectedHeaders.every(eh => header.includes(eh))) {
        toast({ title: "CSV Error", description: `CSV header must contain at least: ${expectedHeaders.join(', ')}. Optional: description, defaultprice. Found: ${header.join(', ')}`, variant: "destructive" });
        return;
    }
    
    const nameIndex = header.indexOf('name');
    const categoryIndex = header.indexOf('category');
    const descriptionIndex = header.indexOf('description');
    const defaultPriceIndex = header.indexOf('defaultprice');

    const newItems: Omit<MedicalTestCatalogItem, 'id'>[] = [];

    let importedCount = 0;
    let failedCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split(',').map(cell => cell.trim());
      
      const name = cells[nameIndex];
      const category = cells[categoryIndex];
      const description = descriptionIndex > -1 ? cells[descriptionIndex] : "";
      const defaultPriceStr = defaultPriceIndex > -1 ? cells[defaultPriceIndex] : undefined;

      if (!name) { console.warn(`Skipping CSV row ${i+1}: Name is missing.`); failedCount++; continue; }
      if (!category) { console.warn(`Skipping CSV row ${i+1} for test "${name}": Category is missing.`); failedCount++; continue; }
      
      let defaultPrice: number | undefined = undefined;
      if (defaultPriceStr && defaultPriceStr.trim() !== "") {
        defaultPrice = parseFloat(defaultPriceStr);
        if (isNaN(defaultPrice) || defaultPrice < 0) {
          console.warn(`Skipping CSV row ${i+1} for test "${name}": Invalid Default Price "${defaultPriceStr}".`);
          failedCount++;
          continue;
        }
      }

      const newItem: Omit<MedicalTestCatalogItem, 'id'> = {
        name,
        category,
        description,
        defaultPrice,
      };
      newItems.push(newItem);
      importedCount++;
    }

    if (importedCount > 0) {
        try {
            await testCatalogRepo.createMany(newItems);
            setTestCatalog(await testCatalogRepo.list());
            toast({ title: "Import Successful", description: `${importedCount} tests imported into catalog. ${failedCount > 0 ? `${failedCount} rows failed.` : ''}` });
        } catch (e) {
            console.error("Error saving imported test catalog:", e);
            toast({ title: "Save Error", description: "Could not save imported test catalog.", variant: "destructive" });
        }
    } else if (failedCount > 0) {
         toast({ title: "Import Failed", description: `No tests imported. ${failedCount} rows had errors. Check console for details.`, variant: "destructive" });
    } else {
        toast({ title: "Import Info", description: "No new tests found in CSV to import.", variant: "default" });
    }
  };

  if (authIsLoading || isLoading) {
    return <div className="flex flex-col items-center justify-center min-h-screen p-4"><p>Loading medical test catalog...</p></div>;
  }
  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Medical Tests Catalog</h1>
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
          <Link href="/medical-tests/form" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Test
            </Button>
          </Link>
        </div>
      </header>

       <Card className="shadow-md mb-6">
        <CardHeader>
            <CardTitle className="text-lg">CSV Import Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
            <p>To import tests from a CSV file, ensure your file has the following headers (case-insensitive):</p>
            <ul className="list-disc list-inside mt-2 pl-4 bg-muted/50 p-3 rounded-md">
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Name</code> (Required)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Category</code> (Required)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">Description</code> (Optional)</li>
                <li><code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">DefaultPrice</code> (Optional, non-negative number)</li>
            </ul>
            <p className="mt-2">Example:</p>
            <pre className="mt-1 p-2 bg-muted/50 rounded-md text-xs overflow-x-auto">
                Name,Category,Description,DefaultPrice<br/>
                Complete Blood Count (CBC),Blood Work,Standard panel of blood tests,1200.00<br/>
                Chest X-Ray,Imaging,Standard chest x-ray views,800.00
            </pre>
        </CardContent>
      </Card>

      {testCatalog.length === 0 ? (
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle>No Medical Tests in Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
              The medical test catalog is empty. Add tests manually or import them from a CSV file.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>All Cataloged Medical Tests</CardTitle>
            <CardDescription>List of all medical tests available in the catalog.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Default Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testCatalog.sort((a,b) => a.name.localeCompare(b.name)).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      {item.defaultPrice !== undefined ? `₹${item.defaultPrice.toFixed(2)}` : "N/A"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link href={`/medical-tests/form?id=${item.id}`} passHref>
                        <Button variant="outline" size="sm" aria-label={`Edit ${item.name}`}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => {
                          setItemToDelete(item);
                          const confirmed = window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`);
                          if (confirmed) {
                            handleDeleteItem();
                          } else {
                            setItemToDelete(null);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
