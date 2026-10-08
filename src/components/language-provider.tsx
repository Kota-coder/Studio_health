"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import type { Locale } from 'date-fns';
import { isLang, loadTelugu, translate, type Lang, type Vars } from '@/lib/i18n';
import { formatDate } from '@/lib/format';

const STORAGE_KEY = 'seva.lang';

interface LanguageContextValue {
  lang: Lang;
  // Changes the language; saved on this device and, when signed in, to the person's profile.
  setLang: (lang: Lang, options?: { save?: boolean }) => void;
  t: (text: string, vars?: Vars) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => undefined,
  t: (text, vars) => translate(null, text, vars),
});
const DateLocaleContext = createContext<Locale | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [telugu, setTelugu] = useState<{ dictionary: Record<string, string>; locale: Locale } | null>(null);

  // Pages are built in English; switch after loading if this device chose Telugu.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLang(saved)) setLangState(saved);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // English users never download the Telugu text.
  useEffect(() => {
    if (lang === 'te' && !telugu) loadTelugu().then(setTelugu).catch(error => console.error('Could not load Telugu', error));
  }, [lang, telugu]);

  const setLang = useCallback((next: Lang, options?: { save?: boolean }) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
    if (options?.save !== false) {
      getSupabase().rpc('set_my_language', { lang: next }).then(({ error }) => {
        if (error && !/JWT|not authenticated|permission/i.test(error.message)) console.error('Could not save the language', error);
      });
    }
  }, []);

  const dictionary = lang === 'te' ? telugu?.dictionary ?? null : null;
  const value = useMemo<LanguageContextValue>(() => ({
    lang, setLang, t: (text, vars) => translate(dictionary, text, vars),
  }), [lang, setLang, dictionary]);

  return (
    <LanguageContext.Provider value={value}>
      <DateLocaleContext.Provider value={lang === 'te' ? telugu?.locale : undefined}>{children}</DateLocaleContext.Provider>
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
// t('Save') -> 'సేవ్ చేయండి' when Telugu is chosen.
export const useT = () => useContext(LanguageContext).t;

// Dates in the chosen language: const { date } = useFormat(); date(bill.billDate)
export function useFormat() {
  const locale = useContext(DateLocaleContext);
  return useMemo(() => ({
    date: (value: string | Date | null | undefined, pattern?: string) => formatDate(value, pattern, locale),
  }), [locale]);
}
