import { describe, expect, it } from 'vitest';

import { isDateInRange, normalizePeriod, rangeOfPeriod } from './period';

describe('rangeOfPeriod', () => {
  it('takes the month chosen on the screen', () => {
    expect(rangeOfPeriod({ kind: 'month' }, '2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('ends the three months on the chosen one', () => {
    expect(rangeOfPeriod({ kind: 'quarter' }, '2026-09')).toEqual({ from: '2026-07-01', to: '2026-09-30' });
  });

  it('crosses the turn of the year', () => {
    expect(rangeOfPeriod({ kind: 'quarter' }, '2026-01')).toEqual({ from: '2025-11-01', to: '2026-01-31' });
  });

  it('takes the whole year of the chosen month', () => {
    expect(rangeOfPeriod({ kind: 'year' }, '2026-09')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('leaves both ends open for the whole time', () => {
    expect(rangeOfPeriod({ kind: 'all' }, '2026-09')).toEqual({});
  });

  it('keeps the dates of a custom period', () => {
    expect(rangeOfPeriod({ kind: 'custom', from: '2026-03-05', to: '2026-04-01' }, '2026-09')).toEqual({
      from: '2026-03-05',
      to: '2026-04-01',
    });
  });

  it('knows February of a leap year', () => {
    expect(rangeOfPeriod({ kind: 'month' }, '2028-02').to).toBe('2028-02-29');
  });
});

describe('normalizePeriod', () => {
  it('drops the dates of a period that has none', () => {
    expect(normalizePeriod({ kind: 'month', from: '2026-01-01' })).toEqual({ kind: 'month' });
  });

  it('keeps one end of a custom period', () => {
    expect(normalizePeriod({ kind: 'custom', from: '2026-01-01' })).toEqual({
      kind: 'custom',
      from: '2026-01-01',
    });
  });

  it('keeps a custom period that has no dates yet: the fields are still empty', () => {
    expect(normalizePeriod({ kind: 'custom' })).toEqual({ kind: 'custom', from: undefined, to: undefined });
    expect(rangeOfPeriod({ kind: 'custom' }, '2026-09')).toEqual({ from: undefined, to: undefined });
  });

  it('refuses a date that is not a date', () => {
    expect(normalizePeriod({ kind: 'custom', from: 'вчера', to: '2026-02-01' })).toEqual({
      kind: 'custom',
      to: '2026-02-01',
    });
  });
});

describe('isDateInRange', () => {
  it('holds both ends inside', () => {
    const range = { from: '2026-09-01', to: '2026-09-30' };
    expect(isDateInRange('2026-09-01', range)).toBe(true);
    expect(isDateInRange('2026-09-30', range)).toBe(true);
    expect(isDateInRange('2026-08-31', range)).toBe(false);
    expect(isDateInRange('2026-10-01', range)).toBe(false);
  });

  it('takes everything when the range is open', () => {
    expect(isDateInRange('1999-01-01', {})).toBe(true);
  });
});
