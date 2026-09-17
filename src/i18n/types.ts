import type { Ru } from '@/i18n/ru';

export type Language = 'ru' | 'en';

/**
 * The words of a language in the shape of the Russian dictionary. A `key` keeps its literal type:
 * the code picks a feature or a section of a page by it, whatever the language.
 */
export type Words<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly Words<Item>[]
    : { readonly [K in keyof T]: K extends 'key' ? T[K] : Words<T[K]> };

export type Dictionary = Words<Ru>;

/** A dictionary still being translated: what it does not have yet is taken from the Russian one. */
export type Draft<T = Ru> = T extends string
  ? string
  : T extends readonly unknown[]
    ? Words<T>
    : { readonly [K in keyof T]?: Draft<T[K]> };

/** A word that changes with a number: "1 месяц", "3 месяца", "5 месяцев"; English needs one and other. */
export interface PluralForms {
  readonly one: string;
  readonly few: string;
  readonly many: string;
  readonly other: string;
}
