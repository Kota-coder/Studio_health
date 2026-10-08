// English / Telugu. Text is written in English in the code and looked up in the Telugu
// dictionary (src/lib/i18n/te.ts), which is only downloaded when someone chooses Telugu;
// anything not translated shows in English.

export type Lang = 'en' | 'te';
export const LANGUAGES: Array<{ code: Lang; label: string; short: string }> = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'te', label: 'తెలుగు', short: 'తె' },
];
export const isLang = (value: unknown): value is Lang => value === 'en' || value === 'te';

export type Vars = Record<string, string | number>;

// translate(dictionary, 'Bills for {name}', { name: 'Ravi' })
export function translate(dictionary: Record<string, string> | null, text: string, vars?: Vars): string {
  const template = dictionary?.[text] ?? text;
  return vars ? template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match)) : template;
}

// The Telugu dictionary and date names, loaded on first use.
export const loadTelugu = () => Promise.all([import('./te'), import('date-fns/locale/te')])
  .then(([dictionary, locale]) => ({ dictionary: dictionary.TE, locale: locale.te }));
