/**
 * Which column is what. The guess is a starting point the person can correct in the
 * wizard — it is never the last word.
 */

import type { RawTable } from '@/lib/statement/table';
import { parseAmount, parseStatementDate } from '@/lib/statement/values';

export interface ColumnMapping {
  /** Index of the column with the date of the operation. */
  date: number;
  /** One signed column with the sum: minus is money out. */
  amount: number | null;
  /** Or two columns: what came in and what went out. */
  income: number | null;
  expense: number | null;
  note: number | null;
}

const PATTERNS: Record<keyof Omit<ColumnMapping, 'date'> | 'date', readonly RegExp[]> = {
  date: [/дата.*операц/i, /дата/i, /transaction date/i, /post(ing)? date/i, /date/i],
  income: [/приход/i, /поступлени/i, /кредит/i, /зачислени/i, /credit/i, /deposit/i],
  expense: [/расход/i, /списани/i, /дебет/i, /debit/i, /withdrawal/i],
  amount: [/сумма.*операц/i, /сумма/i, /transaction amount/i, /amount/i, /оборот/i],
  note: [
    /назначени/i,
    /описани/i,
    /коммент/i,
    /получател/i,
    /контрагент/i,
    /description/i,
    /details/i,
    /payee/i,
    /merchant/i,
    /memo/i,
  ],
};

function findColumn(headers: readonly string[], patterns: readonly RegExp[]): number | null {
  for (const pattern of patterns) {
    const index = headers.findIndex((header) => pattern.test(header));
    if (index >= 0) return index;
  }
  return null;
}

/** How many rows of a column parse as a date, and as a sum. */
function countParsable(rows: readonly string[][], index: number): { dates: number; amounts: number } {
  let dates = 0;
  let amounts = 0;

  for (const row of rows.slice(0, 30)) {
    const cell = row[index] ?? '';
    if (parseStatementDate(cell)) dates += 1;
    if (parseAmount(cell) !== null) amounts += 1;
  }

  return { dates, amounts };
}

/**
 * Reads the headers first and falls back to the content: a column most of whose
 * cells parse as dates is the date column, whatever it is called.
 */
export function guessMapping(table: RawTable): ColumnMapping {
  const { headers, rows } = table;

  const income = findColumn(headers, PATTERNS.income);
  const expense = findColumn(headers, PATTERNS.expense);
  const hasPair = income !== null && expense !== null;

  const mapping: ColumnMapping = {
    date: findColumn(headers, PATTERNS.date) ?? -1,
    amount: hasPair ? null : findColumn(headers, PATTERNS.amount),
    income: hasPair ? income : null,
    expense: hasPair ? expense : null,
    note: findColumn(headers, PATTERNS.note),
  };

  if (mapping.date === -1 || (mapping.amount === null && !hasPair)) {
    const stats = headers.map((_, index) => countParsable(rows, index));
    const sample = Math.min(rows.length, 30);

    if (mapping.date === -1) {
      const best = stats.reduce((champion, current, index) => {
        return current.dates > (stats[champion]?.dates ?? -1) ? index : champion;
      }, 0);
      if (sample > 0 && stats[best]?.dates > sample / 2) mapping.date = best;
    }

    if (mapping.amount === null && !hasPair) {
      const best = stats.reduce(
        (champion, current, index) => {
          if (index === mapping.date) return champion;
          return current.amounts > (stats[champion]?.amounts ?? -1) ? index : champion;
        },
        mapping.date === 0 ? 1 : 0,
      );
      if (sample > 0 && stats[best]?.amounts > sample / 2) mapping.amount = best;
    }
  }

  if (mapping.note === null) {
    // The widest text column that is neither the date nor a sum is the description.
    const taken = new Set([mapping.date, mapping.amount, mapping.income, mapping.expense]);
    const lengths = headers.map((_, index) =>
      taken.has(index) ? -1 : rows.slice(0, 30).reduce((total, row) => total + (row[index]?.length ?? 0), 0),
    );
    const best = lengths.indexOf(Math.max(...lengths));
    if (best >= 0 && lengths[best] > 0) mapping.note = best;
  }

  return mapping;
}

export function isMappingReady(mapping: ColumnMapping): boolean {
  return (
    mapping.date >= 0 && (mapping.amount !== null || mapping.income !== null || mapping.expense !== null)
  );
}
