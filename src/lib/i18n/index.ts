// English / Telugu. Text is written in English in the code and looked up in the Telugu
// dictionary (src/lib/i18n/te.ts); anything not translated yet shows in English.
import { TE } from './te';

export type Lang = 'en' | 'te';
export const LANGUAGES: Array<{ code: Lang; label: string; short: string }> = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'te', label: 'తెలుగు', short: 'తె' },
];
export const isLang = (value: unknown): value is Lang => value === 'en' || value === 'te';

export type Vars = Record<string, string | number>;

// translate('te', 'Bills for {name}', { name: 'Ravi' })
export function translate(lang: Lang, text: string, vars?: Vars): string {
  const template = lang === 'te' ? TE[text] ?? text : text;
  return vars ? template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match)) : template;
}
