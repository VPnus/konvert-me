/**
 * Money is stored as whole kopecks (integers). Forecasts are computed as plain
 * numbers and rounded to kopecks only when they are saved or displayed.
 */

import type { Currency } from '@/core/country';
import { currentCurrency } from '@/i18n/country';
import { currentLocale } from '@/i18n/locale';

// Keyed by the language and the currency: a test may format in another one without a reload, and a
// change of the country draws the screens anew without one.
const MONEY_FORMATTERS = new Map<string, Intl.NumberFormat>();
const COMPACT_FORMATTERS = new Map<string, Intl.NumberFormat>();

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** A whole number of kopecks. */
export type Minor = number;

export function isMinor(value: unknown): value is Minor {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertMinor(value: number, label = 'amountMinor'): asserts value is Minor {
  if (!isMinor(value)) {
    throw new MoneyError(`${label}: whole kopecks expected, got ${String(value)}`);
  }
}

export function assertPositiveMinor(value: number, label = 'amountMinor'): asserts value is Minor {
  assertMinor(value, label);
  if (value <= 0) {
    throw new MoneyError(`${label}: the sum must be above zero, got ${String(value)}`);
  }
}

export function assertNonNegativeMinor(value: number, label = 'amountMinor'): asserts value is Minor {
  assertMinor(value, label);
  if (value < 0) {
    throw new MoneyError(`${label}: the sum cannot be negative, got ${String(value)}`);
  }
}

/**
 * Rounds a forecast to whole kopecks. Math.round is half-up, which for negative
 * halves rounds towards +Infinity (-10.5 becomes -10); stored amounts are positive.
 */
export function roundToMinor(value: number): Minor {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`Cannot round a value that is not a number: ${String(value)}`);
  }
  return Math.round(value);
}

export function rublesToMinor(rubles: number): Minor {
  return roundToMinor(rubles * 100);
}

export function minorToRubles(minor: Minor): number {
  assertMinor(minor);
  return minor / 100;
}

export function sumMinor(values: readonly number[]): Minor {
  let total = 0;
  for (const value of values) {
    assertMinor(value);
    total += value;
  }
  return total;
}

export interface FormatMinorOptions {
  readonly withCurrency?: boolean;
  readonly fractionDigits?: 0 | 2;
  /** Another currency than the one of the data: the sums of a country not chosen yet. */
  readonly currency?: Currency;
}

export function formatMinor(minor: Minor, options: FormatMinorOptions = {}): string {
  assertMinor(minor);
  const { withCurrency = true, fractionDigits = 2, currency = currentCurrency() } = options;
  const locale = currentLocale();
  const key = `${locale}:${currency}:${withCurrency ? 'sign' : 'plain'}:${fractionDigits}`;
  let formatter = MONEY_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: withCurrency ? 'currency' : 'decimal',
      currency,
      // ₽ and $ in every language: English would otherwise write RUB, and Russian US$.
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    MONEY_FORMATTERS.set(key, formatter);
  }
  return formatter.format(minor / 100);
}

/** The sign of the currency of the data, for the label of a field: ₽ or $. */
export function currencySign(): string {
  const parts = new Intl.NumberFormat(currentLocale(), {
    style: 'currency',
    currency: currentCurrency(),
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? currentCurrency();
}

/**
 * A forecast is a plain number until the moment it is shown: a contribution, a future
 * value, an average. This rounds to whole kopecks first, so the guard of formatMinor
 * never fires on an honest estimate, and defaults to whole roubles on screen.
 */
export function formatForecast(value: number, options: FormatMinorOptions = {}): string {
  return formatMinor(roundToMinor(value), { fractionDigits: 0, ...options });
}

/**
 * A sum in a few characters, for the scale of a chart: 15 тыс., 1,5 млн, 1 млрд. A scale is about
 * the shape, not the kopecks, and a mark on it may fall between two kopecks: that is no error here.
 */
export function formatCompactMinor(value: number): string {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`Cannot show a value that is not a number: ${String(value)}`);
  }
  const locale = currentLocale();
  let formatter = COMPACT_FORMATTERS.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { notation: 'compact' });
    COMPACT_FORMATTERS.set(locale, formatter);
  }
  return formatter.format(value / 100);
}
