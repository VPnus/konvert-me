import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import { createAccount, getAccountBalanceMinor } from '@/db/repositories/accounts';
import {
  DEFAULT_CATEGORIES,
  seedDefaultCategories,
  listCategoriesOfKind,
} from '@/db/repositories/categories';
import { createGoal, setEnvelope } from '@/db/repositories/goals';
import {
  createTransaction,
  deleteTransaction,
  listRecentTransactions,
  listTransactionsOfMonth,
} from '@/db/repositories/transactions';

const RUB = 100;

beforeEach(async () => {
  await clearAllData();
});

describe('categories', () => {
  it('seeds the starter set once', async () => {
    expect(await seedDefaultCategories()).toBe(DEFAULT_CATEGORIES.length);
    expect(await seedDefaultCategories()).toBe(0);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);

    const income = await listCategoriesOfKind('income');
    expect(income.map((category) => category.id)).toContain('salary');
    expect(income.every((category) => category.kind === 'income')).toBe(true);
  });
});

describe('transactions', () => {
  it('records an expense and moves the balance', async () => {
    await seedDefaultCategories();
    const account = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 10_000 * RUB,
      openingDate: '2026-09-01',
    });

    await createTransaction({
      date: '2026-09-10',
      amountMinor: 1_500 * RUB,
      kind: 'expense',
      accountId: account.id,
      categoryId: 'groceries',
    });

    expect(await getAccountBalanceMinor(account.id)).toBe(8_500 * RUB);
    expect(await listTransactionsOfMonth('2026-09')).toHaveLength(1);
    expect(await listTransactionsOfMonth('2026-10')).toHaveLength(0);
    expect(await listRecentTransactions()).toHaveLength(1);
  });

  it('refuses an operation on an account that does not exist', async () => {
    await seedDefaultCategories();
    await expect(
      createTransaction({
        date: '2026-09-10',
        amountMinor: 100,
        kind: 'expense',
        accountId: 'нет-такого',
        categoryId: 'groceries',
      }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });

  it('refuses an expense without a category and a transfer to itself', async () => {
    const account = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 1_000 * RUB,
    });

    await expect(
      createTransaction({ date: '2026-09-10', amountMinor: 100, kind: 'expense', accountId: account.id }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      createTransaction({
        date: '2026-09-10',
        amountMinor: 100,
        kind: 'transfer',
        accountId: account.id,
        toAccountId: account.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('does not let an operation break the envelopes of an account', async () => {
    await seedDefaultCategories();
    const account = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 100_000 * RUB,
      openingDate: '2026-09-01',
    });
    const goal = await createGoal({
      name: 'Машина',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-09',
      targetMonth: '2028-01',
    });
    await setEnvelope(goal.id, account.id, 90_000 * RUB);

    await expect(
      createTransaction({
        date: '2026-09-10',
        amountMinor: 20_000 * RUB,
        kind: 'expense',
        accountId: account.id,
        categoryId: 'groceries',
      }),
    ).rejects.toThrow(/конверт/i);

    // the operation is rolled back, the balance is untouched
    expect(await db.transactions.count()).toBe(0);
    expect(await getAccountBalanceMinor(account.id)).toBe(100_000 * RUB);
  });

  it('deletes an operation', async () => {
    await seedDefaultCategories();
    const account = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 10_000 * RUB,
    });
    const transaction = await createTransaction({
      date: '2026-09-10',
      amountMinor: 500 * RUB,
      kind: 'expense',
      accountId: account.id,
      categoryId: 'cafe',
    });

    await deleteTransaction(transaction.id);
    expect(await db.transactions.count()).toBe(0);
    expect(await getAccountBalanceMinor(account.id)).toBe(10_000 * RUB);
  });
});
