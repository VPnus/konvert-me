import { describe, expect, it } from 'vitest';

import { monthlyContribution } from './goals';
import { roundToMinor } from './money';
import { courseCapitalMinor, pensionCapitalMinor, pensionDrawdown, pensionNeed } from './pension';

const RUB = 100;
const r = (rubles: number): number => Math.round(rubles * RUB);

// Lesson 7.4: spending of 240 032 a month in the prices of 2043, the year of retiring.
const A = r(240_032 * 12);
const RETURN = 0.0873;
const INFLATION = 0.069;

describe('pension: what a year on retirement costs (lesson 7.4, steps 1–5)', () => {
  it('70 % of the spending, less the state pension, in the prices of the year of retiring', () => {
    // 70 % of 116 149 is the 81 304 of the lesson, the state pension for two is 26 000;
    // the lesson counts the prices 22 years ahead and gets 240 032 a month.
    const need = pensionNeed({
      monthlyExpensesMinor: r(116_149),
      replacementRate: 0.7,
      statePensionMinor: r(26_000),
      inflationRate: INFLATION,
      months: 22 * 12,
    });

    expect(roundToMinor(need.desiredMonthlyMinor)).toBe(r(81_304.3));
    expect(roundToMinor(need.gapTodayMinor)).toBe(r(55_304.3));
    expect(Math.round(need.gapAtRetirementMinor / RUB)).toBe(240_032);
    expect(need.annualSpendingMinor).toBeCloseTo(need.gapAtRetirementMinor * 12, 6);
  });

  it('asks for nothing when the state pension covers the spending', () => {
    const need = pensionNeed({
      monthlyExpensesMinor: r(30_000),
      replacementRate: 0.7,
      statePensionMinor: r(26_000),
      inflationRate: INFLATION,
      months: 120,
    });

    expect(need.gapTodayMinor).toBe(0);
    expect(need.annualSpendingMinor).toBe(0);
  });
});

describe('pension capital (formula 12)', () => {
  // The plan gives whole rubles; the kopecks are from an independent recount in Python.
  it('living off the income keeps the capital: 171 138 881', () => {
    const capital = pensionCapitalMinor({
      annualSpendingMinor: A,
      returnRate: RETURN,
      inflationRate: INFLATION,
      strategy: { kind: 'keep-capital' },
    });

    expect(capital).not.toBeNull();
    expect(roundToMinor(capital ?? 0)).toBe(r(171_138_881.05));
  });

  it('spending the capital over 20 years: 49 263 768', () => {
    const capital = pensionCapitalMinor({
      annualSpendingMinor: A,
      returnRate: RETURN,
      inflationRate: INFLATION,
      strategy: { kind: 'spend-capital', years: 20 },
    });

    expect(roundToMinor(capital ?? 0)).toBe(r(49_263_767.97));
    expect(Math.round((capital ?? 0) / RUB)).toBe(49_263_768);
  });

  it('the course shortcut A / r gives 32 994 089 and is shown only as an explanation', () => {
    expect(Math.round((courseCapitalMinor(A, RETURN) ?? 0) / RUB)).toBe(32_994_089);
    expect(courseCapitalMinor(A, 0)).toBeNull();
  });

  it('cannot live off the income when the return does not beat inflation', () => {
    const params = { annualSpendingMinor: A, strategy: { kind: 'keep-capital' } as const };
    expect(pensionCapitalMinor({ ...params, returnRate: 0.069, inflationRate: 0.069 })).toBeNull();
    expect(pensionCapitalMinor({ ...params, returnRate: 0.05, inflationRate: 0.069 })).toBeNull();
  });

  it('with the return equal to inflation, spending the capital is simply A times the years', () => {
    const capital = pensionCapitalMinor({
      annualSpendingMinor: r(1_000_000),
      returnRate: 0.069,
      inflationRate: 0.069,
      strategy: { kind: 'spend-capital', years: 25 },
    });
    expect(capital).toBeCloseTo(r(25_000_000), 4);
  });

  it('needs no capital when there is nothing to pay', () => {
    expect(
      pensionCapitalMinor({
        annualSpendingMinor: 0,
        returnRate: RETURN,
        inflationRate: INFLATION,
        strategy: { kind: 'keep-capital' },
      }),
    ).toBe(0);
  });

  it('refuses a term that is not a whole number of years', () => {
    const params = { annualSpendingMinor: A, returnRate: RETURN, inflationRate: INFLATION };
    expect(() => pensionCapitalMinor({ ...params, strategy: { kind: 'spend-capital', years: 0 } })).toThrow(
      RangeError,
    );
    expect(() => pensionCapitalMinor({ ...params, strategy: { kind: 'spend-capital', years: 2.5 } })).toThrow(
      RangeError,
    );
  });
});

describe('pension: year by year on retirement', () => {
  it('the capital for 20 years runs out exactly with the twentieth payment', () => {
    const capital = pensionCapitalMinor({
      annualSpendingMinor: A,
      returnRate: RETURN,
      inflationRate: INFLATION,
      strategy: { kind: 'spend-capital', years: 20 },
    });
    const years = pensionDrawdown({
      capitalMinor: capital ?? 0,
      annualSpendingMinor: A,
      returnRate: RETURN,
      inflationRate: INFLATION,
      years: 20,
    });

    expect(years).toHaveLength(20);
    // The first payment is A itself, at the start of the first year; then it grows with prices.
    expect(years[0].paymentMinor).toBe(A);
    expect(years[1].paymentMinor).toBeCloseTo(A * 1.069, 4);
    expect(Math.abs(years[19].endMinor)).toBeLessThan(1);
    expect(years.every((year) => year.endMinor > -1)).toBe(true);
  });

  it('the capital to live off keeps its buying power: it grows with inflation', () => {
    const capital = pensionCapitalMinor({
      annualSpendingMinor: A,
      returnRate: RETURN,
      inflationRate: INFLATION,
      strategy: { kind: 'keep-capital' },
    });
    const years = pensionDrawdown({
      capitalMinor: capital ?? 0,
      annualSpendingMinor: A,
      returnRate: RETURN,
      inflationRate: INFLATION,
      years: 30,
    });

    expect(years[29].endMinor / Math.pow(1.069, 30)).toBeCloseTo(capital ?? 0, 0);
  });

  it('the capital of the course runs out long before twenty years are over', () => {
    const years = pensionDrawdown({
      capitalMinor: courseCapitalMinor(A, RETURN) ?? 0,
      annualSpendingMinor: A,
      returnRate: RETURN,
      inflationRate: INFLATION,
      years: 20,
    });

    const runsOut = years.findIndex((year) => year.endMinor < 0);
    expect(runsOut).toBeGreaterThan(0);
    expect(runsOut).toBeLessThan(19);
  });
});

describe('pension: how much to put aside (formula 4)', () => {
  it('lesson 7.4, step 7: 32 994 090 over 22 years at 8.73 % is 41 544 a month', () => {
    const payment = monthlyContribution({
      futureValueMinor: r(32_994_090),
      savedMinor: 0,
      returnRate: RETURN,
      months: 22 * 12,
    });
    expect(roundToMinor(payment)).toBe(r(41_544.09));
  });
});
