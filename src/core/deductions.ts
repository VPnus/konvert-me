/**
 * Tax deductions — what a deduction is worth and how much of a year's spending
 * counts towards one.
 *
 * Section 5 of docs/PLAN.md has no formulas for this: stage 7 is accepted on the
 * examples of the tax service, and the tests say which example each case comes from.
 * The numbers themselves — limits, rates, borders — come from src/core/rules.
 */

import { assertNonNegativeMinor, type Minor } from './money';
import type { TaxBand, YearRules } from './rules/types';

/** Rates are kept as basis points inside, so a slice of income times a rate stays whole. */
const BASIS_POINTS = 10_000;
/** A whole rouble in kopecks times basis points: the unit the tax is rounded in. */
const ROUBLE_IN_TAX_UNITS = 100 * BASIS_POINTS;

/**
 * Income tax on a year of income under the progressive scale: each band takes its
 * rate only from the part of the income that lies inside it.
 *
 * Tax code, art. 52 p. 6: the tax is counted in whole roubles — under 50 kopecks is
 * dropped, 50 and over rounds up. The sum is carried in whole units and divided once,
 * so no rate like 0,13 ever meets a binary fraction on the way.
 */
export function incomeTaxMinor(incomeMinor: number, bands: readonly TaxBand[]): Minor {
  assertNonNegativeMinor(incomeMinor, 'incomeMinor');

  let taxUnits = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const from = bands[index].fromMinor;
    if (incomeMinor <= from) break;

    const to = index + 1 < bands.length ? bands[index + 1].fromMinor : Infinity;
    taxUnits += (Math.min(incomeMinor, to) - from) * Math.round(bands[index].rate * BASIS_POINTS);
  }

  return Math.floor((taxUnits + ROUBLE_IN_TAX_UNITS / 2) / ROUBLE_IN_TAX_UNITS) * 100;
}

/**
 * What a deduction gives back: the tax that was paid on the income, less the tax the
 * income would have paid with the deduction taken off it. The deduction comes off the
 * top, so above a border it returns the higher rate; and it can never give back more
 * than was paid in the first place.
 */
export function refundMinor(incomeMinor: number, deductionMinor: number, bands: readonly TaxBand[]): Minor {
  assertNonNegativeMinor(deductionMinor, 'deductionMinor');

  const paid = incomeTaxMinor(incomeMinor, bands);
  const owed = incomeTaxMinor(Math.max(0, incomeMinor - deductionMinor), bands);
  return paid - owed;
}

/** A year of spending that social deductions are made of. */
export interface SocialSpending {
  /** Treatment, medicine, one's own schooling, sport, voluntary insurance: one shared pot. */
  readonly commonMinor: number;
  /** Schooling paid for each child, one entry per child. */
  readonly childEducationMinor: readonly number[];
  /** Treatment from the government's list of expensive ones: no limit at all. */
  readonly expensiveTreatmentMinor: number;
}

/**
 * The social deduction of a year: the shared pot up to its limit, each child's
 * schooling up to its own limit, and expensive treatment in full.
 */
export function socialDeductionMinor(
  spending: SocialSpending,
  rules: Pick<YearRules, 'socialDeductionLimitMinor' | 'childEducationLimitMinor'>,
): Minor {
  assertNonNegativeMinor(spending.commonMinor, 'commonMinor');
  assertNonNegativeMinor(spending.expensiveTreatmentMinor, 'expensiveTreatmentMinor');

  const childLimit = rules.childEducationLimitMinor.value;
  let children = 0;
  for (const paid of spending.childEducationMinor) {
    assertNonNegativeMinor(paid, 'childEducationMinor');
    children += Math.min(paid, childLimit);
  }

  return (
    Math.min(spending.commonMinor, rules.socialDeductionLimitMinor.value) +
    children +
    spending.expensiveTreatmentMinor
  );
}

/**
 * The years a return can still be filed for: as far back as the law allows, and not
 * the current year — a year is claimed only once it is over.
 */
export function claimableYears(currentYear: number, yearsBack: number): number[] {
  return Array.from({ length: yearsBack }, (_, index) => currentYear - yearsBack + index);
}
