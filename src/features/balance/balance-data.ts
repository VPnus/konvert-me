/**
 * Everything the balance screen shows, in one read: the accounts with their balances,
 * the capital month by month, the money each bank holds against the insurance limit,
 * and the policies. Every number comes from src/core.
 */

import {
  depositsByBank,
  netWorthSeries,
  type BankDeposits,
  type InsuredAccount,
  type NetWorthPoint,
} from '@/core/balance';
import { latestRules, rulesForYear, type Norm } from '@/core/rules';
import { addMonths, currentMonth, monthOfDate, compareMonths, type IsoMonth } from '@/core/time';
import { db } from '@/db/db';
import type { Account, AccountType, InsurancePolicy } from '@/db/models';
import { getAccountBalancesMinor } from '@/db/repositories/accounts';
import { listPolicies } from '@/db/repositories/policies';

/** What the state insures: deposits and current accounts, not shares or property. */
const INSURABLE_TYPES: readonly AccountType[] = ['cash', 'debit', 'savings', 'deposit'];

export interface BalanceData {
  readonly month: IsoMonth;
  readonly accounts: Account[];
  readonly balances: Map<string, number>;
  readonly assetsMinor: number;
  readonly liabilitiesMinor: number;
  readonly netWorthMinor: number;
  readonly series: NetWorthPoint[];
  readonly banks: BankDeposits[];
  readonly insuranceLimit: Norm<number>;
  readonly policies: InsurancePolicy[];
}

export interface BalanceOptions {
  readonly includeArchived?: boolean;
  /** How many months of history to draw; everything that exists when omitted. */
  readonly months?: number;
}

export async function loadBalance(
  options: BalanceOptions = {},
  now: Date = new Date(),
): Promise<BalanceData> {
  const month = currentMonth(now);

  const [accounts, transactions, balances, policies] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    getAccountBalancesMinor(),
    listPolicies({ includeArchived: options.includeArchived }),
  ]);

  const live = accounts.filter((account) => !account.archived);

  // History starts where the first account does, or where the window asks it to.
  const earliest = live.reduce<IsoMonth>(
    (first, account) => {
      const opened = monthOfDate(account.openingDate);
      return compareMonths(opened, first) < 0 ? opened : first;
    },
    live.length > 0 ? monthOfDate(live[0].openingDate) : month,
  );
  const windowStart = options.months ? addMonths(month, -(options.months - 1)) : earliest;
  const from = compareMonths(windowStart, earliest) > 0 ? windowStart : earliest;

  const insurable: InsuredAccount[] = live.map((account) => ({
    ...account,
    insurable: account.side === 'asset' && INSURABLE_TYPES.includes(account.type),
  }));

  // Deposits are checked as they stand today. A clock set before the first year with
  // rules still gets a limit to compare against, rather than no check at all.
  const limit = (rulesForYear(Number(month.slice(0, 4))) ?? latestRules()).depositInsuranceLimitMinor;
  const series = compareMonths(from, month) <= 0 ? netWorthSeries(live, transactions, from, month) : [];
  const last = series[series.length - 1];

  const visible = options.includeArchived ? accounts : live;

  return {
    month,
    accounts: visible.sort((a, b) => a.side.localeCompare(b.side) || a.name.localeCompare(b.name, 'ru')),
    balances,
    assetsMinor: last?.assetsMinor ?? 0,
    liabilitiesMinor: last?.liabilitiesMinor ?? 0,
    netWorthMinor: last?.netWorthMinor ?? 0,
    series,
    banks: depositsByBank(insurable, transactions, limit.value),
    insuranceLimit: limit,
    policies,
  };
}
