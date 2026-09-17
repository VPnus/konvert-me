/**
 * What a savings account earns in a month by its rate, on the balance of every day, a year of 365
 * or 366 days. The bank's own figure may differ by kopecks or by its rules; this is the estimate the
 * person confirms before it is written down as income.
 */

import { accountBalanceMinor } from './balance';
import { daysInMonth, withDayOfMonth, type IsoMonth } from './time';
import type { CoreAccount, CoreTransaction } from './types';

export function monthInterestMinor(
  account: CoreAccount,
  allTransactions: readonly CoreTransaction[],
  month: IsoMonth,
  rate: number,
): number {
  if (rate <= 0) return 0;
  const transactions = allTransactions.filter(
    (tx) => tx.accountId === account.id || tx.toAccountId === account.id,
  );
  const year = Number(month.slice(0, 4));
  const yearDays = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;

  let total = 0;
  for (let day = 1; day <= daysInMonth(month); day += 1) {
    const date = withDayOfMonth(month, day);
    // before the account was opened in the app there is nothing to earn on
    if (date < account.openingDate) continue;
    const balance = accountBalanceMinor(account, transactions, { asOf: date });
    if (balance > 0) total += (balance * rate) / yearDays;
  }
  return Math.round(total);
}
