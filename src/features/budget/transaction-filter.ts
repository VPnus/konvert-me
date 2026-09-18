/**
 * What the operations list is filtered by. The filter lives in three places at once and they agree:
 * the state of the screen, the address of the page (so a search can be kept as a link and survives
 * a reload) and, for the period alone, the device (a habit, like the theme).
 */

import { isPeriodKind, normalizePeriod, type Period } from '@/core/period';
import { parseNumericInput, sanitizeNumericInput } from '@/lib/numeric-input';
import type { Transaction } from '@/db/models';

export interface TransactionFilterState {
  readonly query: string;
  readonly kind: '' | Transaction['kind'];
  /** Several at once; an empty list means every one of them. */
  readonly categoryIds: readonly string[];
  readonly accountIds: readonly string[];
  readonly period: Period;
  /** As typed, with the comma of a Russian keyboard; read as a number only when the list is asked. */
  readonly minAmount: string;
  readonly maxAmount: string;
}

export const EMPTY_FILTER: TransactionFilterState = {
  query: '',
  kind: '',
  categoryIds: [],
  accountIds: [],
  period: { kind: 'month' },
  minAmount: '',
  maxAmount: '',
};

/** The period is not counted: it is where the list looks, not what it looks for. */
export function isFilterEmpty(filter: TransactionFilterState): boolean {
  return (
    !filter.query &&
    !filter.kind &&
    filter.categoryIds.length === 0 &&
    filter.accountIds.length === 0 &&
    !filter.minAmount &&
    !filter.maxAmount
  );
}

/** How many conditions are on, for the badge of the panel that holds the rest of them. */
export function extraFilterCount(filter: TransactionFilterState): number {
  return (
    (filter.categoryIds.length > 0 ? 1 : 0) +
    (filter.accountIds.length > 0 ? 1 : 0) +
    (filter.minAmount || filter.maxAmount ? 1 : 0)
  );
}

export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((kept) => kept !== id) : [...ids, id];
}

const KINDS = ['income', 'expense', 'refund', 'transfer', 'adjustment', 'revaluation'] as const;

function amountMinor(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = parseNumericInput(value);
  return parsed > 0 ? Math.round(parsed * 100) : undefined;
}

/** What the repository is asked, from what the screen holds. */
export function filterToQuery(filter: TransactionFilterState): {
  query?: string;
  kinds?: readonly Transaction['kind'][];
  categoryIds?: readonly string[];
  accountIds?: readonly string[];
  minAmountMinor?: number;
  maxAmountMinor?: number;
} {
  return {
    query: filter.query || undefined,
    kinds: filter.kind ? [filter.kind] : undefined,
    categoryIds: filter.categoryIds.length > 0 ? filter.categoryIds : undefined,
    accountIds: filter.accountIds.length > 0 ? filter.accountIds : undefined,
    minAmountMinor: amountMinor(filter.minAmount),
    maxAmountMinor: amountMinor(filter.maxAmount),
  };
}

// ── the address of the page ──────────────────────────────────────────────────

export function filterToSearch(filter: TransactionFilterState): Record<string, string> {
  const search: Record<string, string> = {};
  if (filter.query) search.q = filter.query;
  if (filter.kind) search.kind = filter.kind;
  if (filter.categoryIds.length > 0) search.category = filter.categoryIds.join(',');
  if (filter.accountIds.length > 0) search.account = filter.accountIds.join(',');
  if (filter.minAmount) search.min = filter.minAmount;
  if (filter.maxAmount) search.max = filter.maxAmount;

  if (filter.period.kind !== 'month') search.period = filter.period.kind;
  if (filter.period.from) search.from = filter.period.from;
  if (filter.period.to) search.to = filter.period.to;

  return search;
}

function ids(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * The filter a link carries. Anything the address does not say falls back to what the device
 * remembers, and what neither of them says stays empty.
 */
export function filterFromSearch(
  params: URLSearchParams,
  remembered: Period = EMPTY_FILTER.period,
): TransactionFilterState {
  const kind = params.get('kind');
  const periodKind = params.get('period');
  const from = params.get('from') ?? undefined;
  const to = params.get('to') ?? undefined;

  const named = isPeriodKind(periodKind) ? periodKind : from || to ? 'custom' : null;
  const period = named ? normalizePeriod({ kind: named, from, to }) : remembered;

  return {
    query: params.get('q') ?? '',
    kind: KINDS.find((known) => known === kind) ?? '',
    categoryIds: ids(params.get('category')),
    accountIds: ids(params.get('account')),
    period,
    minAmount: sanitizeNumericInput(params.get('min') ?? ''),
    maxAmount: sanitizeNumericInput(params.get('max') ?? ''),
  };
}

/** Does the address say anything about the filter at all? */
export function searchHasFilter(params: URLSearchParams): boolean {
  return ['q', 'kind', 'category', 'account', 'min', 'max', 'period', 'from', 'to'].some((key) =>
    params.has(key),
  );
}

// ── the period the device remembers ──────────────────────────────────────────

export const PERIOD_STORAGE_KEY = 'konvert-me.budget-period';

export function readPeriod(store: Storage | null = safeStorage()): Period {
  try {
    const saved = store?.getItem(PERIOD_STORAGE_KEY);
    if (!saved) return EMPTY_FILTER.period;
    const parsed: unknown = JSON.parse(saved);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_FILTER.period;
    const { kind, from, to } = parsed as Partial<Period>;
    if (!isPeriodKind(kind)) return EMPTY_FILTER.period;
    return normalizePeriod({ kind, from, to });
  } catch {
    return EMPTY_FILTER.period;
  }
}

export function writePeriod(period: Period, store: Storage | null = safeStorage()): void {
  try {
    store?.setItem(PERIOD_STORAGE_KEY, JSON.stringify(period));
  } catch {
    // a private window may refuse: the period then lasts as long as the screen is open
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
