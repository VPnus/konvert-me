/**
 * The financial plan of lesson 2.7: what the diagnosis calls the budget, and when the
 * plan is due for another look.
 */

import type { IsoDate } from './time';
import { addMonthsToDate, daysBetween } from './time';

export type BudgetBalance = 'deficit' | 'balanced' | 'surplus';

/** Lesson 2.4: income below the spending, equal to it, or above. */
export function budgetBalance(freeCashMinor: number): BudgetBalance {
  if (freeCashMinor < 0) return 'deficit';
  if (freeCashMinor === 0) return 'balanced';
  return 'surplus';
}

export type ReviewKind = 'quarterly' | 'yearly';

export interface ReviewParams {
  /** When the plan was first put together. */
  readonly startedOn: IsoDate;
  readonly quarterlyReviewedOn?: IsoDate | null;
  readonly yearlyReviewedOn?: IsoDate | null;
  readonly today: IsoDate;
}

export interface ReviewState {
  readonly nextQuarterly: IsoDate;
  readonly nextYearly: IsoDate;
  /** Which look is due today; the yearly one when both are. */
  readonly due: ReviewKind | null;
  /** Days until the nearer of the two; below zero when it is overdue. */
  readonly daysToNext: number;
}

function latest(dates: readonly (IsoDate | null | undefined)[]): IsoDate {
  return dates
    .filter((date): date is IsoDate => Boolean(date))
    .sort()
    .at(-1) as IsoDate;
}

/**
 * Step 8 of lesson 2.7: the results of the year so far once a quarter, and once a year the
 * plan against new plans in life. A yearly look covers the quarter as well.
 */
export function reviewState(params: ReviewParams): ReviewState {
  const lastYearly = latest([params.startedOn, params.yearlyReviewedOn]);
  const lastAny = latest([params.startedOn, params.quarterlyReviewedOn, params.yearlyReviewedOn]);

  const nextQuarterly = addMonthsToDate(lastAny, 3);
  const nextYearly = addMonthsToDate(lastYearly, 12);
  const nearer = nextQuarterly < nextYearly ? nextQuarterly : nextYearly;

  const due: ReviewKind | null =
    params.today >= nextYearly ? 'yearly' : params.today >= nextQuarterly ? 'quarterly' : null;

  return { nextQuarterly, nextYearly, due, daysToNext: daysBetween(params.today, nearer) };
}
