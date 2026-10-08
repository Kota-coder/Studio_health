"use client";

import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { Edit3, FileText, PlusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageBody, PageHeader, PageLoading } from '@/components/page';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { TREATMENT_TEMPLATES, type TreatmentTemplate } from '@/config/treatmentTemplates';
import { treatmentTemplates as templatesRepo } from '@/lib/data';

// Templates for structured care notes on a patient's page. Built-in templates are listed
// for reference; the hospital's own can be added, changed and deleted.
// Access and the feature switch are checked by PageGuard (src/config/navigation.ts).
export default function CareNoteTemplatesPage() {
  const t = useT();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TreatmentTemplate[] | null>(null);
  const [toDelete, setToDelete] = useState<TreatmentTemplate | null>(null);

  useEffect(() => {
    templatesRepo.list()
      .then(setTemplates)
      .catch(() => {
        toast({ title: 'Error', description: 'Could not load the care note templates.', variant: 'destructive' });
        setTemplates([]);
      });
  }, [toast]);

  const deleteTemplate = async (template: TreatmentTemplate) => {
    try {
      await templatesRepo.remove(template.id);
      setTemplates(prev => (prev ?? []).filter(tpl => tpl.id !== template.id));
      toast({ title: 'Deleted', description: `Template "${template.name}" deleted.` });
    } catch {
      toast({ title: 'Could not delete the template', description: 'Please check your connection and try again.', variant: 'destructive' });
    }
  };

  if (!templates) return <PageLoading />;

  const builtIn = TREATMENT_TEMPLATES.filter(tpl => tpl.id !== 'none');

  return (
    <PageBody>
      <PageHeader icon={FileText} title={t('Care Note Templates')}
        description={t('Templates for structured care notes. They can be chosen when adding a care note to a patient.')}
        actions={<Button asChild><Link href="/patient-care/templates/form"><PlusCircle className="mr-2 h-4 w-4" /> {t('Add Template')}</Link></Button>} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Your templates')}</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No templates of your own yet.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template name</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead className="hidden md:table-cell">Fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(template => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="hidden max-w-xs truncate sm:table-cell">{template.description || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">{template.careNoteFields.length}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild aria-label={`Edit ${template.name}`}>
                          <Link href={`/patient-care/templates/form?id=${template.id}`}><Edit3 className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setToDelete(template)} aria-label={`Delete ${template.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Built-in templates')}</CardTitle>
          <CardDescription>Always available when adding care notes, along with a plain general note. They cannot be changed.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{builtIn.map(tpl => tpl.name).join(' · ')}</p>
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={open => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete this template?')}</AlertDialogTitle>
            <AlertDialogDescription>The template &quot;{toDelete?.name}&quot; will be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (toDelete) deleteTemplate(toDelete); }}>
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
