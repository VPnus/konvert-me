import type { IsoDate } from '../time';

/**
 * A number the state sets, not the user: a limit, a rate, a threshold. Every one of
 * them carries where it came from and when it was last checked, so a stale rule can
 * be found without reading the code that uses it.
 */
export interface Norm<T> {
  readonly value: T;
  /** The page the value was read from. */
  readonly source: string;
  readonly checkedAt: IsoDate;
  /** What the value does not cover — exceptions the app cannot detect by itself. */
  readonly note?: string;
}

/**
 * One step of the income tax scale. The rate applies only to what rises above
 * `fromMinor`, not to the whole income — the scale is progressive, not a cliff.
 */
export interface TaxBand {
  /** Yearly income above this is taxed at `rate`. The first band starts at 0. */
  readonly fromMinor: number;
  /** 0.13 for 13 %. Not money, so not in kopecks. */
  readonly rate: number;
}

/**
 * The standard deduction a working parent gets for each child, per month, until the
 * income of the year passes `incomeCapMinor`.
 */
export interface ChildDeduction {
  readonly firstMinor: number;
  readonly secondMinor: number;
  readonly thirdAndOnMinor: number;
  /** A disabled child is worth this much more — to a parent or an adoptive parent. */
  readonly disabledParentMinor: number;
  /** And this much to a guardian, a trustee or a foster parent: half as much. */
  readonly disabledGuardianMinor: number;
  /** Counted from the start of the year; past it the deduction stops for that year. */
  readonly incomeCapMinor: number;
}

export interface YearRules {
  readonly year: number;
  /** Deposit insurance: what one bank pays back per person if it fails. */
  readonly depositInsuranceLimitMinor: Norm<number>;
  /** The progressive income tax scale, cheapest band first. */
  readonly incomeTaxBands: Norm<readonly TaxBand[]>;
  /** The pot the social deductions share: treatment, schooling, sport, and so on. */
  readonly socialDeductionLimitMinor: Norm<number>;
  /** Schooling of one child has its own pot, outside the shared one. */
  readonly childEducationLimitMinor: Norm<number>;
  readonly childDeduction: Norm<ChildDeduction>;
  /** Buying or building a home: once in a life, but over one home or several. */
  readonly propertyPurchaseLimitMinor: Norm<number>;
  /** Interest on the loan for a home: for one home only. */
  readonly mortgageInterestLimitMinor: Norm<number>;
  /** A year of money put away for the long term — an investment account and its kin. */
  readonly longTermSavingsLimitMinor: Norm<number>;
  /** How many years back a deduction can still be claimed. */
  readonly deductionYearsBack: Norm<number>;
}
