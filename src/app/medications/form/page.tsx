
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
import { Medication } from '@/types/medication';
import { TreatmentTemplate, TREATMENT_TEMPLATES } from '@/config/treatmentTemplates';
import { ArrowLeft, Save, Pill } from 'lucide-react';
import { medications as medicationsRepo, treatmentTemplates as templatesRepo } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';


const ALLOWED_ROLES: StaffRole[] = ["Super Admin", "Admin", "Doctor", "Nurse"];


export default function MedicationFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const medicationIdToEdit = searchParams.get('id');
  const isEditMode = Boolean(medicationIdToEdit);

  const [name, setName] = useState("");
  const [treatment, setTreatment] = useState<string>(""); // Will store template name
  const [listPrice, setListPrice] = useState<number | string>("");
  const [quantityInPackage, setQuantityInPackage] = useState<number | string>("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  
  const [allTreatmentTemplates, setAllTreatmentTemplates] = useState<TreatmentTemplate[]>([]);
  const [currentMedicationId, setCurrentMedicationId] = useState<string | null>(null);
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

    templatesRepo.list()
      .then(userTemplates => setAllTreatmentTemplates([...TREATMENT_TEMPLATES, ...userTemplates]))
      .catch(e => {
        console.error("Error loading user-defined treatment templates:", e);
        setAllTreatmentTemplates([...TREATMENT_TEMPLATES]);
        toast({ title: "Warning", description: "Could not load custom treatment templates.", variant: "default" });
      });

    if (!(isEditMode && medicationIdToEdit)) {
      setFormIsLoading(false);
      return;
    }
    medicationsRepo.get(medicationIdToEdit).then(medToEdit => {
        if (medToEdit) {
          setCurrentMedicationId(medToEdit.id);
          setName(medToEdit.name);
          setTreatment(medToEdit.treatment);
          setListPrice(medToEdit.listPrice);
          setQuantityInPackage(medToEdit.quantityInPackage !== undefined ? String(medToEdit.quantityInPackage) : "");
          setUnitOfMeasure(medToEdit.unitOfMeasure);
          setAdditionalNotes(medToEdit.additionalNotes || "");
        } else {
          toast({ title: "Error", description: "Medication not found.", variant: "destructive" });
          router.push('/medications');
        }
    }).catch(error => {
      console.error("Error loading medication:", error);
      toast({ title: "Error", description: "Could not load medication.", variant: "destructive" });
    }).finally(() => setFormIsLoading(false));
  }, [isEditMode, medicationIdToEdit, router, toast, currentUser, authIsLoading]);

  const handleSubmit = async () => {
    if (!name.trim()) { toast({ title: "Validation Error", description: "Medication Name is required.", variant: "destructive" }); return; }
    if (!treatment) { toast({ title: "Validation Error", description: "Treatment / Purpose is required (select a template).", variant: "destructive" }); return; }
    
    const price = parseFloat(String(listPrice));
    if (isNaN(price) || price < 0) { toast({ title: "Validation Error", description: "List Price must be a valid non-negative number.", variant: "destructive" }); return; }
    
    let numQuantityInPackage: number | undefined = undefined;
    if (String(quantityInPackage).trim() !== "") {
        numQuantityInPackage = parseFloat(String(quantityInPackage));
        if (isNaN(numQuantityInPackage) || numQuantityInPackage <= 0) {
            toast({ title: "Validation Error", description: "Quantity in Package must be a positive number if provided.", variant: "destructive" }); return;
        }
        if (numQuantityInPackage % 1 !== 0) {
            toast({ title: "Validation Error", description: "Quantity in Package must be a whole number.", variant: "destructive" }); return;
        }
    }

    if (!unitOfMeasure.trim()) { toast({ title: "Validation Error", description: "Unit of Measure is required.", variant: "destructive" }); return; }

    const medicationData: Omit<Medication, 'id'> = {
      name: name.trim(),
      treatment: treatment, 
      listPrice: price,
      quantityInPackage: numQuantityInPackage,
      unitOfMeasure: unitOfMeasure.trim(),
      additionalNotes: additionalNotes.trim(),
    };

    try {
      if (isEditMode && currentMedicationId) {
        await medicationsRepo.update(currentMedicationId, medicationData);
        toast({ title: "Success", description: "Medication updated." });
      } else {
        await medicationsRepo.create(medicationData);
        toast({ title: "Success", description: "New medication added." });
      }
      router.push('/medications');
    } catch (e) {
      console.error("Failed to save medication", e);
      toast({
        title: "Save Error",
        description: "Could not save medication. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };
  
  if (authIsLoading || formIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading medication form...</p></div>;
  }

  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
    return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-lg mt-6 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Pill className="mr-3 h-7 w-7 text-primary"/>
            {isEditMode ? "Edit Medication" : "Add New Medication"}
          </CardTitle>
          <CardDescription>
            {isEditMode ? "Update the details for this medication." : "Fill in the details to add a new medication."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <Label htmlFor="name">Medication Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required 
                   placeholder="e.g., Amoxicillin 500mg" />
          </div>
          <div>
            <Label htmlFor="treatment">Treatment / Purpose *</Label>
            <Select onValueChange={setTreatment} value={treatment}>
                <SelectTrigger id="treatment">
                    <SelectValue placeholder="Select Treatment Template/Purpose" />
                </SelectTrigger>
                <SelectContent>
                    {allTreatmentTemplates.length > 0 ? (
                        allTreatmentTemplates.map(template => (
                            <SelectItem key={template.id} value={template.name}>
                                {template.name}
                            </SelectItem>
                        ))
                    ) : (
                        <div className="p-2 text-sm text-muted-foreground text-center">No treatment templates found.</div>
                    )}
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="listPrice">List Price (₹) for Package *</Label>
                <Input id="listPrice" type="number" value={String(listPrice)} 
                       onChange={(e) => setListPrice(e.target.value)} 
                       required placeholder="e.g., 150.75" min="0" step="0.01"/>
            </div>
             <div>
                <Label htmlFor="quantityInPackage">Quantity in Package (Optional, Whole Number)</Label>
                <Input id="quantityInPackage" type="number" value={String(quantityInPackage)} 
                       onChange={(e) => setQuantityInPackage(e.target.value)} 
                       placeholder="e.g., 10, 100" min="0" step="1"/>
            </div>
          </div>
           <div>
                <Label htmlFor="unitOfMeasure">Unit of Measure *</Label>
                <Input id="unitOfMeasure" value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} required 
                       placeholder="e.g., tablet, ml, bottle, strip"/>
            </div>
          <div>
            <Label htmlFor="additionalNotes">Additional Notes (Optional)</Label>
            <Textarea id="additionalNotes" value={additionalNotes} 
                      onChange={(e) => setAdditionalNotes(e.target.value)} 
                      placeholder="e.g., Storage instructions, common side effects, manufacturer, etc."/>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => router.push('/medications')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" /> {isEditMode ? "Save Changes" : "Add Medication"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
