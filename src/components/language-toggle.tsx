"use client";

import { LANGUAGES } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/language-provider';

// English / తెలుగు switch, shown in the header and on the login page.
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <div role="radiogroup" aria-label={t('Language')} className={cn('inline-flex rounded-md border bg-background p-0.5 text-sm', className)}>
      {LANGUAGES.map(option => (
        <button key={option.code} type="button" role="radio" aria-checked={lang === option.code} title={option.label}
          onClick={() => setLang(option.code)}
          className={cn('min-h-8 min-w-9 rounded px-2 font-medium transition-colors',
            lang === option.code ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {option.short}
        </button>
      ))}
    </div>
  );
}
