
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TreatmentTemplate } from '@/config/treatmentTemplates'; // Using existing type
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit3, Trash2, Stethoscope, ArrowLeft, FileText } from 'lucide-react';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PAGE_ROLES } from '@/config/permissions';

const USER_TEMPLATES_STORAGE_KEY = 'userDefinedTreatmentTemplates';
const ALLOWED_ROLES: StaffRole[] = PAGE_ROLES.patientCare;


export default function PatientCarePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [userTemplates, setUserTemplates] = useState<TreatmentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [templateToDelete, setTemplateToDelete] = useState<TreatmentTemplate | null>(null);

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
      try {
        const storedTemplates = localStorage.getItem(USER_TEMPLATES_STORAGE_KEY);
        if (storedTemplates) {
          setUserTemplates(JSON.parse(storedTemplates));
        }
      } catch (error) {
        console.error("Error loading user templates from localStorage:", error);
        toast({ title: "Error", description: "Could not load custom treatment templates.", variant: "destructive" });
      }
      setIsLoading(false);
    } else if (currentUser && !ALLOWED_ROLES.includes(currentUser.role)) {
        setIsLoading(false);
    } else {
      setUserTemplates([]);
      setIsLoading(false);
    }
  }, [toast, currentUser]);

  const handleDeleteTemplate = () => {
    if (!templateToDelete) return;
    try {
      const updatedTemplates = userTemplates.filter(t => t.id !== templateToDelete.id);
      localStorage.setItem(USER_TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
      setUserTemplates(updatedTemplates);
      toast({ title: "Success", description: `Template "${templateToDelete.name}" deleted.` });
      setTemplateToDelete(null);
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({ title: "Error", description: "Could not delete template.", variant: "destructive" });
    }
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p>Loading treatment template manager...</p>
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
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Treatment Template Management</h1>
        </div>
        <div className='flex gap-2'>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
            <Link href="/patient-care/templates/form" passHref>
                <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
                </Button>
            </Link>
        </div>
      </header>

      <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Your Custom Treatment Templates</CardTitle>
            <CardDescription>
              Manage your custom templates for patient care notes. These templates will be available when adding care notes to a patient.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userTemplates.length === 0 ? (
                <div className='text-center py-8'>
                    <Stethoscope className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">You haven't created any custom treatment templates yet.</p>
                    <Link href="/patient-care/templates/form" passHref>
                        <Button variant="default">
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Template
                        </Button>
                    </Link>
                </div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                    <TableHead className="hidden md:table-cell">Field Count</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {userTemplates.map((template) => (
                    <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="hidden sm:table-cell truncate max-w-xs">{template.description || "N/A"}</TableCell>
                        <TableCell className="hidden md:table-cell">{template.careNoteFields.length}</TableCell>
                        <TableCell className="text-right space-x-2">
                        <Link href={`/patient-care/templates/form?id=${template.id}`} passHref>
                            <Button variant="outline" size="sm" aria-label={`Edit ${template.name}`}>
                            <Edit3 className="h-4 w-4" />
                            </Button>
                        </Link>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" onClick={() => setTemplateToDelete(template)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            {templateToDelete && templateToDelete.id === template.id && (
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the template
                                        "{templateToDelete.name}".
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteTemplate}>
                                        Delete Template
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            )}
                        </AlertDialog>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
        <Card className="mt-8 shadow-lg">
            <CardHeader>
                <CardTitle>Default System Templates</CardTitle>
                <CardDescription>
                These are built-in templates and cannot be modified or deleted.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <p className="text-sm text-muted-foreground">System templates like "General Note", "Post-Op Knee Checkup", etc., are automatically available when adding care notes.</p>
            </CardContent>
        </Card>

    </div>
  );
}

