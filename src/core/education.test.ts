import { describe, expect, it } from 'vitest';

import {
  educationCapitalMinor,
  educationLumpSumMinor,
  educationSchedule,
  type EducationParams,
} from './education';
import { monthlyContribution } from './goals';
import { roundToMinor } from './money';

const RUB = 100;
const r = (rubles: number): number => Math.round(rubles * RUB);

// Lesson 7.3: 240 000 a year for the university and 360 000 for living in another city,
// six years each; inflation 6.9 %, return 8.83 %. Child 1 starts in 96 months, child 2 in 120.
const lesson = (startMonth: string): EducationParams => ({
  yearlyCostMinor: r(600_000),
  years: 6,
  costAsOf: '2021-09',
  startMonth,
  returnRate: 0.0883,
  inflationRate: 0.069,
});
const CHILD_1 = lesson('2029-09');
const CHILD_2 = lesson('2031-09');

const contribution = (target: number, months: number) =>
  roundToMinor(monthlyContribution({ futureValueMinor: target, savedMinor: 0, returnRate: 0.0883, months }));

describe('education as one sum by the start', () => {
  it('child 1: 3 600 000 in 96 months is 6 139 374.73, or 44 227.02 a month', () => {
    const target = educationLumpSumMinor(CHILD_1);
    expect(roundToMinor(target)).toBe(r(6_139_374.73));
    expect(contribution(target, 96)).toBe(r(44_227.02));
  });

  it('child 2: 3 600 000 in 120 months is 7 015 838.01, or 36 604.60 a month', () => {
    const target = educationLumpSumMinor(CHILD_2);
    expect(roundToMinor(target)).toBe(r(7_015_838.01));
    expect(contribution(target, 120)).toBe(r(36_604.6));
  });
});

describe('education year by year (stage 8)', () => {
  // Not in the lesson: recounted independently in Python by the same rule — the money of
  // each year is needed at its start, and until then it earns the return.
  it('child 1: the capital at the start is 5 825 523.25, or 41 966.08 a month', () => {
    const capital = educationCapitalMinor(CHILD_1);
    expect(roundToMinor(capital)).toBe(r(5_825_523.25));
    expect(contribution(capital, 96)).toBe(r(41_966.08));
  });

  it('child 2: the capital at the start is 6 657 180.77, or 34 733.33 a month', () => {
    const capital = educationCapitalMinor(CHILD_2);
    expect(roundToMinor(capital)).toBe(r(6_657_180.77));
    expect(contribution(capital, 120)).toBe(r(34_733.33));
  });

  it('each year costs more with prices and is worth less at the start the later it comes', () => {
    const years = educationSchedule(CHILD_1);

    expect(years.map((year) => year.month)).toEqual([
      '2029-09',
      '2030-09',
      '2031-09',
      '2032-09',
      '2033-09',
      '2034-09',
    ]);
    expect(roundToMinor(years[0].costMinor)).toBe(r(1_023_229.12));
    expect(roundToMinor(years[5].costMinor)).toBe(r(1_428_438.08));
    // The first year is paid on the day of the start: nothing to discount.
    expect(years[0].atStartMinor).toBe(years[0].costMinor);
    expect(roundToMinor(years[5].atStartMinor)).toBe(r(920_073.26));
  });

  it('a single year is the course sum of that year', () => {
    const one = { ...CHILD_1, years: 1 };
    expect(educationCapitalMinor(one)).toBeCloseTo(educationLumpSumMinor(one), 6);
  });

  it('without return and inflation both ways give the plain sum', () => {
    const flat = { ...CHILD_1, returnRate: 0, inflationRate: 0 };
    expect(educationCapitalMinor(flat)).toBe(r(3_600_000));
    expect(educationLumpSumMinor(flat)).toBe(r(3_600_000));
  });

  it('a start already in the prices of today is not discounted back', () => {
    const now = { ...CHILD_1, startMonth: '2021-09', years: 1 };
    expect(educationCapitalMinor(now)).toBe(r(600_000));
  });

  it('refuses a length of studies that is not a whole number of years', () => {
    expect(() => educationSchedule({ ...CHILD_1, years: 0 })).toThrow(RangeError);
    expect(() => educationSchedule({ ...CHILD_1, years: 4.5 })).toThrow(RangeError);
  });
});
