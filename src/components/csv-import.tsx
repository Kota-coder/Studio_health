"use client";

import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { parseCsvRecords } from '@/lib/csv';

export interface CsvColumn {
  name: string; // header in the file (matched without regard to case)
  required?: boolean;
  hint?: string; // e.g. "number, e.g. 12.50"
}

// "Import from CSV" button: explains the columns, reads the chosen file and hands the rows
// (keyed by lower-case column name) to importRows, which saves the valid ones.
export function CsvImport({ what, columns, example, importRows, disabled }: {
  what: string; // e.g. "pharmacy items" (already translated)
  columns: CsvColumn[];
  example?: string; // a sample line
  importRows: (rows: Record<string, string>[]) => Promise<{ imported: number; skipped: number }>;
  disabled?: boolean;
}) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      toast({ title: t('Choose a CSV file'), description: t('Save the spreadsheet as CSV and try again.'), variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { headers, records } = parseCsvRecords(await file.text());
      const missing = columns.filter(c => c.required && !headers.includes(c.name.toLowerCase())).map(c => c.name);
      if (missing.length) {
        toast({ title: t('Missing columns'), description: t('The file needs these columns: {columns}.', { columns: missing.join(', ') }), variant: 'destructive' });
        return;
      }
      if (records.length === 0) {
        toast({ title: t('Nothing to import'), description: t('The file has no rows under the headings.') });
        return;
      }
      const { imported, skipped } = await importRows(records);
      toast({
        title: imported ? t('Imported {n} {what}', { n: imported, what }) : t('Nothing imported'),
        description: skipped ? t('{n} rows were skipped because of missing or invalid values.', { n: skipped }) : undefined,
        variant: imported ? undefined : 'destructive',
      });
      if (imported) setOpen(false);
    } catch (error) {
      toast({ title: t('Import failed'), description: error instanceof Error ? error.message : t('Something went wrong. Please try again.'), variant: 'destructive' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled}><FileUp className="mr-2 h-4 w-4" /> {t('Import from CSV')}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Import {what} from CSV', { what })}</DialogTitle>
            <DialogDescription>{t('The first row must hold these column names (in any order). Columns marked * are required.')}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {columns.map(c => (
              <li key={c.name}><code className="rounded bg-muted px-1">{c.name}</code>{c.required ? ' *' : ''}{c.hint ? <span className="text-muted-foreground"> — {c.hint}</span> : null}</li>
            ))}
          </ul>
          {example && <p className="break-all rounded bg-muted p-2 font-mono text-xs">{example}</p>}
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
            <Button onClick={() => input.current?.click()} disabled={busy}><FileUp className="mr-2 h-4 w-4" /> {busy ? t('Importing…') : t('Choose file')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
