/**
 * Operations. A contribution to a goal is a transfer plus an envelope, never an
 * expense, so transfers stay out of income and expenses (formula 7).
 */

import { monthOfDate, type IsoMonth } from '@/core/time';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { transactionSchema, type Transaction } from '@/db/models';
import { assertEnvelopesFit } from '@/db/repositories/accounts';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export interface TransactionInput {
  date: string;
  amountMinor: number;
  kind: Transaction['kind'];
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  direction?: Transaction['direction'];
  note?: string;
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const transaction = parseOrThrow(
    transactionSchema,
    { ...input, id: crypto.randomUUID(), createdAt: Date.now() },
    'Операция',
  );

  const accounts = await db.accounts.bulkGet(
    [transaction.accountId, transaction.toAccountId].filter((id): id is string => Boolean(id)),
  );
  if (accounts.some((account) => account === undefined)) {
    throw new RepositoryError('Счёт операции не найден');
  }

  await db.transactions.add(transaction);

  // Money that left an account may no longer cover the envelopes standing on it.
  try {
    await assertEnvelopesFit(transaction.accountId);
  } catch (error) {
    await db.transactions.delete(transaction.id);
    throw error;
  }

  publishAppEvent({ type: 'data-changed' });
  return transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id);
  publishAppEvent({ type: 'data-changed' });
}

export async function listTransactionsOfMonth(month: IsoMonth): Promise<Transaction[]> {
  const all = await db.transactions.toArray();
  return all
    .filter((transaction) => monthOfDate(transaction.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export async function listRecentTransactions(limit = 10): Promise<Transaction[]> {
  const all = await db.transactions.toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, limit);
}
