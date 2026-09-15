/**
 * Balance sheet — formulas 9, 10 and 11 of docs/PLAN.md, section 5.
 *
 * An account balance is never stored: it is the opening balance plus every
 * operation that touched the account.
 */

import type { CoreAccount, CoreTransaction } from './types';
import type { IsoDate, IsoMonth } from './time';
import { addMonths, monthOfDate } from './time';
import { affectsCashFlow } from './budget';

export const RESERVE_MIN_MONTHS = 3;
export const RESERVE_MAX_MONTHS = 6;
export const RESERVE_INCOME_SHARE = 0.1;
const AVERAGE_EXPENSE_MONTHS = 3;

export interface AccountBalanceOptions {
  /** Only operations up to and including this date are counted. */
  readonly asOf?: IsoDate;
}

/**
 * Money moving in is positive for an asset and negative for a liability: paying a
 * card off reduces the debt, buying with a card grows it.
 */
function cashDelta(account: CoreAccount, transaction: CoreTransaction): number {
  const { kind, amountMinor } = transaction;
  const isSource = transaction.accountId === account.id;

  if (kind === 'adjustment' || kind === 'revaluation') {
    if (!isSource) return 0;
    const direction = transaction.direction ?? 'increase';
    const signed = direction === 'increase' ? amountMinor : -amountMinor;
    return account.side === 'asset' ? signed : -signed;
  }

  if (kind === 'transfer') {
    if (isSource) return -amountMinor;
    return transaction.toAccountId === account.id ? amountMinor : 0;
  }

  if (!isSource) return 0;
  if (kind === 'income' || kind === 'refund') return amountMinor;
  return -amountMinor;
}

export function accountBalanceMinor(
  account: CoreAccount,
  transactions: readonly CoreTransaction[],
  options: AccountBalanceOptions = {},
): number {
  let balance = account.openingBalanceMinor;

  for (const transaction of transactions) {
    if (options.asOf && transaction.date > options.asOf) continue;
    const delta = cashDelta(account, transaction);
    if (delta === 0) continue;
    balance += account.side === 'asset' ? delta : -delta;
  }

  return balance;
}

function sumAccounts(
  accounts: readonly CoreAccount[],
  transactions: readonly CoreTransaction[],
  predicate: (account: CoreAccount) => boolean,
): number {
  return accounts
    .filter((account) => !account.archived && predicate(account))
    .reduce((total, account) => total + accountBalanceMinor(account, transactions), 0);
}

export function totalAssetsMinor(
  accounts: readonly CoreAccount[],
  transactions: readonly CoreTransaction[],
): number {
  return sumAccounts(accounts, transactions, (account) => account.side === 'asset');
}

export function totalLiabilitiesMinor(
  accounts: readonly CoreAccount[],
  transactions: readonly CoreTransaction[],
): number {
  return sumAccounts(accounts, transactions, (account) => account.side === 'liability');
}

export function liquidAssetsMinor(
  accounts: readonly CoreAccount[],
  transactions: readonly CoreTransaction[],
): number {
  return sumAccounts(accounts, transactions, (account) => account.side === 'asset' && account.isLiquid);
}

/** Formula 11. */
export function netWorthMinor(
  accounts: readonly CoreAccount[],
  transactions: readonly CoreTransaction[],
): number {
  return totalAssetsMinor(accounts, transactions) - totalLiabilitiesMinor(accounts, transactions);
}

export function monthlyDebtPaymentsMinor(accounts: readonly CoreAccount[]): number {
  return accounts
    .filter((account) => !account.archived && account.side === 'liability')
    .reduce((total, account) => total + (account.monthlyPaymentMinor ?? 0), 0);
}

export type DebtBurdenStatus = 'normal' | 'attention' | 'tense' | 'unknown';

export interface DebtBurden {
  readonly ratio: number | null;
  readonly status: DebtBurdenStatus;
}

/** Formula 10: up to 25 % is fine, 25-30 % asks for attention, above 30 % is tense. */
export function debtBurden(monthlyPaymentsMinor: number, monthlyIncomeMinor: number): DebtBurden {
  if (monthlyIncomeMinor <= 0) return { ratio: null, status: 'unknown' };
  const ratio = monthlyPaymentsMinor / monthlyIncomeMinor;
  if (ratio <= 0.25) return { ratio, status: 'normal' };
  if (ratio <= 0.3) return { ratio, status: 'attention' };
  return { ratio, status: 'tense' };
}

export type AverageExpensesSource = 'fact' | 'plan' | 'none';

export interface AverageExpenses {
  readonly source: AverageExpensesSource;
  readonly valueMinor: number;
}

export interface AverageMonthlyExpensesParams {
  readonly transactions: readonly CoreTransaction[];
  readonly currentMonth: IsoMonth;
  /** Planned expenses of the current month, used when there is no fact yet. */
  readonly planExpenseMinor?: number;
  readonly monthsBack?: number;
}

/**
 * Average expenses of formula 9: the fact of the last complete months, otherwise the
 * plan of the current month, otherwise an explicit "no data" instead of a zero.
 */
export function averageMonthlyExpenses({
  transactions,
  currentMonth,
  planExpenseMinor,
  monthsBack = AVERAGE_EXPENSE_MONTHS,
}: AverageMonthlyExpensesParams): AverageExpenses {
  const months = new Set(
    Array.from({ length: monthsBack }, (_, offset) => addMonths(currentMonth, -(offset + 1))),
  );

  let total = 0;
  let hasFact = false;

  for (const transaction of transactions) {
    if (!affectsCashFlow(transaction.kind) || transaction.kind === 'income') continue;
    if (!months.has(monthOfDate(transaction.date))) continue;
    hasFact = true;
    total += transaction.kind === 'refund' ? -transaction.amountMinor : transaction.amountMinor;
  }

  if (hasFact) return { source: 'fact', valueMinor: total / monthsBack };
  if (planExpenseMinor !== undefined && planExpenseMinor > 0) {
    return { source: 'plan', valueMinor: planExpenseMinor };
  }
  return { source: 'none', valueMinor: 0 };
}

export interface ReserveNorm {
  readonly minMinor: number;
  readonly maxMinor: number;
}

/** Lesson 2.5: three to six months of expenses. */
export function reserveNorm(averageExpensesMinor: number): ReserveNorm {
  return {
    minMinor: averageExpensesMinor * RESERVE_MIN_MONTHS,
    maxMinor: averageExpensesMinor * RESERVE_MAX_MONTHS,
  };
}

export type ReserveStatus = 'empty' | 'partial' | 'done' | 'unknown';

export interface ReserveState {
  readonly reserveMinor: number;
  readonly months: number | null;
  readonly targetMinor: number | null;
  readonly norm: ReserveNorm | null;
  readonly status: ReserveStatus;
}

export interface ReserveStateParams {
  readonly liquidMinor: number;
  readonly otherGoalsEnvelopesMinor: number;
  readonly averageExpenses: AverageExpenses;
  readonly targetMonths: number;
}

/** Formula 9: reserve = liquid accounts - envelopes of every goal except the reserve. */
export function reserveState({
  liquidMinor,
  otherGoalsEnvelopesMinor,
  averageExpenses,
  targetMonths,
}: ReserveStateParams): ReserveState {
  const reserveMinor = Math.max(liquidMinor - otherGoalsEnvelopesMinor, 0);

  if (averageExpenses.source === 'none' || averageExpenses.valueMinor <= 0) {
    return { reserveMinor, months: null, targetMinor: null, norm: null, status: 'unknown' };
  }

  const months = reserveMinor / averageExpenses.valueMinor;
  const targetMinor = averageExpenses.valueMinor * targetMonths;
  const status: ReserveStatus = reserveMinor <= 0 ? 'empty' : months >= targetMonths ? 'done' : 'partial';

  return { reserveMinor, months, targetMinor, norm: reserveNorm(averageExpenses.valueMinor), status };
}

/** Lesson 2.5: 10 % of income until the reserve reaches its norm. */
export function recommendedReserveContributionMinor(
  monthlyIncomeMinor: number,
  share: number = RESERVE_INCOME_SHARE,
): number {
  return Math.max(monthlyIncomeMinor, 0) * share;
}

/** Invariant: the envelopes of an account never exceed its balance. */
export function envelopesFitAccount(accountBalance: number, envelopesSumMinor: number): boolean {
  return envelopesSumMinor <= accountBalance;
}
