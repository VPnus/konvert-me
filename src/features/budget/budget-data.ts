/**
 * Everything the budget screen shows, in one read. The screen never adds up money
 * itself: the numbers come from src/core, the rows come from the repositories.
 */

import {
  expensesByGroup,
  monthTotals,
  planTotals,
  planVsFact,
  yearPlanTotals,
  yearTotals,
  type GroupTotals,
  type MonthTotals,
  type PlanFactRow,
  type YearTotals,
} from '@/core/budget';
import type { IsoMonth } from '@/core/time';
import type { CoreCategory } from '@/core/types';
import { db } from '@/db/db';
import type { Account, BudgetPlan, Category, Transaction } from '@/db/models';
import { listAccounts } from '@/db/repositories/accounts';
import { listPlansOfMonth, listPlansOfYear } from '@/db/repositories/budget-plans';
import { listCategories } from '@/db/repositories/categories';
import { listTransactions, type TransactionFilter } from '@/db/repositories/transactions';

export function toCoreCategories(categories: readonly Category[]): CoreCategory[] {
  return categories.map((category) => ({
    id: category.id,
    kind: category.kind,
    group: category.group,
  }));
}

export interface BudgetMonthData {
  readonly month: IsoMonth;
  readonly categories: Category[];
  readonly accounts: Account[];
  readonly plans: BudgetPlan[];
  /** Operations of the month, already filtered and sorted for the list. */
  readonly transactions: Transaction[];
  /** How many operations the month has in total, whatever the filters show. */
  readonly totalCount: number;
  readonly rows: PlanFactRow[];
  readonly fact: MonthTotals;
  readonly plan: MonthTotals;
  readonly groups: GroupTotals;
}

export interface BudgetMonthOptions {
  /** Keep a row for every category, so a plan can be typed into an empty one. */
  readonly includeEmpty?: boolean;
  readonly filter?: Omit<TransactionFilter, 'month' | 'year'>;
}

export async function loadBudgetMonth(
  month: IsoMonth,
  options: BudgetMonthOptions = {},
): Promise<BudgetMonthData> {
  const [categories, accounts, plans, monthTransactions, filtered] = await Promise.all([
    listCategories(),
    listAccounts({ includeArchived: true }),
    listPlansOfMonth(month),
    listTransactions({ month }),
    options.filter ? listTransactions({ ...options.filter, month }) : null,
  ]);

  const coreCategories = toCoreCategories(categories);

  return {
    month,
    categories,
    accounts,
    plans,
    transactions: filtered ?? monthTransactions,
    totalCount: monthTransactions.length,
    rows: planVsFact(plans, monthTransactions, month, coreCategories, {
      includeEmpty: options.includeEmpty,
    }),
    fact: monthTotals(monthTransactions, month),
    plan: planTotals(plans, month, coreCategories),
    groups: expensesByGroup(monthTransactions, month, coreCategories),
  };
}

export interface BudgetYearData {
  readonly year: number;
  readonly fact: YearTotals;
  readonly plan: YearTotals;
  readonly hasAnything: boolean;
}

export async function loadBudgetYear(year: number): Promise<BudgetYearData> {
  const [categories, transactions, plans] = await Promise.all([
    listCategories(),
    db.transactions.toArray(),
    listPlansOfYear(year),
  ]);

  const coreCategories = toCoreCategories(categories);
  const fact = yearTotals(transactions, year);
  const plan = yearPlanTotals(plans, year, coreCategories);

  return {
    year,
    fact,
    plan,
    hasAnything:
      fact.incomeMinor !== 0 || fact.expenseMinor !== 0 || plan.incomeMinor !== 0 || plan.expenseMinor !== 0,
  };
}
