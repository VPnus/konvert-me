/**
 * Balance sheet — formulas 9, 10 and 11 of docs/PLAN.md, section 5.
 *
 * An account balance is never stored: it is the opening balance plus every
 * operation that touched the account.
 */

import type { CoreAccount, CoreEnvelope, CoreTransaction } from './types';
import type { IsoDate, IsoMonth } from './time';
import { addMonths, daysInMonth, monthOfDate, monthsBetween, monthsRange, withDayOfMonth } from './time';
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

/**
 * The opening balance is stated on the opening date and already holds everything that
 * happened before it, so an older operation typed in later leaves the balance alone.
 */
export function accountBalanceMinor(
  account: CoreAccount,
  transactions: readonly CoreTransaction[],
  options: AccountBalanceOptions = {},
): number {
  let balance = account.openingBalanceMinor;

  for (const transaction of transactions) {
    if (options.asOf && transaction.date > options.asOf) continue;
    if (transaction.date < account.openingDate) continue;
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

/**
 * The part of the scheduled debt payments that repays the debts themselves: the payments
 * less the interest already counted among the expenses. It is not an expense, and it is
 * not free money either — formula 8 hands the goals only what is left after it.
 */
export function principalDueMinor(accounts: readonly CoreAccount[], interestInExpensesMinor: number): number {
  return Math.max(monthlyDebtPaymentsMinor(accounts) - Math.max(interestInExpensesMinor, 0), 0);
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
  /** How many complete months the fact is averaged over; zero for the plan and for no data. */
  readonly months: number;
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
 *
 * The fact is divided by the months since the first one with spending, not always by
 * three: before the records began there was spending too, it just was not written down.
 */
export function averageMonthlyExpenses({
  transactions,
  currentMonth,
  planExpenseMinor,
  monthsBack = AVERAGE_EXPENSE_MONTHS,
}: AverageMonthlyExpensesParams): AverageExpenses {
  const firstOfWindow = addMonths(currentMonth, -monthsBack);

  let total = 0;
  let first: IsoMonth | null = null;

  for (const transaction of transactions) {
    if (!affectsCashFlow(transaction.kind) || transaction.kind === 'income') continue;
    const month = monthOfDate(transaction.date);
    if (month < firstOfWindow || month >= currentMonth) continue;
    if (first === null || month < first) first = month;
    total += transaction.kind === 'refund' ? -transaction.amountMinor : transaction.amountMinor;
  }

  if (first !== null) {
    const months = monthsBetween(first, currentMonth);
    return { source: 'fact', valueMinor: total / months, months };
  }
  if (planExpenseMinor !== undefined && planExpenseMinor > 0) {
    return { source: 'plan', valueMinor: planExpenseMinor, months: 0 };
  }
  return { source: 'none', valueMinor: 0, months: 0 };
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

/**
 * Formula 9: the envelopes of the other goals that lie on liquid accounts. What a goal keeps
 * on a brokerage account or a deposit was never part of the liquid money, so it cannot be
 * taken out of the reserve either.
 */
export function liquidEnvelopesMinor(
  envelopes: readonly CoreEnvelope[],
  accounts: readonly CoreAccount[],
  reserveGoalId: string,
): number {
  const liquid = new Set(
    accounts
      .filter((account) => !account.archived && account.side === 'asset' && account.isLiquid)
      .map((account) => account.id),
  );
  return envelopes
    .filter((envelope) => envelope.goalId !== reserveGoalId && liquid.has(envelope.accountId))
    .reduce((total, envelope) => total + envelope.amountMinor, 0);
}

/** Formula 9: reserve = liquid accounts - envelopes of the other goals on those accounts. */
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

/**
 * What the reserve asks of a month in the distribution of formula 8: 10 % of income while
 * it is short of its target, never more than what is missing, nothing once it is there.
 */
export function reserveContributionMinor(
  reserve: ReserveState,
  monthlyIncomeMinor: number,
  share: number = RESERVE_INCOME_SHARE,
): number {
  if (reserve.targetMinor === null || reserve.status === 'done' || reserve.status === 'unknown') return 0;
  const missing = Math.max(reserve.targetMinor - reserve.reserveMinor, 0);
  return Math.min(recommendedReserveContributionMinor(monthlyIncomeMinor, share), missing);
}

/** Invariant: the envelopes of an account never exceed its balance. */
export function envelopesFitAccount(accountBalance: number, envelopesSumMinor: number): boolean {
  return envelopesSumMinor <= accountBalance;
}

export interface NetWorthPoint {
  readonly month: IsoMonth;
  readonly assetsMinor: number;
  readonly liabilitiesMinor: number;
  readonly netWorthMinor: number;
}

/**
 * Capital at the end of every month of a range. Nothing is stored: a month is simply
 * the balances counted with the operations up to its last day, so the line can never
 * drift away from the operations it is drawn from.
 */
export function netWorthSeries(
  accounts: readonly CoreAccount[],
  transactions: readonly CoreTransaction[],
  from: IsoMonth,
  to: IsoMonth,
): NetWorthPoint[] {
  return monthsRange(from, to).map((month) => {
    const asOf = withDayOfMonth(month, daysInMonth(month));
    let assetsMinor = 0;
    let liabilitiesMinor = 0;

    for (const account of accounts) {
      if (account.archived) continue;
      // An account only exists from the day its opening balance is stated.
      if (account.openingDate > asOf) continue;

      const balance = accountBalanceMinor(account, transactions, { asOf });
      if (account.side === 'asset') assetsMinor += balance;
      else liabilitiesMinor += balance;
    }

    return { month, assetsMinor, liabilitiesMinor, netWorthMinor: assetsMinor - liabilitiesMinor };
  });
}

export interface BankDeposits {
  readonly bankName: string;
  readonly amountMinor: number;
  readonly accountIds: string[];
  /** Above the limit the state guarantees, so part of the money is not insured. */
  readonly overLimit: boolean;
  readonly excessMinor: number;
}

export interface InsuredAccount extends CoreAccount {
  /** Deposits of the same bank are insured together, so they are counted together. */
  readonly bankName?: string;
  readonly insurable?: boolean;
}

/**
 * Money grouped by bank against the insurance limit. Only accounts marked insurable
 * take part: shares and property are not deposits, whatever bank sold them.
 */
export function depositsByBank(
  accounts: readonly InsuredAccount[],
  transactions: readonly CoreTransaction[],
  limitMinor: number,
): BankDeposits[] {
  const byBank = new Map<string, { amountMinor: number; accountIds: string[] }>();

  for (const account of accounts) {
    if (account.archived || !account.insurable) continue;
    const bankName = account.bankName?.trim();
    if (!bankName) continue;

    const balance = accountBalanceMinor(account, transactions);
    if (balance <= 0) continue;

    const group = byBank.get(bankName) ?? { amountMinor: 0, accountIds: [] };
    group.amountMinor += balance;
    group.accountIds.push(account.id);
    byBank.set(bankName, group);
  }

  return [...byBank.entries()]
    .map(([bankName, group]) => ({
      bankName,
      amountMinor: group.amountMinor,
      accountIds: group.accountIds,
      overLimit: group.amountMinor > limitMinor,
      excessMinor: Math.max(group.amountMinor - limitMinor, 0),
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.bankName.localeCompare(b.bankName, 'ru'));
}
