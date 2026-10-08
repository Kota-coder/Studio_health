"use client";

import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/components/language-provider';
import type { TestRequest } from '@/types/testRequest';

// The test name with its priority and where the request stands, e.g.
// "CBC [Urgent] · With Ravi · asked by Dr. Mehta 25 min ago".
export function RequestSummary({ request, showPatient }: { request: TestRequest; showPatient?: boolean }) {
  const t = useT();
  const where = request.assignedToStaffName
    ? (request.status === 'In progress' ? t('In progress with {name}', { name: request.assignedToStaffName }) : t('Assigned to {name}', { name: request.assignedToStaffName }))
    : t('Waiting in queue');
  const ago = formatDistanceToNowStrict(parseISO(request.createdAt), { addSuffix: true });
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
        {showPatient && request.patientName && <span className="break-words">{request.patientName} ·</span>}
        <span className="break-words">{request.testTypeName}</span>
        {request.priority === 'Urgent' && <Badge variant="destructive">{t('Urgent')}</Badge>}
      </p>
      <p className="text-xs text-muted-foreground break-words">
        {where} · {t('asked by {name}', { name: request.requestedByStaffName ?? '—' })} {ago}
      </p>
      {request.notes && <p className="mt-0.5 whitespace-pre-wrap text-xs break-words">{request.notes}</p>}
    </div>
  );
}
