"use client";

import { useState } from 'react';
import { History } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import { patients as patientsRepo } from '@/lib/data';
import type { AuditLogEntry } from '@/types/patient';

// Who changed what on the patient's record, newest first. Loaded when it is opened (and
// again each time, so it includes changes made since).
export function AuditTrail({ patientId }: { patientId: number }) {
  const t = useT();
  const { date } = useFormat();
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);

  const load = () => {
    setEntries(null);
    patientsRepo.auditLog(patientId)
      .then(list => setEntries([...list].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))))
      .catch(() => setEntries([]));
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5 text-primary" />{t('Patient History & Audit Log')}</CardTitle>
        <CardDescription>Record of changes made to this patient&apos;s profile and care.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full" onValueChange={value => { if (value) load(); }}>
          <AccordionItem value="audit-log">
            <AccordionTrigger className="py-2 text-sm hover:no-underline">View Audit Log</AccordionTrigger>
            <AccordionContent className="pt-2">
              {entries === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : entries.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">No audit log entries yet.</p>
              ) : (
                <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                  {entries.map(log => (
                    <Card key={log.id} className="break-words bg-muted/50 p-3 text-sm">
                      <p className="mb-1 text-xs text-muted-foreground">
                        {date(log.timestamp, 'dd MMM yyyy, HH:mm:ss')} by <span className="font-semibold text-foreground">{log.staffName}</span>
                      </p>
                      <p><span className="font-medium">{log.actionType}:</span> {log.changeDetails}</p>
                    </Card>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
