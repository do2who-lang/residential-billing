import { en, type TranslationKey } from './en';
import { ar } from './ar';

export type { TranslationKey };
export type Lang = 'en' | 'ar';

export const LANGS: Lang[] = ['en', 'ar'];

const dictionaries: Record<Lang, Partial<Record<TranslationKey, string>>> = { en, ar };

export const dirOf = (lang: Lang): 'ltr' | 'rtl' => (lang === 'ar' ? 'rtl' : 'ltr');

export function translate(
  lang: Lang,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const raw = dictionaries[lang]?.[key] ?? en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function isLang(value: string | null | undefined): value is Lang {
  return value === 'en' || value === 'ar';
}
