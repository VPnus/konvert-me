/**
 * The language of this page load. It is read once, before anything is shown: another language takes
 * a reload, so a page never mixes two. Kept apart from the dictionaries, so the formats of the
 * financial core know the language without loading any words.
 */

import type { Language } from '@/i18n/types';

export const LANGUAGE_STORAGE_KEY = 'konvert-me.language';
export const LANGUAGES: readonly Language[] = ['ru', 'en'];

const LOCALES: Record<Language, string> = { ru: 'ru-RU', en: 'en-US' };

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * The language chosen on this device, Russian otherwise. Until English is finished (stage 9.5)
 * nothing in the interface chooses it, and the language of the browser is not asked.
 */
export function readLanguage(store: Storage | null = storage()): Language {
  try {
    const saved = store?.getItem(LANGUAGE_STORAGE_KEY);
    return LANGUAGES.find((language) => language === saved) ?? 'ru';
  } catch {
    return 'ru';
  }
}

/** Remembers the language; it takes effect with the next load of the page. */
export function writeLanguage(language: Language, store: Storage | null = storage()): void {
  try {
    store?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // A private window may refuse: the page stays in its language.
  }
}

let current: Language = readLanguage();

export function currentLanguage(): Language {
  return current;
}

/** For Intl: "ru-RU" or "en-US". */
export function currentLocale(): string {
  return LOCALES[current];
}

/** Tests only: the formats of another language, without a reload. The words stay as loaded. */
export function setLanguageForTests(language: Language): void {
  current = language;
}
