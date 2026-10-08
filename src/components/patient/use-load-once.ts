"use client";

import { useCallback, useRef, useState } from 'react';
import { TREATMENT_TEMPLATES, type TreatmentTemplate } from '@/config/treatmentTemplates';
import { medications, testCatalog, treatmentTemplates } from '@/lib/data';

// Loads a list the first time ensure() is called (e.g. when a form opens) and keeps it.
// A failed load is retried on the next call.
export function useLoadOnce<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const pending = useRef<Promise<T> | null>(null);
  const ensure = useCallback(() => {
    pending.current ??= load().then(
      value => { setData(value); return value; },
      error => { pending.current = null; throw error; },
    );
    return pending.current;
  }, [load]);
  return { data, ensure };
}

// Built-in care note templates plus the hospital's own.
export const loadTreatmentTemplates = async (): Promise<TreatmentTemplate[]> => [...TREATMENT_TEMPLATES, ...await treatmentTemplates.list()];
export const loadTestCatalog = () => testCatalog.list();
export const loadMedications = () => medications.list();
