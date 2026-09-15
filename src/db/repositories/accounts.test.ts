import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import {
  assertEnvelopesFit,
  createAccount,
  deleteAccount,
  getAccountBalanceMinor,
  getAccountBalancesMinor,
  isLiquidByDefault,
  listAccounts,
  setAccountArchived,
  updateAccount,
} from '@/db/repositories/accounts';

const RUB = 100;

beforeEach(async () => {
  await Promise.all([db.accounts.clear(), db.transactions.clear(), db.envelopes.clear()]);
});

describe('accounts: creation', () => {
  it('creates a debit account that is liquid by default', async () => {
    const account = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 100_000 * RUB,
      openingDate: '2026-09-01',
    });

    expect(account.id).toMatch(/[0-9a-f-]{36}/);
    expect(account.isLiquid).toBe(true);
    expect(account.currency).toBe('RUB');
    expect(account.archived).toBe(false);
    expect(await db.accounts.count()).toBe(1);
  });

  it('knows which types are liquid by default', () => {
    expect(isLiquidByDefault('cash')).toBe(true);
    expect(isLiquidByDefault('debit')).toBe(true);
    expect(isLiquidByDefault('savings')).toBe(true);
    expect(isLiquidByDefault('realty')).toBe(false);
    expect(isLiquidByDefault('deposit')).toBe(false);
  });

  it('lets the user override liquidity', async () => {
    const account = await createAccount({
      name: 'Копилка',
      side: 'asset',
      type: 'deposit',
      openingBalanceMinor: 0,
      isLiquid: true,
    });
    expect(account.isLiquid).toBe(true);
  });

  it('refuses a name that is only spaces', async () => {
    await expect(
      createAccount({ name: '   ', side: 'asset', type: 'cash', openingBalanceMinor: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses kopecks that are not whole', async () => {
    await expect(
      createAccount({ name: 'Карта', side: 'asset', type: 'debit', openingBalanceMinor: 10.5 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a type that does not match the side of the account', async () => {
    await expect(
      createAccount({ name: 'Ипотека', side: 'asset', type: 'mortgage', openingBalanceMinor: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a negative debt', async () => {
    await expect(
      createAccount({ name: 'Кредитка', side: 'liability', type: 'credit_card', openingBalanceMinor: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses an impossible opening date', async () => {
    await expect(
      createAccount({
        name: 'Карта',
        side: 'asset',
        type: 'debit',
        openingBalanceMinor: 0,
        openingDate: '2026-02-30',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('accounts: listing, updating and archiving', () => {
  it('hides archived accounts unless they are asked for', async () => {
    const first = await createAccount({
      name: 'Наличные',
      side: 'asset',
      type: 'cash',
      openingBalanceMinor: 0,
    });
    await createAccount({ name: 'Вклад', side: 'asset', type: 'deposit', openingBalanceMinor: 0 });

    await setAccountArchived(first.id, true);

    expect((await listAccounts()).map((account) => account.name)).toEqual(['Вклад']);
    expect((await listAccounts({ includeArchived: true })).map((account) => account.name)).toEqual([
      'Вклад',
      'Наличные',
    ]);
  });

  it('updates a field and keeps the id', async () => {
    const account = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 0,
    });
    const updated = await updateAccount(account.id, { name: 'Зарплатная карта' });

    expect(updated.id).toBe(account.id);
    expect(updated.name).toBe('Зарплатная карта');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(account.updatedAt);
  });

  it('reports a missing account', async () => {
    await expect(updateAccount('нет-такого', { name: 'Что-то' })).rejects.toBeInstanceOf(RepositoryError);
    await expect(setAccountArchived('нет-такого', true)).rejects.toBeInstanceOf(RepositoryError);
    await expect(getAccountBalanceMinor('нет-такого')).rejects.toBeInstanceOf(RepositoryError);
  });
});

describe('accounts: balance is derived from the operations', () => {
  it('counts income, expenses and transfers', async () => {
    const debit = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 100_000 * RUB,
      openingDate: '2026-01-01',
    });
    const savings = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 0,
      openingDate: '2026-01-01',
    });
    const card = await createAccount({
      name: 'Кредитка',
      side: 'liability',
      type: 'credit_card',
      openingBalanceMinor: 20_000 * RUB,
      openingDate: '2026-01-01',
      monthlyPaymentMinor: 5_000 * RUB,
    });

    await db.transactions.bulkAdd([
      {
        id: 't1',
        date: '2026-09-05',
        amountMinor: 150_000 * RUB,
        kind: 'income',
        accountId: debit.id,
        categoryId: 'salary',
        createdAt: Date.now(),
      },
      {
        id: 't2',
        date: '2026-09-06',
        amountMinor: 20_000 * RUB,
        kind: 'expense',
        accountId: debit.id,
        categoryId: 'food',
        createdAt: Date.now(),
      },
      {
        id: 't3',
        date: '2026-09-07',
        amountMinor: 30_000 * RUB,
        kind: 'transfer',
        accountId: debit.id,
        toAccountId: savings.id,
        createdAt: Date.now(),
      },
      {
        id: 't4',
        date: '2026-09-08',
        amountMinor: 7_000 * RUB,
        kind: 'expense',
        accountId: card.id,
        categoryId: 'food',
        createdAt: Date.now(),
      },
    ]);

    expect(await getAccountBalanceMinor(debit.id)).toBe(200_000 * RUB);
    expect(await getAccountBalanceMinor(savings.id)).toBe(30_000 * RUB);
    expect(await getAccountBalanceMinor(card.id)).toBe(27_000 * RUB);

    const balances = await getAccountBalancesMinor();
    expect(balances.get(debit.id)).toBe(200_000 * RUB);
    expect(balances.size).toBe(3);
  });
});

describe('accounts: deletion is guarded', () => {
  it('deletes an untouched account', async () => {
    const account = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 0,
    });
    await deleteAccount(account.id);
    expect(await db.accounts.count()).toBe(0);
  });

  it('refuses to delete an account with operations', async () => {
    const account = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 0,
    });
    await db.transactions.add({
      id: 't1',
      date: '2026-09-05',
      amountMinor: 1_000,
      kind: 'income',
      accountId: account.id,
      categoryId: 'salary',
      createdAt: Date.now(),
    });

    await expect(deleteAccount(account.id)).rejects.toThrow(/операции/);
  });

  it('refuses to delete an account that holds an envelope', async () => {
    const account = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 0,
    });
    await db.envelopes.add({ id: 'e1', goalId: 'g1', accountId: account.id, amountMinor: 0 });

    await expect(deleteAccount(account.id)).rejects.toThrow(/конверт/);
  });
});

describe('accounts: the envelopes of an account never exceed its balance', () => {
  it('accepts envelopes within the balance', async () => {
    const account = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 100_000 * RUB,
    });
    await db.envelopes.add({ id: 'e1', goalId: 'g1', accountId: account.id, amountMinor: 60_000 * RUB });

    await expect(assertEnvelopesFit(account.id)).resolves.toBeUndefined();
  });

  it('rejects envelopes above the balance', async () => {
    const account = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 100_000 * RUB,
    });
    await db.envelopes.bulkAdd([
      { id: 'e1', goalId: 'g1', accountId: account.id, amountMinor: 60_000 * RUB },
      { id: 'e2', goalId: 'g2', accountId: account.id, amountMinor: 50_000 * RUB },
    ]);

    await expect(assertEnvelopesFit(account.id)).rejects.toThrow(/конверт/i);
  });
});
