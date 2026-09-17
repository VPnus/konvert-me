/**
 * Money is stored as whole kopecks (integers). Forecasts are computed as plain
 * numbers and rounded to kopecks only when they are saved or displayed.
 */

import { currentLocale } from '@/i18n/locale';

// Keyed by the language too: a test may format in another one without a reload.
const RUB_FORMATTERS = new Map<string, Intl.NumberFormat>();
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
}

export function formatMinor(minor: Minor, options: FormatMinorOptions = {}): string {
  assertMinor(minor);
  const { withCurrency = true, fractionDigits = 2 } = options;
  const locale = currentLocale();
  const key = `${locale}:${withCurrency ? 'rub' : 'plain'}:${fractionDigits}`;
  let formatter = RUB_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: withCurrency ? 'currency' : 'decimal',
      currency: 'RUB',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    RUB_FORMATTERS.set(key, formatter);
  }
  return formatter.format(minor / 100);
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
