/**
 * Norms by country and year. They live here and nowhere else: a component must never hard-code a
 * limit or a rate, or nobody will find it when the law changes.
 */

import type { Country } from '../country';
import { RU_RULES_2023 } from './ru/2023';
import { RU_RULES_2024 } from './ru/2024';
import { RU_RULES_2025 } from './ru/2025';
import { RU_RULES_2026 } from './ru/2026';
import type { RuYearRules } from './ru/types';
import { US_RULES_2026 } from './us/2026';
import type { UsYearRules } from './us/types';

export type { MonthDay, Norm, YearRules } from './types';
export type { ChildDeduction, HomeSaleRules, RuYearRules, TaxBand } from './ru/types';
export type { UsYearRules } from './us/types';

/** The norms of a year in each country. */
export interface CountryRules {
  readonly ru: RuYearRules;
  readonly us: UsYearRules;
}

/**
 * Oldest first. A year of Russia is added while a refund for it can still be claimed; a year of the
 * United States, while its limits still matter.
 */
export const KNOWN_RULES: { readonly [C in Country]: readonly CountryRules[C][] } = {
  ru: [RU_RULES_2023, RU_RULES_2024, RU_RULES_2025, RU_RULES_2026],
  us: [US_RULES_2026],
};

/** The most recent rules written for the country. */
export function latestRules<C extends Country>(country: C): CountryRules[C] {
  const known: readonly CountryRules[C][] = KNOWN_RULES[country];
  return known[known.length - 1];
}

/**
 * The rules a year was lived under.
 *
 * A year after the last one written borrows the last one: a new year starts before
 * anybody writes its file, and the returned rules still say which year they are, so a
 * screen can tell the person the numbers are borrowed.
 *
 * A year before the first one written gets nothing. The law of the past was different
 * — lower limits, another tax scale — and a refund for an old year counted by newer
 * rules would promise money that is not due.
 */
export function rulesForYear<C extends Country>(country: C, year: number): CountryRules[C] | undefined {
  const known: readonly CountryRules[C][] = KNOWN_RULES[country];
  if (year < known[0].year) return undefined;

  return known.reduce((found, rules) => (rules.year <= year ? rules : found));
}
