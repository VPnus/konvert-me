/**
 * Accounts. The balance of an account is never stored: it is computed from the
 * opening balance and the operations, as required by section 4 of the plan.
 */

import { accountBalanceMinor, envelopesFitAccount } from '@/core/balance';
import type { CoreAccount, CoreTransaction } from '@/core/types';
import { todayIso } from '@/core/time';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { LIQUID_BY_DEFAULT, accountSchema, type Account, type AccountType } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export interface AccountInput {
  name: string;
  side: Account['side'];
  type: AccountType;
  openingBalanceMinor: number;
  openingDate?: string;
  isLiquid?: boolean;
  bankName?: string;
  rate?: number;
  maturityDate?: string;
  monthlyPaymentMinor?: number;
  paymentDay?: number;
  endDate?: string;
  creditLimitMinor?: number;
  gracePeriodEnd?: string;
  note?: string;
}

function newId(): string {
  return crypto.randomUUID();
}

export function isLiquidByDefault(type: AccountType): boolean {
  return LIQUID_BY_DEFAULT.includes(type);
}

export async function listAccounts(options: { includeArchived?: boolean } = {}): Promise<Account[]> {
  const all = await db.accounts.toArray();
  const visible = options.includeArchived ? all : all.filter((account) => !account.archived);
  return visible.sort((a, b) => a.side.localeCompare(b.side) || a.name.localeCompare(b.name, 'ru'));
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id);
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const now = Date.now();
  const account = parseOrThrow(
    accountSchema,
    {
      ...input,
      id: newId(),
      currency: 'RUB',
      openingDate: input.openingDate ?? todayIso(),
      isLiquid: input.isLiquid ?? isLiquidByDefault(input.type),
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    'Счёт',
  );

  await db.accounts.add(account);
  publishAppEvent({ type: 'data-changed' });
  return account;
}

export async function updateAccount(id: string, patch: Partial<AccountInput>): Promise<Account> {
  const current = await db.accounts.get(id);
  if (!current) throw new RepositoryError('Счёт не найден');

  const next = parseOrThrow(
    accountSchema,
    { ...current, ...patch, id: current.id, currency: 'RUB', updatedAt: Date.now() },
    'Счёт',
  );

  await db.accounts.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}

export async function setAccountArchived(id: string, archived: boolean): Promise<Account> {
  const current = await db.accounts.get(id);
  if (!current) throw new RepositoryError('Счёт не найден');
  const next = { ...current, archived, updatedAt: Date.now() };
  await db.accounts.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}

/** A счёт can only be deleted while nothing points at it; otherwise it is archived. */
export async function deleteAccount(id: string): Promise<void> {
  const [asSource, asTarget, envelopes] = await Promise.all([
    db.transactions.where('accountId').equals(id).count(),
    db.transactions.where('toAccountId').equals(id).count(),
    db.envelopes.where('accountId').equals(id).count(),
  ]);

  if (asSource + asTarget > 0) {
    throw new RepositoryError('У счёта есть операции. Его можно убрать в архив, но не удалить.');
  }
  if (envelopes > 0) {
    throw new RepositoryError('На счёте есть конверты целей. Сначала освободите их.');
  }

  await db.accounts.delete(id);
  publishAppEvent({ type: 'data-changed' });
}

function toCoreAccount(account: Account): CoreAccount {
  return {
    id: account.id,
    side: account.side,
    isLiquid: account.isLiquid,
    openingBalanceMinor: account.openingBalanceMinor,
    openingDate: account.openingDate,
    archived: account.archived,
    monthlyPaymentMinor: account.monthlyPaymentMinor,
  };
}

export function toCoreTransaction(row: {
  date: string;
  amountMinor: number;
  kind: CoreTransaction['kind'];
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  direction?: CoreTransaction['direction'];
}): CoreTransaction {
  return row;
}

export async function getAccountBalanceMinor(id: string): Promise<number> {
  const account = await db.accounts.get(id);
  if (!account) throw new RepositoryError('Счёт не найден');

  const transactions = await db.transactions
    .where('accountId')
    .equals(id)
    .or('toAccountId')
    .equals(id)
    .toArray();

  return accountBalanceMinor(toCoreAccount(account), transactions);
}

export async function getAccountBalancesMinor(): Promise<Map<string, number>> {
  const [accounts, transactions] = await Promise.all([db.accounts.toArray(), db.transactions.toArray()]);
  return new Map(
    accounts.map((account) => [account.id, accountBalanceMinor(toCoreAccount(account), transactions)]),
  );
}

/** Invariant of section 4: the envelopes of an account never exceed its balance. */
export async function assertEnvelopesFit(accountId: string): Promise<void> {
  const [balance, envelopes] = await Promise.all([
    getAccountBalanceMinor(accountId),
    db.envelopes.where('accountId').equals(accountId).toArray(),
  ]);

  const reserved = envelopes.reduce((total, envelope) => total + envelope.amountMinor, 0);
  // Nothing is reserved on this account, so there is nothing to protect: an ordinary
  // overdraft is the user's business and must not be refused as an envelope problem.
  if (reserved === 0) return;

  if (!envelopesFitAccount(balance, reserved)) {
    throw new RepositoryError(
      'Сумма конвертов на счёте больше его остатка. Уменьшите конверты или пополните счёт.',
      'envelopes',
    );
  }
}
