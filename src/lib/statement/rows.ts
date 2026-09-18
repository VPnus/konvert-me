/**
 * Statement rows turned into something the app can save, and the duplicate check
 * that keeps a file from landing twice.
 */

import type { Country } from '@/core/country';
import { rublesToMinor } from '@/core/money';
import type { IsoDate } from '@/core/time';
import { currentLocale } from '@/i18n/locale';
import { hashString } from '@/lib/hash';
import type { ColumnMapping } from '@/lib/statement/mapping';
import type { RawTable } from '@/lib/statement/table';
import { parseAmount, parseStatementDate } from '@/lib/statement/values';

/** Separator that cannot occur inside a cell, so a row has one text form. */
const CELL_SEPARATOR = '';

export type RowKind = 'income' | 'expense';

export interface StatementRow {
  /** Position in the file, so a row can be pointed at in the preview. */
  readonly index: number;
  readonly date: IsoDate;
  readonly amountMinor: number;
  readonly kind: RowKind;
  readonly note: string;
  /** Identity of the row inside its file — the same file gives the same hashes. */
  readonly hash: string;
  readonly raw: readonly string[];
}

export interface BuiltRows {
  readonly rows: StatementRow[];
  /** Lines that carried no date or no sum: a total, a page break, a footer. */
  readonly skipped: number;
}

function amountOf(
  row: readonly string[],
  mapping: ColumnMapping,
): { amountMinor: number; kind: RowKind } | null {
  if (mapping.amount !== null) {
    const value = parseAmount(row[mapping.amount] ?? '');
    if (value === null || value === 0) return null;
    return { amountMinor: rublesToMinor(Math.abs(value)), kind: value < 0 ? 'expense' : 'income' };
  }

  const income = mapping.income === null ? null : parseAmount(row[mapping.income] ?? '');
  const expense = mapping.expense === null ? null : parseAmount(row[mapping.expense] ?? '');

  if (income !== null && income !== 0) {
    return { amountMinor: rublesToMinor(Math.abs(income)), kind: 'income' };
  }
  if (expense !== null && expense !== 0) {
    return { amountMinor: rublesToMinor(Math.abs(expense)), kind: 'expense' };
  }
  return null;
}

/**
 * Two identical purchases on the same day must both survive, and re-importing the
 * same file must not add either of them again. So the identity of a row is its text
 * plus how many times that same text has already appeared in this file.
 */
export function buildRows(
  table: RawTable,
  mapping: ColumnMapping,
  options: { country?: Country } = {},
): BuiltRows {
  const rows: StatementRow[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;

  table.rows.forEach((raw, index) => {
    const date = parseStatementDate(raw[mapping.date] ?? '', { country: options.country });
    const amount = date ? amountOf(raw, mapping) : null;

    if (!date || !amount) {
      skipped += 1;
      return;
    }

    const line = raw.join(CELL_SEPARATOR);
    const occurrence = seen.get(line) ?? 0;
    seen.set(line, occurrence + 1);

    rows.push({
      index,
      date,
      amountMinor: amount.amountMinor,
      kind: amount.kind,
      note: (mapping.note === null ? '' : (raw[mapping.note] ?? '')).slice(0, 200),
      hash: hashString(`${line}#${occurrence}`),
      raw,
    });
  });

  return { rows, skipped };
}

export type DuplicateState = 'none' | 'exact' | 'possible';

export interface ExistingOperation {
  readonly date: string;
  readonly amountMinor: number;
  readonly importRowHash?: string;
}

/**
 * "exact" is the very same row of the very same file — it is left out by default.
 * "possible" only shares a date and a sum with something already recorded: the plan
 * asks for those to be shown, not dropped, because two identical purchases happen.
 */
export function markDuplicates(
  rows: readonly StatementRow[],
  existing: readonly ExistingOperation[],
): Map<number, DuplicateState> {
  const hashes = new Set(
    existing.map((operation) => operation.importRowHash).filter((hash): hash is string => Boolean(hash)),
  );
  const byDateAmount = new Set(existing.map((operation) => `${operation.date}:${operation.amountMinor}`));

  return new Map(
    rows.map((row) => {
      if (hashes.has(row.hash)) return [row.index, 'exact'];
      if (byDateAmount.has(`${row.date}:${row.amountMinor}`)) return [row.index, 'possible'];
      return [row.index, 'none'];
    }),
  );
}

export interface CategoryRule {
  readonly keyword: string;
  readonly categoryId: string;
}

/** The first rule whose keyword is in the note wins; nothing matches, nothing set. */
export function applyRules(note: string, rules: readonly CategoryRule[]): string | null {
  const locale = currentLocale();
  const text = note.toLocaleLowerCase(locale);
  const rule = rules.find(
    (candidate) =>
      candidate.keyword.trim() && text.includes(candidate.keyword.trim().toLocaleLowerCase(locale)),
  );
  return rule?.categoryId ?? null;
}
