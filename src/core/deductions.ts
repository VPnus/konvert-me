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

/** What was spent on a home that a property deduction is made of. */
export interface PropertyClaim {
  /** What was paid for the home itself. */
  readonly purchaseMinor: number;
  /** Interest paid on the loan for it so far. */
  readonly mortgageInterestMinor: number;
  /** A loan taken before 2014 has no limit on its interest. */
  readonly loanBefore2014: boolean;
}

/** The property deduction a home gives: the purchase and the interest, each up to its limit. */
export function propertyDeductionMinor(
  claim: PropertyClaim,
  rules: Pick<YearRules, 'propertyPurchaseLimitMinor' | 'mortgageInterestLimitMinor'>,
): Minor {
  assertNonNegativeMinor(claim.purchaseMinor, 'purchaseMinor');
  assertNonNegativeMinor(claim.mortgageInterestMinor, 'mortgageInterestMinor');

  const interest = claim.loanBefore2014
    ? claim.mortgageInterestMinor
    : Math.min(claim.mortgageInterestMinor, rules.mortgageInterestLimitMinor.value);

  return Math.min(claim.purchaseMinor, rules.propertyPurchaseLimitMinor.value) + interest;
}

/** One year a property deduction can be spent against. */
export interface TaxYear {
  readonly year: number;
  readonly incomeMinor: number;
  /**
   * Deductions of the same year that do not carry over — social, standard. The law sets
   * no order, but those die with their year and this one does not, so they go first.
   */
  readonly otherDeductionsMinor: number;
  /** The tax scale of that year: a refund is counted by the rules it was paid under. */
  readonly bands: readonly TaxBand[];
}

export interface CarriedYear {
  readonly year: number;
  /** How much of the deduction the year took. */
  readonly usedMinor: number;
  /** What that part gives back. */
  readonly refundMinor: number;
  /** What is left for the years after. */
  readonly leftMinor: number;
}

/**
 * Tax code, art. 220 p. 10: a year takes as much of the property deduction as its
 * income allows, and the rest moves on until it is used in full. Years go oldest first.
 */
export function carryPropertyDeduction(deductionMinor: number, years: readonly TaxYear[]): CarriedYear[] {
  assertNonNegativeMinor(deductionMinor, 'deductionMinor');

  let left = deductionMinor;
  return years.map((taxYear, index) => {
    if (index > 0 && taxYear.year <= years[index - 1].year) {
      throw new RangeError(`Годы должны идти по порядку: ${years[index - 1].year}, затем ${taxYear.year}`);
    }
    assertNonNegativeMinor(taxYear.incomeMinor, 'incomeMinor');
    assertNonNegativeMinor(taxYear.otherDeductionsMinor, 'otherDeductionsMinor');

    const base = Math.max(0, taxYear.incomeMinor - taxYear.otherDeductionsMinor);
    const used = Math.min(left, base);
    left -= used;

    return {
      year: taxYear.year,
      usedMinor: used,
      refundMinor: refundMinor(base, used, taxYear.bands),
      leftMinor: left,
    };
  });
}

/** Contributions to an investment account and other long-term savings, up to the yearly limit. */
export function longTermSavingsDeductionMinor(
  contributionsMinor: number,
  rules: Pick<YearRules, 'longTermSavingsLimitMinor'>,
): Minor {
  assertNonNegativeMinor(contributionsMinor, 'longTermSavingsMinor');
  return Math.min(contributionsMinor, rules.longTermSavingsLimitMinor.value);
}

/** What a person claims for one year, in the terms of the law. */
export interface DeductionClaim {
  /** Income before tax, taxed on the progressive scale. */
  readonly incomeMinor: number;
  readonly social: SocialSpending;
  /** Contributions to an investment account and other long-term savings. */
  readonly longTermSavingsMinor: number;
  /** A home, as this year's return states it: what earlier returns took is taken off. */
  readonly property?: PropertyClaim & { readonly usedBeforeMinor: number };
}

export interface DeductionSummary {
  readonly taxPaidMinor: Minor;
  readonly socialDeductionMinor: Minor;
  readonly socialRefundMinor: Minor;
  readonly longTermSavingsDeductionMinor: Minor;
  readonly longTermSavingsRefundMinor: Minor;
  readonly property?: {
    /** What was left of the home's deduction when the year began. */
    readonly availableMinor: Minor;
    readonly usedMinor: Minor;
    readonly refundMinor: Minor;
    /** What moves on to the returns of the years after. */
    readonly leftMinor: Minor;
  };
  /** Everything the year gives back — never more than the tax it paid. */
  readonly refundMinor: Minor;
}

/**
 * One year of deductions, the way a return is counted. The deductions that die with the
 * year — social ones and long-term savings — are spent first; the home takes what income
 * is left, and its rest moves on. Each part's refund is what it takes off the tax after
 * the parts before it, so the parts add up to the whole.
 */
export function summarizeDeductionYear(claim: DeductionClaim, rules: YearRules): DeductionSummary {
  const bands = rules.incomeTaxBands.value;
  const social = socialDeductionMinor(claim.social, rules);
  const savings = longTermSavingsDeductionMinor(claim.longTermSavingsMinor, rules);

  const socialRefund = refundMinor(claim.incomeMinor, social, bands);
  const afterSocial = Math.max(0, claim.incomeMinor - social);
  const savingsRefund = refundMinor(afterSocial, savings, bands);

  let property: DeductionSummary['property'];
  if (claim.property) {
    assertNonNegativeMinor(claim.property.usedBeforeMinor, 'usedBeforeMinor');
    const available = Math.max(
      0,
      propertyDeductionMinor(claim.property, rules) - claim.property.usedBeforeMinor,
    );
    const [year] = carryPropertyDeduction(available, [
      { year: rules.year, incomeMinor: claim.incomeMinor, otherDeductionsMinor: social + savings, bands },
    ]);
    property = {
      availableMinor: available,
      usedMinor: year.usedMinor,
      refundMinor: year.refundMinor,
      leftMinor: year.leftMinor,
    };
  }

  return {
    taxPaidMinor: incomeTaxMinor(claim.incomeMinor, bands),
    socialDeductionMinor: social,
    socialRefundMinor: socialRefund,
    longTermSavingsDeductionMinor: savings,
    longTermSavingsRefundMinor: savingsRefund,
    property,
    refundMinor: socialRefund + savingsRefund + (property?.refundMinor ?? 0),
  };
}
