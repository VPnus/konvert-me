import type { Norm, YearRules } from '../types';

/** What a person may put aside from their pay into a retirement plan of the employer in a year. */
export interface DeferralLimits {
  /** What the person puts in themselves; what the employer adds lies outside this limit. */
  readonly electiveDeferralMinor: number;
  /** From the year a person turns 50 they may put in this much more. */
  readonly catchUpFrom50Minor: number;
  /** From 60 to 63 the larger one is allowed instead, and from 64 the usual one comes back. */
  readonly catchUpFrom60To63Minor: number;
}

/** One limit serves every IRA of a person, traditional and Roth together. */
export interface IraLimits {
  readonly contributionMinor: number;
  readonly catchUpFrom50Minor: number;
}

/** A health savings account belongs to the person, not to the employer, and follows their cover. */
export interface HsaLimits {
  readonly selfOnlyMinor: number;
  readonly familyMinor: number;
  /** From 55. Fixed by the law itself, so it never grows with prices. */
  readonly catchUpFrom55Minor: number;
  /** The health plan must leave at least this much unpaid before it starts paying. */
  readonly minimumDeductibleSelfOnlyMinor: number;
  readonly minimumDeductibleFamilyMinor: number;
}

/**
 * The norms of a year in the United States: what the tax advantaged accounts take in a year.
 * The tax itself the app does not count — the rates and the brackets are the person's own business.
 */
export interface UsYearRules extends YearRules {
  /** A 401(k) and its kin: a 403(b), a 457(b), the federal Thrift Savings Plan. */
  readonly deferralLimits: Norm<DeferralLimits>;
  readonly iraLimits: Norm<IraLimits>;
  readonly hsaLimits: Norm<HsaLimits>;
  /**
   * A 529 has no federal limit of its own: the state sets how much the account may hold, and a
   * contribution counts as a gift, so above this much a year per child a gift return is filed.
   */
  readonly giftExclusionMinor: Norm<number>;
}
