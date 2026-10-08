"use client";

import { History } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormat, useT } from '@/components/language-provider';
import type { AuditLogEntry } from '@/types/patient';

// Who changed what on the patient's record, newest first.
export function AuditTrail({ entries = [] }: { entries?: AuditLogEntry[] }) {
  const t = useT();
  const { date } = useFormat();
  const sorted = [...entries].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5 text-primary" />{t('Patient History & Audit Log')}</CardTitle>
        <CardDescription>Record of changes made to this patient&apos;s profile and care.</CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No audit log entries yet.</p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="audit-log">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                View Audit Log ({sorted.length} {sorted.length === 1 ? 'entry' : 'entries'})
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                  {sorted.map(log => (
                    <Card key={log.id} className="break-words bg-muted/50 p-3 text-sm">
                      <p className="mb-1 text-xs text-muted-foreground">
                        {date(log.timestamp, 'dd MMM yyyy, HH:mm:ss')} by <span className="font-semibold text-foreground">{log.staffName}</span>
                      </p>
                      <p><span className="font-medium">{log.actionType}:</span> {log.changeDetails}</p>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
