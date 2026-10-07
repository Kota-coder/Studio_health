
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { MedicalTestCatalogItem } from '@/types/medicalTestCatalogItem';
import { ArrowLeft, Save, FlaskConical } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';


const CATALOG_STORAGE_KEY = 'medicalTestCatalog';
const CATALOG_ID_COUNTER_KEY = 'nextMedicalTestCatalogId';
const ALLOWED_ROLES: StaffRole[] = ["Admin", "Doctor", "Nurse"];

export default function MedicalTestCatalogFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const itemIdToEdit = searchParams.get('id');
  const isEditMode = Boolean(itemIdToEdit);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPrice, setDefaultPrice] = useState<string>(""); // Stored as string for input

  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
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
    if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role) && !authIsLoading )) {
        setFormIsLoading(false);
        return;
    }
    setFormIsLoading(true);
    if (isEditMode && itemIdToEdit) {
      const storedCatalog = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (storedCatalog) {
        const catalog: MedicalTestCatalogItem[] = JSON.parse(storedCatalog);
        const itemToEdit = catalog.find(item => item.id === itemIdToEdit);
        if (itemToEdit) {
          setCurrentItemId(itemToEdit.id);
          setName(itemToEdit.name);
          setCategory(itemToEdit.category);
          setDescription(itemToEdit.description || "");
          setDefaultPrice(itemToEdit.defaultPrice !== undefined ? String(itemToEdit.defaultPrice) : "");
        } else {
          toast({ title: "Error", description: "Medical test item not found.", variant: "destructive" });
          router.push('/medical-tests');
        }
      }
    }
    setFormIsLoading(false);
  }, [isEditMode, itemIdToEdit, router, toast, currentUser, authIsLoading]);

  const handleSubmit = () => {
    if (!name.trim()) { toast({ title: "Validation Error", description: "Test Name is required.", variant: "destructive" }); return; }
    if (!category.trim()) { toast({ title: "Validation Error", description: "Category is required.", variant: "destructive" }); return; }
    
    let numDefaultPrice: number | undefined = undefined;
    if (defaultPrice.trim() !== "") {
        numDefaultPrice = parseFloat(defaultPrice);
        if (isNaN(numDefaultPrice) || numDefaultPrice < 0) {
            toast({ title: "Validation Error", description: "Default Price must be a valid non-negative number if provided.", variant: "destructive" }); return;
        }
    }

    const testItemData: Omit<MedicalTestCatalogItem, 'id'> = {
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || undefined,
      defaultPrice: numDefaultPrice,
    };

    try {
      const storedCatalog = localStorage.getItem(CATALOG_STORAGE_KEY);
      let catalog: MedicalTestCatalogItem[] = storedCatalog ? JSON.parse(storedCatalog) : [];
      
      if (isEditMode && currentItemId) {
        catalog = catalog.map(item => item.id === currentItemId ? { ...testItemData, id: currentItemId } : item);
        toast({ title: "Success", description: "Medical test item updated." });
      } else {
        const nextIdStr = localStorage.getItem(CATALOG_ID_COUNTER_KEY) || 'test_cat_1';
        let nextIdNum = 1;
        if (nextIdStr.startsWith('test_cat_')) {
             try { nextIdNum = parseInt(nextIdStr.split('_cat_')[1], 10) +1; } catch { /* keep 1 */ }
        }
        const newItemId = `test_cat_${nextIdNum}`;
        
        const newItem: MedicalTestCatalogItem = { ...testItemData, id: newItemId };
        catalog.push(newItem);
        localStorage.setItem(CATALOG_ID_COUNTER_KEY, `test_cat_${nextIdNum}`);
        toast({ title: "Success", description: "New medical test added to catalog." });
      }
      
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
      router.push('/medical-tests');

    } catch (e) {
      console.error("Failed to save medical test item to localStorage", e);
      toast({
        title: "Storage Error",
        description: "Could not save medical test data. LocalStorage might be full or disabled.",
        variant: "destructive",
      });
    }
  };
  
  if (authIsLoading || formIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading test catalog form...</p></div>;
  }
  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
     return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-lg mt-6 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <FlaskConical className="mr-3 h-7 w-7 text-primary"/>
            {isEditMode ? "Edit Medical Test" : "Add New Medical Test to Catalog"}
          </CardTitle>
          <CardDescription>
            {isEditMode ? "Update the details for this medical test." : "Define a new medical test for the catalog."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <Label htmlFor="testName">Test Name *</Label>
            <Input id="testName" value={name} onChange={(e) => setName(e.target.value)} required 
                   placeholder="e.g., Complete Blood Count (CBC)" />
          </div>
          <div>
            <Label htmlFor="category">Category *</Label>
            <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} required 
                   placeholder="e.g., Blood Work, Imaging, Cardiology"/>
          </div>
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea id="description" value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      placeholder="Briefly describe the test, its purpose, or components."/>
          </div>
          <div>
            <Label htmlFor="defaultPrice">Default Price (₹) (Optional)</Label>
            <Input id="defaultPrice" type="number" value={defaultPrice} 
                   onChange={(e) => setDefaultPrice(e.target.value)} 
                   placeholder="e.g., 1200.00" min="0" step="0.01"/>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => router.push('/medical-tests')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" /> {isEditMode ? "Save Changes" : "Add Test to Catalog"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
