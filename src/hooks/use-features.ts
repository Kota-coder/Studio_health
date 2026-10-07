"use client";

import { useMemo } from 'react';
import { useBranding } from '@/components/branding-provider';
import { effectiveDisabled } from '@/config/modules';

// isOn('billing') is false when the hospital has switched Billing off (src/config/modules.ts).
export function useFeatures() {
  const { profile } = useBranding();
  const disabled = profile.disabledModules;
  return useMemo(() => {
    const off = effectiveDisabled(disabled);
    return { isOn: (key: string) => !off.has(key) };
  }, [disabled]);
}
