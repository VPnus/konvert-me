/**
 * The two values every statement row carries — a date and a sum — written the way a
 * bank felt like writing them.
 */

import type { Country } from '@/core/country';
import { isIsoDate, type IsoDate } from '@/core/time';
import { currentCountry } from '@/i18n/country';

/** Spaces banks use inside numbers, including the narrow and non-breaking ones. */
const SPACES = /[\s\u00a0\u202f\u2009]/g;
const CURRENCY = /(₽|руб\.?|rub|usd|eur|\$|€)/gi;

/**
 * "1 234,56", "1,234.56", "-1234.56", "(1 234,56)" → a number of roubles. When both
 * separators are there the last one is the decimal point; a lone comma is a decimal
 * point when two digits or fewer follow it, and a thousands mark otherwise.
 */
export function parseAmount(raw: string): number | null {
  const text = raw.replace(SPACES, '').replace(CURRENCY, '').trim();
  if (!text) return null;

  const negative = /^\(.*\)$/.test(text) || text.startsWith('-') || text.startsWith('−');
  const digits = text.replace(/[()\-−+]/g, '');
  if (!/^[\d.,]+$/.test(digits) || !/\d/.test(digits)) return null;

  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = Math.max(lastComma, lastDot);
    normalized = `${digits.slice(0, decimal).replace(/[.,]/g, '')}.${digits.slice(decimal + 1)}`;
  } else if (lastComma >= 0) {
    const tail = digits.length - lastComma - 1;
    normalized = tail <= 2 ? digits.replace(',', '.') : digits.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const tail = digits.length - lastDot - 1;
    normalized = tail <= 2 ? digits : digits.replace(/\./g, '');
  } else {
    normalized = digits;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

// The four-digit year comes first: an alternation would otherwise take
// "2026" as the two digits "20".
const DOTTED = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4}|\d{2})/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Which of the two numbers comes first where the statement was printed. */
export function monthComesFirst(country: Country = currentCountry()): boolean {
  return country === 'us';
}

export interface StatementDateOptions {
  /** For a year of two digits: 26 is 2026 while this century lasts. */
  readonly now?: Date;
  /** The country the statement was printed in: "09/05/2026" is 5 September in one and 9 May in the other. */
  readonly country?: Country;
}

/** "05.09.2026", "5/9/26", "09/05/2026" in the United States, "2026-09-05 12:30" → "2026-09-05". */
export function parseStatementDate(raw: string, options: StatementDateOptions = {}): IsoDate | null {
  const { now = new Date(), country } = options;
  const text = raw.trim();
  if (!text) return null;

  const iso = ISO.exec(text);
  if (iso) {
    const value = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return isIsoDate(value) ? value : null;
  }

  const dotted = DOTTED.exec(text);
  if (!dotted) return null;

  const [, first, second, year] = dotted;
  let day = monthComesFirst(country) ? Number(second) : Number(first);
  let month = monthComesFirst(country) ? Number(first) : Number(second);
  // A number above twelve is a day whatever the country: a bank that writes the other way round is read too.
  if (month > 12 && day <= 12) [day, month] = [month, day];

  const century = Math.floor(now.getFullYear() / 100) * 100;
  const fullYear = year.length === 4 ? Number(year) : century + Number(year);
  const value = `${String(fullYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return isIsoDate(value) ? value : null;
}
