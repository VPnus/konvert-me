/**
 * Budget aggregates — formula 7 of docs/PLAN.md, section 5.
 *
 * Transfers, adjustments and revaluations never touch income, expenses or the free
 * balance: a contribution to a goal is a transfer plus an envelope, not an expense.
 */

import type { CoreBudgetPlanLine, CoreCategory, CoreTransaction, TransactionKind } from './types';
import type { IsoMonth } from './time';
import { addMonths, monthOfDate, monthsOfYear } from './time';

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
  /**
   * What is left of the plan: plan - fact, whatever the category is. For an expense
   * that is how much may still be spent, for an income how much is still expected;
   * below zero the plan has been passed. One rule, so a screen can print it as it is.
   */
  readonly remainingMinor: number;
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
      remainingMinor: planMinor - factMinor,
    });
  }

  return rows;
}

export const EMPTY_MONTH_TOTALS = EMPTY_TOTALS;

export type BudgetBasisSource = 'fact' | 'plan' | 'month';

export interface BudgetBasis extends MonthTotals {
  /** The average of complete months, the plan of the current month, or the month in progress. */
  readonly source: BudgetBasisSource;
  /** The months behind the numbers, oldest first. */
  readonly months: readonly IsoMonth[];
}

export interface BudgetBasisParams {
  readonly transactions: readonly CoreTransaction[];
  readonly currentMonth: IsoMonth;
  /** The plan of the current month. */
  readonly plan: MonthTotals;
  readonly monthsBack?: number;
}

export const BUDGET_BASIS_MONTHS = 3;

/**
 * A usual month, for the verdicts that must not depend on the day they are read: the debt
 * burden of formula 10, the type of the budget and the free money of formula 8. On the 16th
 * the salary has come and the advance has not, and the month alone looks like a deficit.
 *
 * The fact of the last complete months, counted from the first one with operations; before
 * there is one, the plan of the current month; without a plan, the month as it stands.
 */
export function budgetBasis({
  transactions,
  currentMonth,
  plan,
  monthsBack = BUDGET_BASIS_MONTHS,
}: BudgetBasisParams): BudgetBasis {
  const window = Array.from({ length: monthsBack }, (_, offset) =>
    addMonths(currentMonth, offset - monthsBack),
  );

  let first: IsoMonth | null = null;
  for (const transaction of transactions) {
    if (!affectsCashFlow(transaction.kind)) continue;
    const month = monthOfDate(transaction.date);
    if (month < window[0] || month >= currentMonth) continue;
    if (first === null || month < first) first = month;
  }

  if (first !== null) {
    const start = first;
    const months = window.filter((month) => month >= start);
    let incomeMinor = 0;
    let expenseMinor = 0;
    for (const month of months) {
      const totals = monthTotals(transactions, month);
      incomeMinor += totals.incomeMinor;
      expenseMinor += totals.expenseMinor;
    }
    const count = months.length;
    return {
      source: 'fact',
      months,
      incomeMinor: incomeMinor / count,
      expenseMinor: expenseMinor / count,
      freeCashMinor: (incomeMinor - expenseMinor) / count,
    };
  }

  if (plan.incomeMinor > 0 || plan.expenseMinor > 0) {
    return { source: 'plan', months: [currentMonth], ...plan };
  }
  return { source: 'month', months: [currentMonth], ...monthTotals(transactions, currentMonth) };
}

/** The expense of one category, refunds netted out, averaged over the given months. */
export function categoryExpenseAverageMinor(
  transactions: readonly CoreTransaction[],
  months: readonly IsoMonth[],
  categoryId: string,
): number {
  if (months.length === 0) return 0;
  const total = months.reduce(
    (sum, month) => sum + (expensesByCategory(transactions, month).get(categoryId) ?? 0),
    0,
  );
  return total / months.length;
}
