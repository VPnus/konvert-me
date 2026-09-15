import { describe, expect, it } from 'vitest';

import {
  MoneyError,
  assertMinor,
  assertNonNegativeMinor,
  assertPositiveMinor,
  formatMinor,
  isMinor,
  minorToRubles,
  roundToMinor,
  rublesToMinor,
  sumMinor,
} from './money';

const nbsp = /[  \s]/g;
const normalize = (value: string): string => value.replace(nbsp, ' ');

describe('money: validation', () => {
  it('accepts integer kopecks', () => {
    expect(isMinor(0)).toBe(true);
    expect(isMinor(-100)).toBe(true);
    expect(isMinor(123456789)).toBe(true);
  });

  it('rejects non-integer kopecks', () => {
    expect(isMinor(10.5)).toBe(false);
    expect(() => assertMinor(10.5)).toThrow(MoneyError);
  });

  it('rejects NaN and Infinity', () => {
    expect(isMinor(Number.NaN)).toBe(false);
    expect(isMinor(Number.POSITIVE_INFINITY)).toBe(false);
    expect(() => assertMinor(Number.NaN)).toThrow(MoneyError);
    expect(() => assertMinor(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });

  it('rejects unsafe integers', () => {
    expect(isMinor(Number.MAX_SAFE_INTEGER + 2)).toBe(false);
  });

  it('rejects negative and zero amounts where a positive amount is required', () => {
    expect(() => assertPositiveMinor(-1)).toThrow(MoneyError);
    expect(() => assertPositiveMinor(0)).toThrow(MoneyError);
    expect(() => assertPositiveMinor(1)).not.toThrow();
  });

  it('allows zero but not a negative amount where a balance may be empty', () => {
    expect(() => assertNonNegativeMinor(0)).not.toThrow();
    expect(() => assertNonNegativeMinor(1)).not.toThrow();
    expect(() => assertNonNegativeMinor(-1)).toThrow(MoneyError);
    expect(() => assertNonNegativeMinor(1.5)).toThrow(MoneyError);
  });

  it('names the offending field in the error message', () => {
    expect(() => assertMinor(1.5, 'amountMinor')).toThrow(/amountMinor/);
  });
});

describe('money: rounding and conversion', () => {
  it('rounds half up to whole kopecks', () => {
    expect(roundToMinor(10.4)).toBe(10);
    expect(roundToMinor(10.5)).toBe(11);
    expect(roundToMinor(10.6)).toBe(11);
  });

  it('documents Math.round behaviour on negative halves (towards +Infinity)', () => {
    expect(roundToMinor(-10.5)).toBe(-10);
    expect(roundToMinor(-10.6)).toBe(-11);
  });

  it('refuses to round a non-finite value', () => {
    expect(() => roundToMinor(Number.NaN)).toThrow(MoneyError);
  });

  it('converts roubles to kopecks and back', () => {
    expect(rublesToMinor(1234.56)).toBe(123456);
    expect(rublesToMinor(0.005)).toBe(1);
    expect(minorToRubles(123456)).toBe(1234.56);
  });

  it('sums kopecks exactly', () => {
    expect(sumMinor([1, 2, 3])).toBe(6);
    expect(sumMinor([])).toBe(0);
    expect(() => sumMinor([1.5])).toThrow(MoneyError);
  });
});

describe('money: formatting', () => {
  it('formats as roubles in the ru-RU locale', () => {
    expect(normalize(formatMinor(123456))).toBe('1 234,56 ₽');
    expect(normalize(formatMinor(0))).toBe('0,00 ₽');
    expect(normalize(formatMinor(-5000))).toBe('-50,00 ₽');
  });

  it('can hide kopecks for large numbers', () => {
    expect(normalize(formatMinor(503884800, { fractionDigits: 0 }))).toBe('5 038 848 ₽');
  });

  it('can format without the currency sign', () => {
    expect(normalize(formatMinor(123456, { withCurrency: false }))).toBe('1 234,56');
  });

  it('reuses the cached formatter for repeated calls', () => {
    expect(formatMinor(100)).toBe(formatMinor(100));
  });

  it('refuses to format a non-integer amount', () => {
    expect(() => formatMinor(1.5)).toThrow(MoneyError);
  });
});
