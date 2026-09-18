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
   * Where the expenses went, over everything found and not only over the page: the biggest
   * categories by name and the tail as one. Counted from the same rows the list shows, so the
   * picture and the list can never tell two different stories.
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
  const [found, everything] = await Promise.all([
    findTransactions({ ...filterToQuery(filter), ...range }),
    findTransactions(range),
  ]);

  const byCategory = [...totalsByCategoryOf(found, 'expense')].map(([key, amountMinor]) => ({
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
