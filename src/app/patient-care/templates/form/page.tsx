
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { TreatmentTemplate, TreatmentTemplateField, TreatmentTemplateFieldOption } from '@/config/treatmentTemplates';
import { ArrowLeft, Save, PlusCircle, Trash2, GripVertical, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { StaffRole } from '@/types/staff';

const USER_TEMPLATES_STORAGE_KEY = 'userDefinedTreatmentTemplates';
const TEMPLATE_ID_COUNTER_KEY = 'nextTreatmentTemplateId';

const FIELD_TYPES: TreatmentTemplateField['fieldType'][] = ["text", "textarea", "number", "select"];
const ALLOWED_ROLES: StaffRole[] = ["Admin", "Doctor", "Nurse"];

// Helper to generate unique IDs for fields
const generateFieldId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

export default function TreatmentTemplateFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const templateIdToEdit = searchParams.get('id');
  const isEditMode = Boolean(templateIdToEdit);

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [fields, setFields] = useState<TreatmentTemplateField[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
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
    if (isEditMode && templateIdToEdit) {
      const storedTemplates = localStorage.getItem(USER_TEMPLATES_STORAGE_KEY);
      if (storedTemplates) {
        const templates: TreatmentTemplate[] = JSON.parse(storedTemplates);
        const templateToEdit = templates.find(t => t.id === templateIdToEdit);
        if (templateToEdit) {
          setCurrentTemplateId(templateToEdit.id);
          setTemplateName(templateToEdit.name);
          setTemplateDescription(templateToEdit.description || "");
          setFields(templateToEdit.careNoteFields.map(f => ({...f, options: f.options || []}))); // Ensure options is array
        } else {
          toast({ title: "Error", description: "Template not found.", variant: "destructive" });
          router.push('/patient-care');
        }
      }
    } else {
        // Initialize with one empty field for new templates
        setFields([{ fieldId: generateFieldId(), label: "", fieldType: "text", required: false, options: [] }]);
    }
    setFormIsLoading(false);
  }, [isEditMode, templateIdToEdit, router, toast, currentUser, authIsLoading]);

  const handleAddField = () => {
    setFields([...fields, { fieldId: generateFieldId(), label: "", fieldType: "text", required: false, options: [] }]);
  };

  const handleRemoveField = (index: number) => {
    if (fields.length > 1) {
        setFields(fields.filter((_, i) => i !== index));
    } else {
        toast({title: "Info", description: "At least one field is required for a template.", variant: "default"});
    }
  };

  const handleFieldChange = (index: number, property: keyof TreatmentTemplateField, value: any) => {
    const newFields = [...fields];
    if (property === 'options' && typeof value === 'string') { // Special handling for options string
        try {
            // Expecting options as "Label1:value1,Label2:value2"
            const parsedOptions: TreatmentTemplateFieldOption[] = value.split(',')
                .map((optStr: string) => {
                    const parts = optStr.split(':');
                    return { label: parts[0]?.trim() || "", value: parts[1]?.trim() || "" };
                })
                .filter((opt: TreatmentTemplateFieldOption) => opt.label && opt.value); // Basic validation
            newFields[index][property] = parsedOptions;
        } catch (e) {
            toast({title: "Warning", description: "Could not parse options. Format: Label1:value1,Label2:value2", variant:"default"});
            // Keep old options or set to empty if parsing fails
        }
    } else {
      (newFields[index] as any)[property] = value;
    }
    // If field type changes from 'select', clear options
    if (property === 'fieldType' && value !== 'select') {
        newFields[index].options = [];
    }
    setFields(newFields);
  };
  
  const handleOptionChange = (fieldIndex: number, optionIndex: number, property: keyof TreatmentTemplateFieldOption, value: string) => {
    const newFields = [...fields];
    const field = newFields[fieldIndex];
    if (field.options) {
        const newOptions = [...field.options];
        (newOptions[optionIndex] as any)[property] = value;
        field.options = newOptions;
        setFields(newFields);
    }
  };

  const handleAddOption = (fieldIndex: number) => {
    const newFields = [...fields];
    const field = newFields[fieldIndex];
    if (field.fieldType === 'select') {
        field.options = [...(field.options || []), {label: "", value: ""}];
        setFields(newFields);
    }
  };

  const handleRemoveOption = (fieldIndex: number, optionIndex: number) => {
     const newFields = [...fields];
     const field = newFields[fieldIndex];
     if (field.options && field.options.length > 1) {
        field.options = field.options.filter((_, i) => i !== optionIndex);
        setFields(newFields);
     } else {
        toast({title:"Info", description: "At least one option is required for a select field.", variant:"default"});
     }
  };


  const handleSubmit = () => {
    if (!templateName.trim()) {
      toast({ title: "Validation Error", description: "Template Name is required.", variant: "destructive" });
      return;
    }
    if (fields.some(f => !f.label.trim())) {
      toast({ title: "Validation Error", description: "All fields must have a Label.", variant: "destructive" });
      return;
    }
    if (fields.some(f => f.fieldType === 'select' && (!f.options || f.options.length === 0 || f.options.some(opt => !opt.label.trim() || !opt.value.trim())))) {
      toast({ title: "Validation Error", description: "All 'Select' type fields must have at least one option with non-empty label and value.", variant: "destructive" });
      return;
    }


    const templateData: Omit<TreatmentTemplate, 'id'> = {
      name: templateName.trim(),
      description: templateDescription.trim(),
      careNoteFields: fields.map(f => ({
          ...f, 
          // Ensure fieldId is present, re-generate if somehow missing (shouldn't happen with current logic)
          fieldId: f.fieldId || generateFieldId() 
      })),
    };

    try {
      const storedTemplates = localStorage.getItem(USER_TEMPLATES_STORAGE_KEY);
      let templates: TreatmentTemplate[] = storedTemplates ? JSON.parse(storedTemplates) : [];
      
      if (isEditMode && currentTemplateId) {
        templates = templates.map(t => t.id === currentTemplateId ? { ...templateData, id: currentTemplateId } : t);
        toast({ title: "Success", description: "Treatment template updated." });
      } else {
        const nextIdStr = localStorage.getItem(TEMPLATE_ID_COUNTER_KEY) || 'user_tpl_1';
        let nextIdNum = 1;
        if (nextIdStr.startsWith('user_tpl_')) {
            try { nextIdNum = parseInt(nextIdStr.split('_')[2], 10) +1; } catch { /* keep 1 */ }
        }
        const newTemplateId = `user_tpl_${nextIdNum}`;
        
        const newTemplate: TreatmentTemplate = { ...templateData, id: newTemplateId };
        templates.push(newTemplate);
        localStorage.setItem(TEMPLATE_ID_COUNTER_KEY, `user_tpl_${nextIdNum}`);
        toast({ title: "Success", description: "New treatment template created." });
      }
      
      localStorage.setItem(USER_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
      router.push('/patient-care');

    } catch (e) {
      console.error("Failed to save template to localStorage", e);
      toast({
        title: "Storage Error",
        description: "Could not save template data. LocalStorage might be full or disabled.",
        variant: "destructive",
      });
    }
  };
  
  if (authIsLoading || formIsLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p>Loading template form...</p></div>;
  }
  if (!currentUser || (currentUser && !ALLOWED_ROLES.includes(currentUser.role))) {
     return <div className="flex justify-center items-center min-h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-2xl mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <FileText className="mr-3 h-7 w-7 text-primary"/>
            {isEditMode ? "Edit Treatment Template" : "Create New Treatment Template"}
          </CardTitle>
          <CardDescription>
            {isEditMode ? "Update the details for this template." : "Define a new template for structured care notes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div>
            <Label htmlFor="templateName">Template Name *</Label>
            <Input id="templateName" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required 
                   placeholder="e.g., Cardiac Stress Test Follow-up" />
          </div>
          <div>
            <Label htmlFor="templateDescription">Description (Optional)</Label>
            <Textarea id="templateDescription" value={templateDescription} 
                      onChange={(e) => setTemplateDescription(e.target.value)} 
                      placeholder="Briefly describe the purpose of this template." />
          </div>

          <Card className="p-4 bg-muted/50">
            <CardTitle className="text-lg mb-3">Template Fields</CardTitle>
            {fields.map((field, index) => (
              <div key={field.fieldId || index} className="border p-3 rounded-md mb-3 bg-background shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                    <Label className="font-semibold text-md">Field {index + 1}</Label>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveField(index)} className="text-destructive hover:bg-destructive/10" title="Remove Field">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                <div>
                  <Label htmlFor={`fieldLabel-${index}`}>Field Label * (What the user sees)</Label>
                  <Input id={`fieldLabel-${index}`} value={field.label} 
                         onChange={(e) => handleFieldChange(index, 'label', e.target.value)} 
                         placeholder="e.g., Blood Pressure, Medication Dosage" />
                </div>
                <div>
                  <Label htmlFor={`fieldType-${index}`}>Field Type *</Label>
                  <Select value={field.fieldType} onValueChange={(value) => handleFieldChange(index, 'fieldType', value as TreatmentTemplateField['fieldType'])}>
                    <SelectTrigger id={`fieldType-${index}`}>
                      <SelectValue placeholder="Select field type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(type => <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {field.fieldType === 'select' && (
                    <div className="pl-4 border-l-2 border-primary/50 space-y-2 mt-2 pt-2">
                        <Label className="font-medium text-sm">Options for Select List:</Label>
                        {(field.options || []).map((option, optIndex) => (
                            <div key={optIndex} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                <Input 
                                    value={option.label} 
                                    onChange={(e) => handleOptionChange(index, optIndex, 'label', e.target.value)}
                                    placeholder={`Option ${optIndex + 1} Label`}
                                    className="text-sm h-9"
                                />
                                <Input 
                                    value={option.value} 
                                    onChange={(e) => handleOptionChange(index, optIndex, 'value', e.target.value)}
                                    placeholder={`Option ${optIndex + 1} Value`}
                                    className="text-sm h-9"
                                />
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(index, optIndex)} className="text-destructive hover:bg-destructive/10 h-9 w-9">
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                         <Button variant="outline" size="sm" onClick={() => handleAddOption(index)} className="mt-1">
                            <PlusCircle className="mr-2 h-3 w-3" /> Add Option
                        </Button>
                    </div>
                )}

                <div>
                  <Label htmlFor={`fieldPlaceholder-${index}`}>Placeholder (Optional)</Label>
                  <Input id={`fieldPlaceholder-${index}`} value={field.placeholder || ""} 
                         onChange={(e) => handleFieldChange(index, 'placeholder', e.target.value)} 
                         placeholder="e.g., Enter patient's current weight in kg" />
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id={`fieldRequired-${index}`} checked={field.required} 
                              onCheckedChange={(checked) => handleFieldChange(index, 'required', checked)} />
                    <Label htmlFor={`fieldRequired-${index}`} className="text-sm font-normal">
                        Make this field required?
                    </Label>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={handleAddField} className="mt-2 w-full md:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Another Field
            </Button>
          </Card>

        </CardContent>
        <CardFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => router.push('/patient-care')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" /> {isEditMode ? "Save Changes" : "Create Template"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
