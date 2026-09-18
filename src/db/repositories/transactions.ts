/**
 * Operations. A contribution to a goal is a transfer plus an envelope, never an
 * expense, so transfers stay out of income and expenses (formula 7).
 */

import { monthOfDate, yearOfMonth, type IsoDate, type IsoMonth } from '@/core/time';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { transactionSchema, type Transaction } from '@/db/models';
import { assertEnvelopesFit } from '@/db/repositories/accounts';
import { parseOrThrow } from '@/db/validate';
import { strings } from '@/i18n';
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
    throw new RepositoryError(strings.data.notFound.transactionAccount);
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
    strings.data.subjects.transaction,
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
  if (!current) throw new RepositoryError(strings.data.notFound.transaction);

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
    strings.data.subjects.transaction,
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
  /** Both ends inclusive; an absent end leaves that side open. */
  readonly from?: IsoDate;
  readonly to?: IsoDate;
  readonly kinds?: readonly Transaction['kind'][];
  readonly categoryId?: string;
  /** Several categories at once: an empty list means every category. */
  readonly categoryIds?: readonly string[];
  /** Matches either side of a transfer. */
  readonly accountId?: string;
  readonly accountIds?: readonly string[];
  readonly minAmountMinor?: number;
  readonly maxAmountMinor?: number;
  /** Free text: a word of the note or a piece of the amount. */
  readonly query?: string;
  readonly limit?: number;
  /** Rows to skip before the limit: the list shows a long answer in parts. */
  readonly offset?: number;
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

/**
 * The dates a filter asks for, as one range. A month and a year are ranges too, so the same index
 * answers all three and the whole table is read only when no date is named at all.
 */
function rangeOf(filter: TransactionFilter): { from?: IsoDate; to?: IsoDate } {
  if (filter.month) return { from: `${filter.month}-01`, to: `${filter.month}-31` };
  if (filter.year !== undefined) {
    const year = String(filter.year).padStart(4, '0');
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  return { from: filter.from, to: filter.to };
}

function matches(transaction: Transaction, filter: TransactionFilter): boolean {
  if (filter.month && monthOfDate(transaction.date) !== filter.month) return false;
  if (filter.year !== undefined && yearOfMonth(monthOfDate(transaction.date)) !== filter.year) return false;
  if (filter.from && transaction.date < filter.from) return false;
  if (filter.to && transaction.date > filter.to) return false;
  if (filter.kinds && filter.kinds.length > 0 && !filter.kinds.includes(transaction.kind)) return false;
  if (filter.categoryId && transaction.categoryId !== filter.categoryId) return false;
  if (filter.categoryIds && filter.categoryIds.length > 0) {
    if (!transaction.categoryId || !filter.categoryIds.includes(transaction.categoryId)) return false;
  }
  if (
    filter.accountId &&
    transaction.accountId !== filter.accountId &&
    transaction.toAccountId !== filter.accountId
  ) {
    return false;
  }
  if (filter.accountIds && filter.accountIds.length > 0) {
    const onThisSide = filter.accountIds.includes(transaction.accountId);
    const onThatSide = transaction.toAccountId ? filter.accountIds.includes(transaction.toAccountId) : false;
    if (!onThisSide && !onThatSide) return false;
  }
  if (filter.minAmountMinor !== undefined && transaction.amountMinor < filter.minAmountMinor) return false;
  if (filter.maxAmountMinor !== undefined && transaction.amountMinor > filter.maxAmountMinor) return false;
  return filter.query ? matchesQuery(transaction, filter.query) : true;
}

/** Everything a filter finds, newest first, whatever the limit of the page is. */
export async function findTransactions(filter: TransactionFilter = {}): Promise<Transaction[]> {
  const { from, to } = rangeOf(filter);

  // The index of the date answers a range without reading the rest of the table; with no date in
  // the filter there is nothing to narrow by, and the whole table is the answer anyway.
  const source =
    from || to
      ? await db.transactions
          .where('date')
          .between(from ?? '0000-01-01', to ?? '9999-12-31', true, true)
          .toArray()
      : await db.transactions.toArray();

  const found = source.filter((transaction) => matches(transaction, filter));
  found.sort(byDateDesc);
  return found;
}

export async function listTransactions(filter: TransactionFilter = {}): Promise<Transaction[]> {
  const found = await findTransactions(filter);
  const offset = filter.offset ?? 0;
  if (offset === 0 && filter.limit === undefined) return found;
  return found.slice(offset, filter.limit === undefined ? undefined : offset + filter.limit);
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

  // The hashes come straight out of their index: rows typed by hand have none, so
  // they are not in it, and no record has to be read to answer this.
  const known = new Set(await db.transactions.orderBy('importRowHash').keys());

  const fresh = rows.filter((row) => !known.has(row.importRowHash));
  const prepared = fresh.map((row, index) =>
    parseOrThrow(
      transactionSchema,
      { ...row, id: crypto.randomUUID(), importBatchId: batchId, createdAt: now + index },
      strings.data.subjects.transaction,
    ),
  );

  if (prepared.length === 0) return { batchId, imported: 0 };

  const accountIds = [...new Set(prepared.map((transaction) => transaction.accountId))];
  const accounts = await db.accounts.bulkGet(accountIds);
  if (accounts.some((account) => account === undefined)) {
    throw new RepositoryError(strings.data.notFound.transactionAccount);
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
  // Only rows that carry a batch id are in that index, so what was typed by hand is
  // never read here.
  const imported = await db.transactions.orderBy('importBatchId').toArray();
  const batches = new Map<string, Transaction[]>();

  for (const transaction of imported) {
    const batchId = transaction.importBatchId;
    if (!batchId) continue;

    const group = batches.get(batchId);
    if (group) group.push(transaction);
    else batches.set(batchId, [transaction]);
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
