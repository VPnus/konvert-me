/**
 * Operations. A contribution to a goal is a transfer plus an envelope, never an
 * expense, so transfers stay out of income and expenses (formula 7).
 */

import { monthOfDate, yearOfMonth, type IsoMonth } from '@/core/time';
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

/** Both sides of an operation: money leaving one account can break its envelopes. */
function accountsOf(...transactions: (Transaction | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const transaction of transactions) {
    if (!transaction) continue;
    ids.add(transaction.accountId);
    if (transaction.toAccountId) ids.add(transaction.toAccountId);
  }
  return [...ids];
}

async function assertAccountsExist(transaction: Transaction): Promise<void> {
  const accounts = await db.accounts.bulkGet(accountsOf(transaction));
  if (accounts.some((account) => account === undefined)) {
    throw new RepositoryError('Счёт операции не найден');
  }
}

/** Runs a change and puts the previous rows back if it breaks the envelopes. */
async function keepEnvelopesIntact(
  accountIds: readonly string[],
  rollback: () => Promise<unknown>,
): Promise<void> {
  try {
    for (const accountId of accountIds) await assertEnvelopesFit(accountId);
  } catch (error) {
    await rollback();
    throw error;
  }
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const transaction = parseOrThrow(
    transactionSchema,
    { ...input, id: crypto.randomUUID(), createdAt: Date.now() },
    'Операция',
  );

  await assertAccountsExist(transaction);
  await db.transactions.add(transaction);

  await keepEnvelopesIntact(accountsOf(transaction), () => db.transactions.delete(transaction.id));

  publishAppEvent({ type: 'data-changed' });
  return transaction;
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  return db.transactions.get(id);
}

export async function updateTransaction(id: string, patch: Partial<TransactionInput>): Promise<Transaction> {
  const current = await db.transactions.get(id);
  if (!current) throw new RepositoryError('Операция не найдена');

  const next = parseOrThrow(
    transactionSchema,
    {
      ...current,
      ...patch,
      // A kind that carries no counterparty or category must not keep the old one.
      toAccountId:
        patch.kind && patch.kind !== 'transfer' ? undefined : (patch.toAccountId ?? current.toAccountId),
      categoryId:
        patch.kind && !['income', 'expense', 'refund'].includes(patch.kind)
          ? undefined
          : (patch.categoryId ?? current.categoryId),
      id: current.id,
      createdAt: current.createdAt,
    },
    'Операция',
  );

  await assertAccountsExist(next);
  await db.transactions.put(next);

  // Both the old and the new accounts are checked: money may have moved between them.
  await keepEnvelopesIntact(accountsOf(current, next), () => db.transactions.put(current));

  publishAppEvent({ type: 'data-changed' });
  return next;
}

export async function deleteTransaction(id: string): Promise<void> {
  const current = await db.transactions.get(id);
  if (!current) return;

  await db.transactions.delete(id);

  // Removing an income can leave the envelopes of its account without cover.
  await keepEnvelopesIntact(accountsOf(current), () => db.transactions.add(current));

  publishAppEvent({ type: 'data-changed' });
}

export interface TransactionFilter {
  readonly month?: IsoMonth;
  readonly year?: number;
  readonly kinds?: readonly Transaction['kind'][];
  readonly categoryId?: string;
  /** Matches either side of a transfer. */
  readonly accountId?: string;
  /** Free text: a word of the note or a piece of the amount. */
  readonly query?: string;
  readonly limit?: number;
}

function matchesQuery(transaction: Transaction, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (!needle) return true;
  if (transaction.note?.toLocaleLowerCase('ru').includes(needle)) return true;
  if (transaction.date.includes(needle)) return true;
  // "1500" finds 1 500,00 ₽ — the amount as it is typed, not as it is formatted.
  return String(transaction.amountMinor / 100).includes(needle);
}

/** Newest first, which is the order both the list and the dashboard want. */
function byDateDesc(a: Transaction, b: Transaction): number {
  return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
}

export async function listTransactions(filter: TransactionFilter = {}): Promise<Transaction[]> {
  const all = await db.transactions.toArray();

  const found = all.filter((transaction) => {
    if (filter.month && monthOfDate(transaction.date) !== filter.month) return false;
    if (filter.year !== undefined && yearOfMonth(monthOfDate(transaction.date)) !== filter.year) return false;
    if (filter.kinds && filter.kinds.length > 0 && !filter.kinds.includes(transaction.kind)) return false;
    if (filter.categoryId && transaction.categoryId !== filter.categoryId) return false;
    if (
      filter.accountId &&
      transaction.accountId !== filter.accountId &&
      transaction.toAccountId !== filter.accountId
    ) {
      return false;
    }
    return filter.query ? matchesQuery(transaction, filter.query) : true;
  });

  found.sort(byDateDesc);
  return filter.limit === undefined ? found : found.slice(0, filter.limit);
}

export async function listTransactionsOfMonth(month: IsoMonth): Promise<Transaction[]> {
  return listTransactions({ month });
}

export async function listRecentTransactions(limit = 10): Promise<Transaction[]> {
  return listTransactions({ limit });
}

export interface ImportedRow extends TransactionInput {
  /** Identity of the row in its file: the same file never lands twice. */
  importRowHash: string;
}

export interface ImportResult {
  readonly batchId: string;
  readonly imported: number;
}

/**
 * Writes a whole statement at once under one batch id, so the import can be undone
 * as a whole. Rows whose hash is already stored are left out: re-importing the same
 * file adds nothing.
 */
export async function importTransactions(rows: readonly ImportedRow[]): Promise<ImportResult> {
  const batchId = crypto.randomUUID();
  const now = Date.now();

  const known = new Set(
    (await db.transactions.toArray())
      .map((transaction) => transaction.importRowHash)
      .filter((hash): hash is string => Boolean(hash)),
  );

  const fresh = rows.filter((row) => !known.has(row.importRowHash));
  const prepared = fresh.map((row, index) =>
    parseOrThrow(
      transactionSchema,
      { ...row, id: crypto.randomUUID(), importBatchId: batchId, createdAt: now + index },
      'Операция',
    ),
  );

  if (prepared.length === 0) return { batchId, imported: 0 };

  const accountIds = [...new Set(prepared.map((transaction) => transaction.accountId))];
  const accounts = await db.accounts.bulkGet(accountIds);
  if (accounts.some((account) => account === undefined)) {
    throw new RepositoryError('Счёт операции не найден');
  }

  await db.transactions.bulkAdd(prepared);

  await keepEnvelopesIntact(accountIds, () =>
    db.transactions.bulkDelete(prepared.map((transaction) => transaction.id)),
  );

  publishAppEvent({ type: 'data-changed' });
  return { batchId, imported: prepared.length };
}

export interface ImportBatch {
  readonly batchId: string;
  readonly count: number;
  readonly importedAt: number;
  readonly from: string;
  readonly to: string;
}

/** Every import that can still be undone, the most recent first. */
export async function listImportBatches(): Promise<ImportBatch[]> {
  const all = await db.transactions.toArray();
  const batches = new Map<string, Transaction[]>();

  for (const transaction of all) {
    if (!transaction.importBatchId) continue;
    batches.set(transaction.importBatchId, [...(batches.get(transaction.importBatchId) ?? []), transaction]);
  }

  return [...batches.entries()]
    .map(([batchId, items]) => {
      const dates = items.map((item) => item.date).sort();
      return {
        batchId,
        count: items.length,
        importedAt: Math.min(...items.map((item) => item.createdAt)),
        from: dates[0],
        to: dates[dates.length - 1],
      };
    })
    .sort((a, b) => b.importedAt - a.importedAt);
}

/** Undoes a whole import: the plan asks for it as one action, not row by row. */
export async function deleteImportBatch(batchId: string): Promise<number> {
  const count = await db.transactions.where('importBatchId').equals(batchId).delete();
  if (count > 0) publishAppEvent({ type: 'data-changed' });
  return count;
}
