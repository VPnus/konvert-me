/**
 * The operations the list shows. Unlike the table of plan and fact, the list is not bound to one
 * month: it answers a period, and it answers with a total of everything it found, not only of the
 * page it shows.
 */

import { totalsByCategoryOf, totalsOf, type MonthTotals } from '@/core/budget';
import { topSlices, type Slice } from '@/core/slices';
import { rangeOfPeriod } from '@/core/period';
import type { IsoMonth } from '@/core/time';
import type { Transaction } from '@/db/models';
import { findTransactions } from '@/db/repositories/transactions';
import { filterToQuery, type TransactionFilterState } from '@/features/budget/transaction-filter';

export interface OperationsData {
  /** The page of rows on the screen, newest first. */
  readonly rows: Transaction[];
  /** How many the filter found in total; the page can be shorter. */
  readonly found: number;
  /** Income and expenses of everything found, by formula 7. */
  readonly totals: MonthTotals;
  /** How many the period holds without the other conditions: an empty list needs the right words. */
  readonly inPeriod: number;
  /**
   * Where the expenses went over the period: the biggest categories by name and the tail as one.
   * Every condition of the filter is counted in but the chosen categories themselves — a category
   * picked on the chart has to stay next to the others, or the picture would collapse to one bar
   * and there would be nothing left to compare it with.
   */
  readonly expenses: Slice[];
}

/** The key the tail of the categories gets; no category of a user can be called this. */
export const REST_KEY = '__rest__';

export interface OperationsOptions {
  readonly filter: TransactionFilterState;
  /** The month chosen on the screen: "this month" and "three months" are read against it. */
  readonly anchor: IsoMonth;
  readonly limit: number;
}

export async function loadOperations({ filter, anchor, limit }: OperationsOptions): Promise<OperationsData> {
  const range = rangeOfPeriod(filter.period, anchor);
  const query = filterToQuery(filter);
  const [found, everything, forChart] = await Promise.all([
    findTransactions({ ...query, ...range }),
    findTransactions(range),
    query.categoryIds ? findTransactions({ ...query, categoryIds: undefined, ...range }) : null,
  ]);

  const byCategory = [...totalsByCategoryOf(forChart ?? found, 'expense')].map(([key, amountMinor]) => ({
    key,
    amountMinor,
  }));

  return {
    rows: found.slice(0, limit),
    found: found.length,
    totals: totalsOf(found),
    inPeriod: everything.length,
    expenses: topSlices(byCategory, { restKey: REST_KEY }),
  };
}
