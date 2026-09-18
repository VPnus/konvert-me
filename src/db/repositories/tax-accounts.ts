/**
 * The tax advantaged accounts of the United States: a 401(k), an IRA, a Roth IRA, an HSA, a 529.
 * They hold no money of the app's own — the balance keeps the account itself. Here lies what the
 * person has put into each of them in a year, which the limits of the law are held against.
 */

import { latestRules, rulesForYear } from '@/core/rules';
import {
  limitsOfYear,
  type LimitView,
  type TaxAccountKind,
  type YearContribution,
} from '@/core/tax-accounts';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { taxAccountSchema, type TaxAccount } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { strings } from '@/i18n';
import { publishAppEvent } from '@/lib/broadcast';

export interface TaxAccountInput {
  name: string;
  kind: TaxAccountKind;
  catchUp?: TaxAccount['catchUp'];
  familyCoverage?: boolean;
  matchShare?: number;
  matchUpToShareOfPay?: number;
  note?: string;
}

export async function listTaxAccounts(options: { includeArchived?: boolean } = {}): Promise<TaxAccount[]> {
  const all = await db.taxAccounts.toArray();
  const visible = options.includeArchived ? all : all.filter((account) => !account.archived);
  return visible.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export async function createTaxAccount(input: TaxAccountInput): Promise<TaxAccount> {
  const now = Date.now();
  const count = await db.taxAccounts.count();
  const account = parseOrThrow(
    taxAccountSchema,
    {
      ...input,
      id: crypto.randomUUID(),
      years: [],
      archived: false,
      sortOrder: count,
      createdAt: now,
      updatedAt: now,
    },
    strings.data.subjects.taxAccount,
  );

  await db.taxAccounts.add(account);
  publishAppEvent({ type: 'data-changed' });
  return account;
}

export async function updateTaxAccount(
  id: string,
  patch: Partial<TaxAccountInput> & { archived?: boolean },
): Promise<TaxAccount> {
  const current = await db.taxAccounts.get(id);
  if (!current) throw new RepositoryError(strings.data.notFound.taxAccount);

  const next = parseOrThrow(
    taxAccountSchema,
    { ...current, ...patch, id: current.id, createdAt: current.createdAt, updatedAt: Date.now() },
    strings.data.subjects.taxAccount,
  );

  await db.taxAccounts.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}

export async function deleteTaxAccount(id: string): Promise<void> {
  await db.taxAccounts.delete(id);
  publishAppEvent({ type: 'data-changed' });
}

/**
 * What went into an account in a year. A year set to nothing at all is dropped, so an account
 * untouched in a year does not keep a row of zeros.
 */
export async function setTaxAccountYear(
  id: string,
  year: number,
  contribution: YearContribution,
): Promise<TaxAccount> {
  const current = await db.taxAccounts.get(id);
  if (!current) throw new RepositoryError(strings.data.notFound.taxAccount);

  const empty = contribution.ownMinor === 0 && contribution.employerMinor === 0;
  const years = current.years.filter((entry) => entry.year !== year);
  if (!empty) years.push({ year, ...contribution });
  years.sort((a, b) => a.year - b.year);

  const next = parseOrThrow(
    taxAccountSchema,
    { ...current, years, updatedAt: Date.now() },
    strings.data.subjects.taxAccount,
  );

  await db.taxAccounts.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}

/** What one account took in a year; nothing at all if the year is not filled in. */
export function contributionOfYear(account: TaxAccount, year: number): YearContribution {
  const entry = account.years.find((item) => item.year === year);
  return { ownMinor: entry?.ownMinor ?? 0, employerMinor: entry?.employerMinor ?? 0 };
}

export interface TaxAccountsView {
  readonly year: number;
  readonly accounts: readonly TaxAccount[];
  readonly limits: readonly LimitView[];
  /** The year the norms held against the accounts were written for; an older one lends them. */
  readonly rulesYear: number;
}

/** Every account of the person with the limits of the year held against them. */
export async function loadTaxAccounts(year: number): Promise<TaxAccountsView> {
  const accounts = await listTaxAccounts();
  const rules = rulesForYear('us', year) ?? latestRules('us');
  const contributions = new Map(accounts.map((account) => [account.id, contributionOfYear(account, year)]));

  return { year, accounts, limits: limitsOfYear(accounts, contributions, rules), rulesYear: rules.year };
}
