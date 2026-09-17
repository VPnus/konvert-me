import { describe, expect, it } from 'vitest';

import type { Account, Transaction } from '@/db/models';
import { interestToRecord } from '@/features/balance/balance-data';

const RUB = 100;

const account = (patch: Partial<Account>): Account => ({
  id: 'a',
  name: 'Счёт',
  side: 'asset',
  type: 'savings',
  currency: 'RUB',
  openingBalanceMinor: 18_000 * RUB,
  openingDate: '2026-06-01',
  isLiquid: true,
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const income = (accountId: string, date: string, categoryId: string): Transaction => ({
  id: `${accountId}-${date}`,
  date,
  amountMinor: 100 * RUB,
  kind: 'income',
  accountId,
  categoryId,
  createdAt: 1,
});

describe('the interest of last month to write down', () => {
  const savings = account({ id: 'savings', name: 'Накопительный счёт', rate: 0.13 });
  const card = account({ id: 'card', name: 'Зарплатная карта', type: 'debit', rate: 0.05 });

  it('offers the interest of an account with a rate, counted on every day of the month', () => {
    expect(interestToRecord([savings, card], [], '2026-09')).toEqual([
      { account: savings, month: '2026-08', amountMinor: 198_74 },
      { account: card, month: '2026-08', amountMinor: Math.round((18_000 * RUB * 0.05 * 31) / 365) },
    ]);
  });

  it('is quiet once it is written down, and for accounts without a rate, closed or opened later', () => {
    const salary = income('card', '2026-08-10', 'salary');
    expect(
      interestToRecord([savings, card], [income('savings', '2026-08-31', 'other-income'), salary], '2026-09'),
    ).toEqual([expect.objectContaining({ account: card })]);
    expect(interestToRecord([card], [income('card', '2026-08-31', 'interest')], '2026-09')).toEqual([]);
    expect(
      interestToRecord(
        [
          account({ id: 'norate' }),
          account({ id: 'gone', rate: 0.13, archived: true }),
          account({ id: 'new', rate: 0.13, openingDate: '2026-09-01' }),
          account({ id: 'deposit', type: 'deposit', rate: 0.2 }),
        ],
        [],
        '2026-09',
      ),
    ).toEqual([]);
  });
});
