/**
 * Norms by year. They live here and nowhere else: a component must never hard-code a
 * limit or a rate, or nobody will find it when the law changes.
 */

import { RULES_2023 } from './2023';
import { RULES_2024 } from './2024';
import { RULES_2025 } from './2025';
import { RULES_2026 } from './2026';
import type { YearRules } from './types';

export type { ChildDeduction, Norm, TaxBand, YearRules } from './types';

/** Oldest first. A year is added when a refund for it can still be claimed. */
export const KNOWN_RULES: readonly YearRules[] = [RULES_2023, RULES_2024, RULES_2025, RULES_2026];

/** The most recent rules written. */
export function latestRules(): YearRules {
  return KNOWN_RULES[KNOWN_RULES.length - 1];
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
export function rulesForYear(year: number): YearRules | undefined {
  if (year < KNOWN_RULES[0].year) return undefined;

  return KNOWN_RULES.reduce((found, rules) => (rules.year <= year ? rules : found));
}
