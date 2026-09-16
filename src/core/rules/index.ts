/**
 * Norms by year. They live here and nowhere else: a component must never hard-code a
 * limit or a rate, or nobody will find it when the law changes.
 */

import { RULES_2026 } from './2026';
import type { YearRules } from './types';

export type { ChildDeduction, Norm, TaxBand, YearRules } from './types';

const BY_YEAR: readonly YearRules[] = [RULES_2026];

/** The rules of a year, or the latest ones we know if that year is not described yet. */
export function rulesForYear(year: number): YearRules {
  const exact = BY_YEAR.find((rules) => rules.year === year);
  if (exact) return exact;

  return BY_YEAR.reduce((latest, rules) => (rules.year <= year && rules.year > latest.year ? rules : latest));
}
