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
  listTransactions,
  listTransactionsOfMonth,
  updateTransaction,
  importTransactions,
  listImportBatches,
  deleteImportBatch,
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

describe('transactions: editing', () => {
  async function setUp() {
    await seedDefaultCategories();
    const card = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 50_000 * RUB,
      openingDate: '2026-09-01',
    });
    const savings = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 0,
      openingDate: '2026-09-01',
    });
    return { card, savings };
  }

  it('changes the amount, the category and the account of an operation', async () => {
    const { card, savings } = await setUp();
    const transaction = await createTransaction({
      date: '2026-09-10',
      amountMinor: 1_000 * RUB,
      kind: 'expense',
      accountId: card.id,
      categoryId: 'groceries',
    });

    const updated = await updateTransaction(transaction.id, {
      amountMinor: 1_500 * RUB,
      categoryId: 'cafe',
      accountId: savings.id,
      note: 'ужин',
    });

    expect(updated.amountMinor).toBe(1_500 * RUB);
    expect(updated.categoryId).toBe('cafe');
    expect(updated.createdAt).toBe(transaction.createdAt);
    expect(await getAccountBalanceMinor(card.id)).toBe(50_000 * RUB);
    expect(await getAccountBalanceMinor(savings.id)).toBe(-1_500 * RUB);
  });

  it('drops the category when an expense becomes a transfer', async () => {
    const { card, savings } = await setUp();
    const transaction = await createTransaction({
      date: '2026-09-10',
      amountMinor: 2_000 * RUB,
      kind: 'expense',
      accountId: card.id,
      categoryId: 'groceries',
    });

    const updated = await updateTransaction(transaction.id, {
      kind: 'transfer',
      toAccountId: savings.id,
    });

    expect(updated.categoryId).toBeUndefined();
    expect(await getAccountBalanceMinor(savings.id)).toBe(2_000 * RUB);
  });

  it('refuses an edit that would break the envelopes and keeps the old row', async () => {
    const { card } = await setUp();
    const transaction = await createTransaction({
      date: '2026-09-10',
      amountMinor: 1_000 * RUB,
      kind: 'expense',
      accountId: card.id,
      categoryId: 'groceries',
    });
    const goal = await createGoal({
      name: 'Отпуск',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-09',
      targetMonth: '2027-06',
    });
    await setEnvelope(goal.id, card.id, 49_000 * RUB);

    await expect(updateTransaction(transaction.id, { amountMinor: 30_000 * RUB })).rejects.toThrow(
      /конверт/i,
    );

    expect((await db.transactions.get(transaction.id))?.amountMinor).toBe(1_000 * RUB);
    expect(await getAccountBalanceMinor(card.id)).toBe(49_000 * RUB);
  });

  it('refuses to delete an income the envelopes still lean on', async () => {
    const { card } = await setUp();
    const income = await createTransaction({
      date: '2026-09-05',
      amountMinor: 20_000 * RUB,
      kind: 'income',
      accountId: card.id,
      categoryId: 'salary',
    });
    const goal = await createGoal({
      name: 'Машина',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-09',
      targetMonth: '2028-01',
    });
    await setEnvelope(goal.id, card.id, 65_000 * RUB);

    await expect(deleteTransaction(income.id)).rejects.toThrow(/конверт/i);
    expect(await db.transactions.count()).toBe(1);
    expect(await getAccountBalanceMinor(card.id)).toBe(70_000 * RUB);
  });

  it('reports a missing operation instead of writing a new one', async () => {
    await expect(updateTransaction('нет-такой', { amountMinor: 100 })).rejects.toBeInstanceOf(
      RepositoryError,
    );
    // deleting what is not there is quietly fine
    await expect(deleteTransaction('нет-такой')).resolves.toBeUndefined();
  });
});

describe('transactions: search and filters', () => {
  async function fill() {
    await seedDefaultCategories();
    const card = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 100_000 * RUB,
      openingDate: '2026-09-01',
    });
    const savings = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 0,
      openingDate: '2026-09-01',
    });

    await createTransaction({
      date: '2026-09-05',
      amountMinor: 120_000 * RUB,
      kind: 'income',
      accountId: card.id,
      categoryId: 'salary',
      note: 'Зарплата за август',
    });
    await createTransaction({
      date: '2026-09-07',
      amountMinor: 1_500 * RUB,
      kind: 'expense',
      accountId: card.id,
      categoryId: 'groceries',
      note: 'Продукты на неделю',
    });
    await createTransaction({
      date: '2026-09-20',
      amountMinor: 30_000 * RUB,
      kind: 'transfer',
      accountId: card.id,
      toAccountId: savings.id,
    });
    await createTransaction({
      date: '2026-10-02',
      amountMinor: 900 * RUB,
      kind: 'expense',
      accountId: card.id,
      categoryId: 'cafe',
    });

    return { card, savings };
  }

  it('filters by month, kind, category and account', async () => {
    const { savings } = await fill();

    expect(await listTransactions({ month: '2026-09' })).toHaveLength(3);
    expect(await listTransactions({ month: '2026-09', kinds: ['expense'] })).toHaveLength(1);
    expect(await listTransactions({ categoryId: 'cafe' })).toHaveLength(1);
    expect(await listTransactions({ year: 2026 })).toHaveLength(4);
    expect(await listTransactions({ year: 2025 })).toHaveLength(0);

    // the receiving side of a transfer counts as that account's operation too
    expect(await listTransactions({ accountId: savings.id })).toHaveLength(1);
  });

  it('finds an operation by a word of the note or by the amount', async () => {
    await fill();

    expect(await listTransactions({ query: 'продукты' })).toHaveLength(1);
    expect(await listTransactions({ query: 'ЗАРПЛАТА' })).toHaveLength(1);
    expect(await listTransactions({ query: '1500' })).toHaveLength(1);
    expect(await listTransactions({ query: '   ' })).toHaveLength(4);
    expect(await listTransactions({ query: 'ничего такого' })).toHaveLength(0);
  });

  it('returns the newest first and honours the limit', async () => {
    await fill();
    const recent = await listTransactions({ limit: 2 });
    expect(recent).toHaveLength(2);
    expect(recent[0].date).toBe('2026-10-02');
    expect(recent[1].date).toBe('2026-09-20');
  });
});

describe('transactions: importing a statement', () => {
  async function setUp() {
    await seedDefaultCategories();
    return createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 100_000 * RUB,
      openingDate: '2026-09-01',
    });
  }

  const row = (hash: string, amountMinor: number, date = '2026-09-05') => ({
    date,
    amountMinor,
    kind: 'expense' as const,
    categoryId: 'groceries',
    importRowHash: hash,
  });

  it('writes a whole file at once under one batch', async () => {
    const account = await setUp();
    const result = await importTransactions([
      { ...row('a', 1_000 * RUB), accountId: account.id },
      { ...row('b', 2_000 * RUB), accountId: account.id },
    ]);

    expect(result.imported).toBe(2);
    expect(await db.transactions.count()).toBe(2);
    expect(await getAccountBalanceMinor(account.id)).toBe(97_000 * RUB);

    const [batch] = await listImportBatches();
    expect(batch).toMatchObject({ batchId: result.batchId, count: 2, from: '2026-09-05' });
  });

  it('adds nothing on a second import of the same file', async () => {
    const account = await setUp();
    const rows = [
      { ...row('a', 1_000 * RUB), accountId: account.id },
      { ...row('b', 2_000 * RUB), accountId: account.id },
    ];

    await importTransactions(rows);
    const again = await importTransactions(rows);

    expect(again.imported).toBe(0);
    expect(await db.transactions.count()).toBe(2);
  });

  it('keeps two identical purchases of one day, because their rows differ', async () => {
    const account = await setUp();
    // the parser gives the second copy of an identical line its own hash
    const result = await importTransactions([
      { ...row('line#0', 1_234_56), accountId: account.id },
      { ...row('line#1', 1_234_56), accountId: account.id },
    ]);

    expect(result.imported).toBe(2);
  });

  it('undoes a whole import in one go', async () => {
    const account = await setUp();
    const { batchId } = await importTransactions([
      { ...row('a', 1_000 * RUB), accountId: account.id },
      { ...row('b', 2_000 * RUB), accountId: account.id },
    ]);
    await createTransaction({
      date: '2026-09-07',
      amountMinor: 500 * RUB,
      kind: 'expense',
      accountId: account.id,
      categoryId: 'cafe',
    });

    expect(await deleteImportBatch(batchId)).toBe(2);
    // the operation typed by hand stays where it was
    expect(await db.transactions.count()).toBe(1);
    expect(await listImportBatches()).toHaveLength(0);
  });

  it('refuses a file addressed to an account that is not there', async () => {
    await setUp();
    await expect(importTransactions([{ ...row('a', 100), accountId: 'нет-такого' }])).rejects.toBeInstanceOf(
      RepositoryError,
    );
    expect(await db.transactions.count()).toBe(0);
  });
});
