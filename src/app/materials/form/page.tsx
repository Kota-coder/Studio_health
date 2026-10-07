
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Material } from '@/types/material';
import { TreatmentTemplate, TREATMENT_TEMPLATES } from '@/config/treatmentTemplates'; // For treatment template selection
import { ArrowLeft, Save, Archive } from 'lucide-react';
import { materials as materialsRepo, treatmentTemplates as templatesRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';
import { PAGE_ROLES } from '@/config/permissions';

const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.materials;
const NO_TEMPLATE_OPTION_VALUE = "__NO_TEMPLATE_OPTION_VALUE__"; // Unique value for the "None" option

export default function MaterialFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const materialIdToEdit = searchParams.get('id');
  const isEditMode = Boolean(materialIdToEdit);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [listPrice, setListPrice] = useState<number | string>("");
  const [associatedTreatmentTemplateName, setAssociatedTreatmentTemplateName] = useState<string>("");
  const [notes, setNotes] = useState("");
  
  const [allTreatmentTemplates, setAllTreatmentTemplates] = useState<TreatmentTemplate[]>([]);
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
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

    const load = async () => {
      try {
        const userTemplates = await templatesRepo.list();
        setAllTreatmentTemplates([...TREATMENT_TEMPLATES, ...userTemplates]);
      } catch (e) {
        console.error("Error loading user-defined treatment templates:", e);
        setAllTreatmentTemplates([...TREATMENT_TEMPLATES]);
        toast({ title: "Warning", description: "Could not load custom treatment templates.", variant: "default" });
      }

      if (isEditMode && materialIdToEdit) {
        try {
          const matToEdit = await materialsRepo.get(materialIdToEdit);
          if (matToEdit) {
            setCurrentMaterialId(matToEdit.id);
            setName(matToEdit.name);
            setCategory(matToEdit.category || "");
            setUnitOfMeasure(matToEdit.unitOfMeasure);
            setListPrice(matToEdit.listPrice !== undefined ? String(matToEdit.listPrice) : "");
            setAssociatedTreatmentTemplateName(matToEdit.associatedTreatmentTemplateName || "");
            setNotes(matToEdit.notes || "");
          } else {
            toast({ title: "Error", description: "Material not found.", variant: "destructive" });
            router.push('/materials');
          }
        } catch (e) {
          console.error("Error loading material:", e);
          toast({ title: "Error", description: "Could not load material.", variant: "destructive" });
        }
      }
      setFormIsLoading(false);
    };
    load();
  }, [isEditMode, materialIdToEdit, router, toast, currentUser, authIsLoading]);

  const handleSubmit = async () => {
    if (!name.trim()) { toast({ title: "Validation Error", description: "Material Name is required.", variant: "destructive" }); return; }
    if (!unitOfMeasure.trim()) { toast({ title: "Validation Error", description: "Unit of Measure is required.", variant: "destructive" }); return; }
    
    let numListPrice: number | undefined = undefined;
    if (String(listPrice).trim() !== "") {
        numListPrice = parseFloat(String(listPrice));
        if (isNaN(numListPrice) || numListPrice < 0) {
            toast({ title: "Validation Error", description: "List Price must be a valid non-negative number if provided.", variant: "destructive" }); return;
        }
    }

    const materialData: Omit<Material, 'id'> = {
      name: name.trim(),
      category: category.trim() || undefined,
      unitOfMeasure: unitOfMeasure.trim(),
      listPrice: numListPrice,
      associatedTreatmentTemplateName: associatedTreatmentTemplateName || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      if (isEditMode && currentMaterialId) {
        await materialsRepo.update(currentMaterialId, materialData);
        toast({ title: "Success", description: "Material updated." });
      } else {
        await materialsRepo.create(materialData);
        toast({ title: "Success", description: "New material added." });
      }
      router.push('/materials');
    } catch (e) {
      console.error("Failed to save material", e);
      toast({
        title: "Save Error",
        description: "Could not save material data. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };
  
  if (authIsLoading || formIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading material form...</p></div>;
  }

  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-lg mt-6 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Archive className="mr-3 h-7 w-7 text-primary"/>
            {isEditMode ? "Edit Material" : "Add New Material"}
          </CardTitle>
          <CardDescription>
            {isEditMode ? "Update the details for this material." : "Fill in the details to add a new material to the catalog."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <Label htmlFor="name">Material Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required 
                   placeholder="e.g., Sutures 3-0 Silk, Gauze Pads Large" />
          </div>
          <div>
            <Label htmlFor="category">Category (Optional)</Label>
            <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} 
                   placeholder="e.g., Surgical Supplies, Consumables, Disposables" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="unitOfMeasure">Unit of Measure *</Label>
                <Input id="unitOfMeasure" value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} required 
                       placeholder="e.g., pack, box, each, roll"/>
            </div>
            <div>
                <Label htmlFor="listPrice">List Price (₹) per Unit (Optional)</Label>
                <Input id="listPrice" type="number" value={String(listPrice)} 
                       onChange={(e) => setListPrice(e.target.value)} 
                       placeholder="e.g., 250.00" min="0" step="0.01"/>
            </div>
          </div>
          <div>
            <Label htmlFor="associatedTreatmentTemplateName">Associated Treatment Template (Optional)</Label>
            <Select 
              onValueChange={(value) => {
                if (value === NO_TEMPLATE_OPTION_VALUE) {
                  setAssociatedTreatmentTemplateName("");
                } else {
                  setAssociatedTreatmentTemplateName(value);
                }
              }} 
              value={associatedTreatmentTemplateName}
            >
                <SelectTrigger id="associatedTreatmentTemplateName">
                    <SelectValue placeholder="Select Associated Treatment Template" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NO_TEMPLATE_OPTION_VALUE}>None</SelectItem> 
                    {allTreatmentTemplates.filter(t => t.id !== 'none').map(template => ( // Exclude "General Note"
                        <SelectItem key={template.id} value={template.name}>
                            {template.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea id="notes" value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="e.g., Specific supplier, storage instructions, reorder point, etc."/>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => router.push('/materials')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" /> {isEditMode ? "Save Changes" : "Add Material"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
