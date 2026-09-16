/**
 * Pension capital — formula 12 of docs/PLAN.md, section 5, and the steps of lesson 7.4
 * that lead to it.
 *
 * The capital is counted through the real return, with the yearly payments at the start
 * of each year and growing with inflation. The course divides a year of spending by the
 * nominal return instead; that capital pays the same rubles every year and loses half of
 * their worth in about ten, so it is kept only to show why it is too little.
 */

import { realReturnRate } from './goals';

export interface PensionNeedParams {
  /** What is spent in a month now. */
  readonly monthlyExpensesMinor: number;
  /** The share of today's spending that is comfortable on retirement: 70 % in the lesson. */
  readonly replacementRate: number;
  /** The state pension a month, in today's prices. */
  readonly statePensionMinor: number;
  readonly inflationRate: number;
  /** From today's prices to the year of retiring. */
  readonly months: number;
}

export interface PensionNeed {
  /** The spending wanted on retirement, in today's prices. */
  readonly desiredMonthlyMinor: number;
  /** What the state pension leaves to the capital, in today's prices. Never below zero. */
  readonly gapTodayMinor: number;
  /** The same in the prices of the year of retiring. */
  readonly gapAtRetirementMinor: number;
  /** A of formula 12: a year of that. */
  readonly annualSpendingMinor: number;
}

/** Steps 1–5 of lesson 7.4: from today's spending to A of formula 12. */
export function pensionNeed(params: PensionNeedParams): PensionNeed {
  const desiredMonthlyMinor = params.monthlyExpensesMinor * params.replacementRate;
  const gapTodayMinor = Math.max(0, desiredMonthlyMinor - params.statePensionMinor);
  const gapAtRetirementMinor =
    gapTodayMinor * Math.pow(1 + params.inflationRate, Math.max(0, params.months) / 12);

  return {
    desiredMonthlyMinor,
    gapTodayMinor,
    gapAtRetirementMinor,
    annualSpendingMinor: gapAtRetirementMinor * 12,
  };
}

export type PensionStrategy =
  /** Live off the income: the capital itself stays, for instance for the children. */
  | { readonly kind: 'keep-capital' }
  /** Spend the capital down to zero over the given number of years. */
  | { readonly kind: 'spend-capital'; readonly years: number };

export interface PensionCapitalParams {
  /** A: a year of spending in the prices of the year of retiring, less the state pension. */
  readonly annualSpendingMinor: number;
  readonly returnRate: number;
  readonly inflationRate: number;
  readonly strategy: PensionStrategy;
}

function assertYears(years: number): void {
  if (!Number.isInteger(years) || years < 1) {
    throw new RangeError(`years: срок — целое число лет от одного, получено ${String(years)}`);
  }
}

/**
 * Formula 12: the capital needed on the day of retiring.
 * - keep-capital: K = A * (1 + r_real) / r_real;
 * - spend-capital: K = sum over k = 0..T-1 of A * (1 + inflation)^k / (1 + r)^k.
 *
 * Living off the income is impossible when the return does not beat inflation: no
 * capital is large enough, and the answer is null.
 */
export function pensionCapitalMinor(params: PensionCapitalParams): number | null {
  const { annualSpendingMinor: spending, returnRate, inflationRate, strategy } = params;
  if (strategy.kind === 'spend-capital') assertYears(strategy.years);
  if (spending <= 0) return 0;

  if (strategy.kind === 'keep-capital') {
    const real = realReturnRate(returnRate, inflationRate);
    if (real <= 0) return null;
    return (spending * (1 + real)) / real;
  }

  const ratio = (1 + inflationRate) / (1 + returnRate);
  let capital = 0;
  let factor = 1;
  for (let year = 0; year < strategy.years; year += 1) {
    capital += spending * factor;
    factor *= ratio;
  }
  return capital;
}

/** The course's A / r: only to explain why it is too little. Null without a return. */
export function courseCapitalMinor(annualSpendingMinor: number, returnRate: number): number | null {
  if (returnRate <= 0) return null;
  return annualSpendingMinor / returnRate;
}

export interface PensionDrawdownParams {
  readonly capitalMinor: number;
  readonly annualSpendingMinor: number;
  readonly returnRate: number;
  readonly inflationRate: number;
  readonly years: number;
}

export interface PensionYear {
  /** Years since retiring: 0 is the first year. */
  readonly index: number;
  readonly startMinor: number;
  /** Taken at the start of the year, in the prices of that year. */
  readonly paymentMinor: number;
  /** What is left at the end of the year with its return. Below zero, the money ran out. */
  readonly endMinor: number;
}

/**
 * The capital on retirement, year by year, under the same assumptions as formula 12:
 * the payment is taken at the start of the year and the rest earns the return.
 */
export function pensionDrawdown(params: PensionDrawdownParams): PensionYear[] {
  assertYears(params.years);
  const rows: PensionYear[] = [];
  let balance = params.capitalMinor;

  for (let index = 0; index < params.years; index += 1) {
    const paymentMinor = params.annualSpendingMinor * Math.pow(1 + params.inflationRate, index);
    const endMinor = (balance - paymentMinor) * (1 + params.returnRate);
    rows.push({ index, startMinor: balance, paymentMinor, endMinor });
    balance = endMinor;
  }
  return rows;
}
