import { SOURCES } from './sources';
import type { UsYearRules } from './types';

/** The day every norm below was read from its source. */
const CHECKED = '2026-09-18';

export const US_RULES_2026: UsYearRules = {
  year: 2026,
  depositInsuranceLimitMinor: {
    value: 250_000 * 100,
    source: SOURCES.depositInsurance,
    checkedAt: CHECKED,
    note:
      'Per depositor, per insured bank, for each account ownership category: single, joint, certain ' +
      'retirement accounts such as an IRA, trust accounts and others each have a limit of their own. ' +
      'The app does not know the ownership categories and counts every account of a bank together.',
  },

  deferralLimits: {
    value: {
      electiveDeferralMinor: 24_500 * 100,
      catchUpFrom50Minor: 8_000 * 100,
      catchUpFrom60To63Minor: 11_250 * 100,
    },
    source: SOURCES.retirementLimits2026,
    checkedAt: CHECKED,
    note:
      'What the person defers from their own pay into a 401(k), 403(b), most 457(b) plans and the ' +
      'federal Thrift Savings Plan — one limit for all of them together, pre-tax and Roth alike. ' +
      'What the employer matches lies outside it, under a much higher limit for the plan as a whole, ' +
      'which the app does not count. A plan of its own may allow less than the law does.',
  },

  iraLimits: {
    value: { contributionMinor: 7_500 * 100, catchUpFrom50Minor: 1_100 * 100 },
    source: SOURCES.retirementLimits2026,
    checkedAt: CHECKED,
    note:
      'One limit for every IRA of a person, traditional and Roth together. How much of it may be ' +
      'deducted, and whether a Roth is allowed at all, depends on the income and on the plan at work; ' +
      'the app does not check either. A contribution for a year may be made until the tax return is due.',
  },

  hsaLimits: {
    value: {
      selfOnlyMinor: 4_400 * 100,
      familyMinor: 8_750 * 100,
      catchUpFrom55Minor: 1_000 * 100,
      minimumDeductibleSelfOnlyMinor: 1_700 * 100,
      minimumDeductibleFamilyMinor: 3_400 * 100,
    },
    source: SOURCES.hsaLimits2026,
    checkedAt: CHECKED,
    note:
      'The limit covers what the person and the employer put in together. Only a person under a high ' +
      'deductible health plan may contribute, and a year with cover for part of it allows less; the ' +
      'app knows neither the cover nor the months of it. The catch-up from 55 is set by § 223(b)(3) ' +
      'of the code and does not grow with prices.',
  },

  giftExclusionMinor: {
    value: 19_000 * 100,
    source: SOURCES.giftExclusion2026,
    checkedAt: CHECKED,
    note:
      'A 529 has no federal contribution limit: the state sets how much the account may hold in all. ' +
      'A contribution is a gift, so more than this to one child in a year is reported on a gift return, ' +
      'and five years of gifts may be put in at once by an election on that return. Married parents ' +
      'have this much each.',
  },
};
