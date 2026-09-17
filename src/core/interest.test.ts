import { describe, expect, it } from 'vitest';

import { monthInterestMinor } from './interest';
import type { CoreAccount, CoreTransaction } from './types';

const r = (rubles: number) => Math.round(rubles * 100);

const savings: CoreAccount = {
  id: 'savings',
  side: 'asset',
  isLiquid: true,
  openingBalanceMinor: r(18_000),
  openingDate: '2026-06-01',
};

describe('interest of a savings account', () => {
  it('earns on the balance of every day, as the bank of the worker counts it', () => {
    // the scenario of 17.09.2026: 18 000 at 13 % through June, a 365-day year
    expect(monthInterestMinor(savings, [], '2026-06', 0.13)).toBe(r(192.33));
    expect(monthInterestMinor(savings, [], '2026-08', 0.13)).toBe(r(198.74));
  });

  it('follows the money coming in during the month, and nothing before the account', () => {
    const kopilka: CoreAccount = {
      ...savings,
      id: 'kopilka',
      openingBalanceMinor: 0,
      openingDate: '2026-07-01',
    };
    const deposit: CoreTransaction = {
      date: '2026-07-26',
      amountMinor: r(3_000),
      kind: 'transfer',
      accountId: 'debit',
      toAccountId: 'kopilka',
    };
    // 3 000 for the six days from the 26th at 15,5 %
    expect(monthInterestMinor(kopilka, [deposit], '2026-07', 0.155)).toBe(r(7.64));
    expect(monthInterestMinor(kopilka, [deposit], '2026-06', 0.155)).toBe(0);
  });

  it('knows a leap year and a rate of nothing', () => {
    expect(monthInterestMinor({ ...savings, openingDate: '2028-01-01' }, [], '2028-02', 0.366)).toBe(
      Math.round((r(18_000) * 0.366 * 29) / 366),
    );
    expect(monthInterestMinor(savings, [], '2026-06', 0)).toBe(0);
  });
});
