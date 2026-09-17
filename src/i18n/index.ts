/**
 * The words of the interface in the language of this page load.
 *
 * The dictionary is loaded with a top-level await, so every module that imports it runs only after
 * the words are there: a text taken at the top of a module, a message of a schema included, is
 * already in the right language. Each dictionary is a chunk of its own, and only the one needed
 * is loaded. Another language takes a reload (see locale.ts).
 */

import { currentLanguage } from '@/i18n/locale';
import type { Dictionary, Language } from '@/i18n/types';

async function load(language: Language): Promise<Dictionary> {
  const { ru } = await import('@/i18n/ru');
  if (language === 'ru') return ru;

  // Until the translation is whole, English is a draft over the Russian words.
  const [{ en }, { mergeDraft }] = await Promise.all([import('@/i18n/en'), import('@/i18n/merge')]);
  return mergeDraft(ru, en);
}

export const strings: Dictionary = await load(currentLanguage());

export { fill } from '@/i18n/fill';
export { currentLanguage, currentLocale } from '@/i18n/locale';
export { pluralForm } from '@/i18n/plural';
export type { Dictionary, Language, PluralForms } from '@/i18n/types';
