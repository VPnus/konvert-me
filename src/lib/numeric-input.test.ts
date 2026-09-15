import { describe, expect, it } from 'vitest';

import { parseNumericInput, sanitizeNumericInput } from '@/lib/numeric-input';

describe('numeric input', () => {
  it('drops letters and everything that is not a number', () => {
    expect(sanitizeNumericInput('12абв34')).toBe('1234');
    expect(sanitizeNumericInput('1e5')).toBe('15');
    expect(sanitizeNumericInput('100 000 ₽')).toBe('100000');
    expect(sanitizeNumericInput('abc')).toBe('');
  });

  it('keeps one separator and the comma the user typed', () => {
    expect(sanitizeNumericInput('1234,56')).toBe('1234,56');
    expect(sanitizeNumericInput('1234.56')).toBe('1234.56');
    expect(sanitizeNumericInput('1,2,3')).toBe('1,23');
    expect(sanitizeNumericInput('1.2,3')).toBe('1.23');
    expect(sanitizeNumericInput(',5')).toBe(',5');
  });

  it('leaves no separator at all in integer mode', () => {
    expect(sanitizeNumericInput('15,7', { integer: true })).toBe('157');
    expect(sanitizeNumericInput('31', { integer: true })).toBe('31');
  });

  it('allows a minus only when it is asked for and only in front', () => {
    expect(sanitizeNumericInput('-500')).toBe('500');
    expect(sanitizeNumericInput('-500', { allowNegative: true })).toBe('-500');
    expect(sanitizeNumericInput('5-00', { allowNegative: true })).toBe('500');
  });

  it('reads the value with either separator', () => {
    expect(parseNumericInput('1234,56')).toBe(1234.56);
    expect(parseNumericInput('1234.56')).toBe(1234.56);
    expect(parseNumericInput('')).toBe(0);
    expect(parseNumericInput(',')).toBe(0);
  });
});
