/**
 * Budget aggregates — formula 7 of docs/PLAN.md, section 5.
 *
 * Transfers, adjustments and revaluations never touch income, expenses or the free
 * balance: a contribution to a goal is a transfer plus an envelope, not an expense.
 */

import type { CoreBudgetPlanLine, CoreCategory, CoreTransaction, TransactionKind } from './types';
import type { IsoMonth } from './time';
import { monthOfDate, monthsOfYear } from './time';

export const CASH_FLOW_KINDS: readonly TransactionKind[] = ['income', 'expense', 'refund'];

export function affectsCashFlow(kind: TransactionKind): boolean {
  return CASH_FLOW_KINDS.includes(kind);
}

export interface MonthTotals {
  readonly incomeMinor: number;
  readonly expenseMinor: number;
  readonly freeCashMinor: number;
}

const EMPTY_TOTALS: MonthTotals = { incomeMinor: 0, expenseMinor: 0, freeCashMinor: 0 };

/** Formula 7: income - (expenses - refunds). */
export function monthTotals(transactions: readonly CoreTransaction[], month: IsoMonth): MonthTotals {
  let incomeMinor = 0;
  let expenseMinor = 0;

  for (const transaction of transactions) {
    if (!affectsCashFlow(transaction.kind)) continue;
    if (monthOfDate(transaction.date) !== month) continue;

    if (transaction.kind === 'income') incomeMinor += transaction.amountMinor;
    else if (transaction.kind === 'expense') expenseMinor += transaction.amountMinor;
    else expenseMinor -= transaction.amountMinor;
  }

  return { incomeMinor, expenseMinor, freeCashMinor: incomeMinor - expenseMinor };
}

export function freeCashMinor(transactions: readonly CoreTransaction[], month: IsoMonth): number {
  return monthTotals(transactions, month).freeCashMinor;
}

export interface YearTotals extends MonthTotals {
  readonly byMonth: Record<IsoMonth, MonthTotals>;
}

export function yearTotals(transactions: readonly CoreTransaction[], year: number): YearTotals {
  const byMonth: Record<IsoMonth, MonthTotals> = {};
  let incomeMinor = 0;
  let expenseMinor = 0;

  for (const month of monthsOfYear(year)) {
    const totals = monthTotals(transactions, month);
    byMonth[month] = totals;
    incomeMinor += totals.incomeMinor;
    expenseMinor += totals.expenseMinor;
  }

  return { incomeMinor, expenseMinor, freeCashMinor: incomeMinor - expenseMinor, byMonth };
}

function totalsByCategory(
  transactions: readonly CoreTransaction[],
  month: IsoMonth,
  kind: 'income' | 'expense',
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (!affectsCashFlow(transaction.kind)) continue;
    if (monthOfDate(transaction.date) !== month) continue;
    if (!transaction.categoryId) continue;

    const isIncomeSide = transaction.kind === 'income';
    if ((kind === 'income') !== isIncomeSide) continue;

    const signed = transaction.kind === 'refund' ? -transaction.amountMinor : transaction.amountMinor;
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + signed);
  }

  return totals;
}

/** Expenses of a month per category, refunds already subtracted. */
export function expensesByCategory(
  transactions: readonly CoreTransaction[],
  month: IsoMonth,
): Map<string, number> {
  return totalsByCategory(transactions, month, 'expense');
}

export function incomeByCategory(
  transactions: readonly CoreTransaction[],
  month: IsoMonth,
): Map<string, number> {
  return totalsByCategory(transactions, month, 'income');
}

/** The plan of every month of a year, with the year totals — the mirror of yearTotals. */
export function yearPlanTotals(
  plans: readonly CoreBudgetPlanLine[],
  year: number,
  categories: readonly CoreCategory[],
): YearTotals {
  const byMonth: Record<IsoMonth, MonthTotals> = {};
  let incomeMinor = 0;
  let expenseMinor = 0;

  for (const month of monthsOfYear(year)) {
    const totals = planTotals(plans, month, categories);
    byMonth[month] = totals;
    incomeMinor += totals.incomeMinor;
    expenseMinor += totals.expenseMinor;
  }

  return { incomeMinor, expenseMinor, freeCashMinor: incomeMinor - expenseMinor, byMonth };
}

export interface GroupTotals {
  readonly mandatoryMinor: number;
  readonly variableMinor: number;
  /** Expenses of a category that has no group, and expenses with no category at all. */
  readonly ungroupedMinor: number;
}

/**
 * Expenses of a month split into mandatory and variable, as the template of lesson 2.9
 * does it. Refunds are already subtracted; transfers never appear here.
 */
export function expensesByGroup(
  transactions: readonly CoreTransaction[],
  month: IsoMonth,
  categories: readonly CoreCategory[],
): GroupTotals {
  const groupOf = new Map(categories.map((category) => [category.id, category.group]));
  let mandatoryMinor = 0;
  let variableMinor = 0;
  let ungroupedMinor = 0;

  for (const transaction of transactions) {
    if (!affectsCashFlow(transaction.kind) || transaction.kind === 'income') continue;
    if (monthOfDate(transaction.date) !== month) continue;

    const signed = transaction.kind === 'refund' ? -transaction.amountMinor : transaction.amountMinor;
    const group = transaction.categoryId ? groupOf.get(transaction.categoryId) : undefined;

    if (group === 'mandatory') mandatoryMinor += signed;
    else if (group === 'variable') variableMinor += signed;
    else ungroupedMinor += signed;
  }

  return { mandatoryMinor, variableMinor, ungroupedMinor };
}

export function planTotals(
  plans: readonly CoreBudgetPlanLine[],
  month: IsoMonth,
  categories: readonly CoreCategory[],
): MonthTotals {
  const kindOf = new Map(categories.map((category) => [category.id, category.kind]));
  let incomeMinor = 0;
  let expenseMinor = 0;

  for (const line of plans) {
    if (line.month !== month) continue;
    const kind = kindOf.get(line.categoryId);
    if (!kind) continue;
    if (kind === 'income') incomeMinor += line.amountMinor;
    else expenseMinor += line.amountMinor;
  }

  return { incomeMinor, expenseMinor, freeCashMinor: incomeMinor - expenseMinor };
}

export interface PlanFactRow {
  readonly categoryId: string;
  readonly kind: 'income' | 'expense';
  readonly planMinor: number;
  readonly factMinor: number;
  /** Positive means the month went better than planned: less spent or more earned. */
  readonly deviationMinor: number;
}

export interface PlanVsFactOptions {
  /** Keep a row for a category with neither a plan nor a fact, so a plan can be typed in. */
  readonly includeEmpty?: boolean;
}

export function planVsFact(
  plans: readonly CoreBudgetPlanLine[],
  transactions: readonly CoreTransaction[],
  month: IsoMonth,
  categories: readonly CoreCategory[],
  options: PlanVsFactOptions = {},
): PlanFactRow[] {
  const income = incomeByCategory(transactions, month);
  const expense = expensesByCategory(transactions, month);
  const planned = new Map<string, number>();

  for (const line of plans) {
    if (line.month !== month) continue;
    planned.set(line.categoryId, (planned.get(line.categoryId) ?? 0) + line.amountMinor);
  }

  const rows: PlanFactRow[] = [];
  for (const category of categories) {
    const planMinor = planned.get(category.id) ?? 0;
    const factMinor = (category.kind === 'income' ? income.get(category.id) : expense.get(category.id)) ?? 0;
    if (planMinor === 0 && factMinor === 0 && !options.includeEmpty) continue;
    rows.push({
      categoryId: category.id,
      kind: category.kind,
      planMinor,
      factMinor,
      deviationMinor: category.kind === 'income' ? factMinor - planMinor : planMinor - factMinor,
    });
  }

  return rows;
}

export const EMPTY_MONTH_TOTALS = EMPTY_TOTALS;
