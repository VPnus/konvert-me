import { describe, expect, it } from 'vitest';

import { roundToMinor } from './money';
import {
  allocateFreeCash,
  contributionPlan,
  futureValueMinor,
  goalFutureValueMinor,
  monthlyContribution,
  monthlyRate,
  monthsToGoal,
  realReturnRate,
  remainingMonths,
  returnBeatsInflation,
  goalProjection,
} from './goals';

const RUB = 100;
const r = (rubles: number): number => Math.round(rubles * RUB);

describe('goals: monthly rate is nominal r / 12 (course convention)', () => {
  it('divides the annual rate by twelve', () => {
    expect(monthlyRate(0.12)).toBeCloseTo(0.01, 12);
    expect(monthlyRate(0.1)).toBeCloseTo(0.0083333333, 10);
    expect(monthlyRate(0)).toBe(0);
  });
});

describe('goals: future value (formula 2)', () => {
  it('lesson 2.2 — flat for 4 000 000 at 8 % over 36 months', () => {
    expect(roundToMinor(futureValueMinor(r(4_000_000), 0.08, 36))).toBe(r(5_038_848));
  });

  it('lesson 2.4 — flat for 3 000 000 at 8 % over 60 months', () => {
    expect(roundToMinor(futureValueMinor(r(3_000_000), 0.08, 60))).toBe(r(4_407_984.23));
  });

  it('education, child 1 — 3 600 000 at 6.9 % over 96 months', () => {
    expect(roundToMinor(futureValueMinor(r(3_600_000), 0.069, 96))).toBe(r(6_139_374.73));
  });

  it('education, child 2 — 3 600 000 at 6.9 % over 120 months', () => {
    expect(roundToMinor(futureValueMinor(r(3_600_000), 0.069, 120))).toBe(r(7_015_838.01));
  });

  it('keeps the cost unchanged with zero inflation or zero months', () => {
    expect(futureValueMinor(r(120_000), 0, 12)).toBe(r(120_000));
    expect(futureValueMinor(r(120_000), 0.08, 0)).toBe(r(120_000));
  });

  it('uses months between costAsOf and targetMonth', () => {
    const fv = goalFutureValueMinor({
      costMinor: r(4_000_000),
      costAsOf: '2026-01',
      targetMonth: '2029-01',
      returnRate: 0.1,
      inflationRate: 0.08,
    });
    expect(roundToMinor(fv)).toBe(r(5_038_848));
  });

  it('never discounts a cost quoted after the target month', () => {
    const fv = goalFutureValueMinor({
      costMinor: r(1_000_000),
      costAsOf: '2027-01',
      targetMonth: '2026-01',
      returnRate: 0.1,
      inflationRate: 0.08,
    });
    expect(fv).toBe(r(1_000_000));
  });
});

describe('goals: monthly contribution (formula 4)', () => {
  it('lesson 2.2 — no starting capital', () => {
    const pmt = monthlyContribution({
      futureValueMinor: r(5_038_848),
      savedMinor: 0,
      returnRate: 0.1,
      months: 36,
    });
    expect(roundToMinor(pmt)).toBe(r(120_599.05));
  });

  it('lesson 2.4 — starting capital earns interest too', () => {
    const pmt = monthlyContribution({
      futureValueMinor: futureValueMinor(r(3_000_000), 0.08, 60),
      savedMinor: r(500_000),
      returnRate: 0.14,
      months: 60,
    });
    expect(roundToMinor(pmt)).toBe(r(39_505.47));
    expect(roundToMinor(pmt * 12)).toBe(r(474_065.7));
  });

  it('regression: the course spreadsheet subtracts S without growth and overstates the payment', () => {
    const wrong = monthlyContribution({
      futureValueMinor: futureValueMinor(r(3_000_000), 0.08, 60) - r(500_000),
      savedMinor: 0,
      returnRate: 0.14,
      months: 60,
    });
    expect(roundToMinor(wrong)).toBe(r(45_338.81));
  });

  it('education vectors', () => {
    expect(
      roundToMinor(
        monthlyContribution({
          futureValueMinor: futureValueMinor(r(3_600_000), 0.069, 96),
          savedMinor: 0,
          returnRate: 0.0883,
          months: 96,
        }),
      ),
    ).toBe(r(44_227.02));

    expect(
      roundToMinor(
        monthlyContribution({
          futureValueMinor: futureValueMinor(r(3_600_000), 0.069, 120),
          savedMinor: 0,
          returnRate: 0.0883,
          months: 120,
        }),
      ),
    ).toBe(r(36_604.6));
  });

  it('zero return: the payment is a plain division', () => {
    const pmt = monthlyContribution({
      futureValueMinor: r(120_000),
      savedMinor: 0,
      returnRate: 0,
      months: 12,
    });
    expect(roundToMinor(pmt)).toBe(r(10_000));
  });

  it('zero return with inflation above zero still divides the inflated cost', () => {
    const fv = futureValueMinor(r(120_000), 0.08, 12);
    const pmt = monthlyContribution({ futureValueMinor: fv, savedMinor: 0, returnRate: 0, months: 12 });
    expect(roundToMinor(pmt)).toBe(roundToMinor(fv / 12));
  });

  it('returns zero when the capital already outgrows the goal', () => {
    expect(
      monthlyContribution({
        futureValueMinor: r(100_000),
        savedMinor: r(100_000),
        returnRate: 0.1,
        months: 12,
      }),
    ).toBe(0);
  });

  it('returns zero when savings already equal the goal at zero return', () => {
    expect(
      monthlyContribution({
        futureValueMinor: r(100_000),
        savedMinor: r(100_000),
        returnRate: 0,
        months: 12,
      }),
    ).toBe(0);
  });

  it('rejects a term of zero or less', () => {
    expect(() =>
      monthlyContribution({ futureValueMinor: r(1000), savedMinor: 0, returnRate: 0.1, months: 0 }),
    ).toThrow();
    expect(() =>
      monthlyContribution({ futureValueMinor: r(1000), savedMinor: 0, returnRate: 0.1, months: -3 }),
    ).toThrow();
  });
});

describe('goals: remaining term and plan status (formula 3)', () => {
  it('counts months from the current month to the target', () => {
    expect(remainingMonths('2026-09', '2029-09')).toBe(36);
    expect(remainingMonths('2026-09', '2026-09')).toBe(0);
    expect(remainingMonths('2026-09', '2026-08')).toBe(-1);
  });

  it('marks a goal overdue when the term has passed and it is not funded', () => {
    const plan = contributionPlan(
      {
        costMinor: r(1_000_000),
        costAsOf: '2026-01',
        targetMonth: '2026-08',
        returnRate: 0.1,
        inflationRate: 0.08,
      },
      { currentMonth: '2026-09', savedMinor: r(10_000) },
    );
    expect(plan.status).toBe('overdue');
    expect(plan.contributionMinor).toBe(0);
  });

  it('marks a goal funded when savings already cover it, even past the target month', () => {
    const plan = contributionPlan(
      {
        costMinor: r(1_000_000),
        costAsOf: '2026-01',
        targetMonth: '2026-08',
        returnRate: 0.1,
        inflationRate: 0.08,
      },
      { currentMonth: '2026-09', savedMinor: r(5_000_000) },
    );
    expect(plan.status).toBe('funded');
    expect(plan.contributionMinor).toBe(0);
  });

  it('recomputes the contribution from the actual savings every month', () => {
    const goal = {
      costMinor: r(3_000_000),
      costAsOf: '2026-01',
      targetMonth: '2031-01',
      returnRate: 0.14,
      inflationRate: 0.08,
    } as const;

    const first = contributionPlan(goal, { currentMonth: '2026-01', savedMinor: r(500_000) });
    expect(first.status).toBe('active');
    expect(first.months).toBe(60);
    expect(roundToMinor(first.contributionMinor)).toBe(r(39_505.47));

    const afterSkippedMonth = contributionPlan(goal, { currentMonth: '2026-02', savedMinor: r(500_000) });
    expect(afterSkippedMonth.months).toBe(59);
    expect(afterSkippedMonth.contributionMinor).toBeGreaterThan(first.contributionMinor);
  });
});

describe('goals: term for a given payment (formula 5, linear scan)', () => {
  const lesson24 = {
    costMinor: r(3_000_000),
    costAsOf: '2026-01',
    currentMonth: '2026-01',
    savedMinor: r(500_000),
    returnRate: 0.14,
    inflationRate: 0.08,
  } as const;

  it('reproduces 60 months for the lesson 2.4 payment', () => {
    expect(monthsToGoal({ ...lesson24, paymentMinor: r(39_506) })).toBe(60);
  });

  it('reproduces 77 months for a 30 000 payment', () => {
    expect(monthsToGoal({ ...lesson24, paymentMinor: r(30_000) })).toBe(77);
  });

  it('handles the non-monotonic case a binary search would miss', () => {
    expect(
      monthsToGoal({
        costMinor: r(10_000),
        costAsOf: '2026-01',
        currentMonth: '2026-01',
        savedMinor: 0,
        paymentMinor: r(1_000),
        returnRate: 0,
        inflationRate: 0.1,
      }),
    ).toBe(11);
  });

  it('inflates the cost from costAsOf through the current month', () => {
    const shifted = monthsToGoal({ ...lesson24, currentMonth: '2027-01', paymentMinor: r(39_506) });
    expect(shifted).not.toBeNull();
    expect(shifted).toBeGreaterThan(60);
  });

  it('returns null when the goal is unreachable within 1200 months', () => {
    expect(
      monthsToGoal({
        costMinor: r(10_000_000),
        costAsOf: '2026-01',
        currentMonth: '2026-01',
        savedMinor: 0,
        paymentMinor: r(100),
        returnRate: 0,
        inflationRate: 0.1,
      }),
    ).toBeNull();
  });

  it('accepts a term of exactly 1200 months', () => {
    const months = monthsToGoal({
      costMinor: r(1_000_000),
      costAsOf: '2026-01',
      currentMonth: '2026-01',
      savedMinor: 0,
      paymentMinor: r(833.34),
      returnRate: 0,
      inflationRate: 0,
    });
    expect(months).toBe(1200);
  });

  it('rejects a payment that is not positive', () => {
    expect(() => monthsToGoal({ ...lesson24, paymentMinor: 0 })).toThrow();
    expect(() => monthsToGoal({ ...lesson24, paymentMinor: -1 })).toThrow();
  });
});

describe('goals: real return (formula 6)', () => {
  it('discounts the nominal return by inflation', () => {
    expect(realReturnRate(0.0873, 0.069)).toBeCloseTo(0.0171188, 6);
    expect(realReturnRate(0.08, 0.08)).toBeCloseTo(0, 12);
  });

  it('warns when twelve monthly periods do not beat inflation', () => {
    expect(returnBeatsInflation(0.1, 0.08)).toBe(true);
    expect(returnBeatsInflation(0.05, 0.08)).toBe(false);
    expect(returnBeatsInflation(0.08, 0.08)).toBe(true);
    expect(returnBeatsInflation(0, 0)).toBe(false);
  });
});

describe('goals: distribution of free cash (formula 8)', () => {
  const requests = [
    { goalId: 'flat', priority: 2, requiredMinor: r(40_000) },
    { goalId: 'reserve', priority: 0, requiredMinor: r(10_000) },
    { goalId: 'car', priority: 1, requiredMinor: r(20_000) },
  ];

  it('funds goals by priority, smaller number first', () => {
    const result = allocateFreeCash(requests, r(70_000));
    expect(result.allocations.map((a) => a.goalId)).toEqual(['reserve', 'car', 'flat']);
    expect(result.allocations.map((a) => a.allocatedMinor)).toEqual([r(10_000), r(20_000), r(40_000)]);
    expect(result.leftoverMinor).toBe(0);
    expect(result.totalDeficitMinor).toBe(0);
  });

  it('leaves the surplus untouched', () => {
    const result = allocateFreeCash(requests, r(100_000));
    expect(result.leftoverMinor).toBe(r(30_000));
  });

  it('reports the deficit of every underfunded goal', () => {
    const result = allocateFreeCash(requests, r(25_000));
    expect(result.allocations).toEqual([
      {
        goalId: 'reserve',
        priority: 0,
        requiredMinor: r(10_000),
        allocatedMinor: r(10_000),
        deficitMinor: 0,
      },
      {
        goalId: 'car',
        priority: 1,
        requiredMinor: r(20_000),
        allocatedMinor: r(15_000),
        deficitMinor: r(5_000),
      },
      { goalId: 'flat', priority: 2, requiredMinor: r(40_000), allocatedMinor: 0, deficitMinor: r(40_000) },
    ]);
    expect(result.totalDeficitMinor).toBe(r(45_000));
    expect(result.leftoverMinor).toBe(0);
  });

  it('treats a negative free balance as nothing to distribute', () => {
    const result = allocateFreeCash(requests, -r(5_000));
    expect(result.allocations.every((a) => a.allocatedMinor === 0)).toBe(true);
    expect(result.leftoverMinor).toBe(0);
    expect(result.totalDeficitMinor).toBe(r(70_000));
  });

  it('breaks priority ties by goal id so the order is stable', () => {
    const result = allocateFreeCash(
      [
        { goalId: 'b', priority: 1, requiredMinor: r(1_000) },
        { goalId: 'a', priority: 1, requiredMinor: r(1_000) },
      ],
      r(1_000),
    );
    expect(result.allocations.map((a) => a.goalId)).toEqual(['a', 'b']);
    expect(result.allocations[0].allocatedMinor).toBe(r(1_000));
    expect(result.allocations[1].allocatedMinor).toBe(0);
  });

  it('handles an empty list', () => {
    const result = allocateFreeCash([], r(1_000));
    expect(result.allocations).toEqual([]);
    expect(result.leftoverMinor).toBe(r(1_000));
  });
});

describe('goals: the line of a goal month by month (for the chart)', () => {
  // The flat of lesson 2.4: C = 3 000 000 as of the month it is priced in, 60 months,
  // r = 14 %, π = 8 %, S = 500 000, contribution 39 505,47.
  const flat = {
    costMinor: 3_000_000 * 100,
    costAsOf: '2026-09',
    targetMonth: '2031-09',
    returnRate: 0.14,
    inflationRate: 0.08,
  };

  it('starts at what is saved today and ends at the future value', () => {
    const points = goalProjection({
      ...flat,
      currentMonth: '2026-09',
      savedMinor: 500_000 * 100,
      contributionMinor: 39_505.47 * 100,
    });

    expect(points).toHaveLength(61);
    expect(points[0]).toMatchObject({ offset: 0, month: '2026-09', savedMinor: 500_000 * 100 });
    expect(points[0].targetMinor).toBeCloseTo(3_000_000 * 100, 2);

    const last = points[points.length - 1];
    expect(last.month).toBe('2031-09');
    // both lines meet at the end: that is what the contribution was computed for
    expect(last.targetMinor / 100).toBeCloseTo(4_407_984.23, 2);
    expect(last.savedMinor / 100).toBeCloseTo(4_407_984.23, 0);
  });

  it('adds the contributions without interest when the return is zero', () => {
    const points = goalProjection({
      costMinor: 120_000 * 100,
      costAsOf: '2026-09',
      targetMonth: '2027-09',
      returnRate: 0,
      inflationRate: 0,
      currentMonth: '2026-09',
      savedMinor: 0,
      contributionMinor: 10_000 * 100,
    });

    expect(points[12].savedMinor).toBe(120_000 * 100);
    expect(points[12].targetMinor).toBe(120_000 * 100);
    expect(points[6].savedMinor).toBe(60_000 * 100);
  });

  it('draws as many months as it is asked to, and nothing for a date in the past', () => {
    expect(
      goalProjection({
        ...flat,
        currentMonth: '2026-09',
        savedMinor: 0,
        contributionMinor: 1_000 * 100,
        months: 3,
      }),
    ).toHaveLength(4);

    expect(
      goalProjection({ ...flat, currentMonth: '2031-09', savedMinor: 0, contributionMinor: 100 }),
    ).toEqual([]);
  });
});

describe('goals: the two formulas agree with each other', () => {
  // Formula 4 answers "how much per month for n months"; formula 5 answers "how many
  // months at that contribution". Asked in turn they must name the same n.
  const cases = [
    { costMinor: 4_000_000 * 100, months: 36, returnRate: 0.1, inflationRate: 0.08, savedMinor: 0 },
    {
      costMinor: 3_000_000 * 100,
      months: 60,
      returnRate: 0.14,
      inflationRate: 0.08,
      savedMinor: 500_000 * 100,
    },
    { costMinor: 120_000 * 100, months: 12, returnRate: 0, inflationRate: 0, savedMinor: 0 },
  ];

  for (const [index, sample] of cases.entries()) {
    it(`agrees on case ${index + 1}`, () => {
      const target = futureValueMinor(sample.costMinor, sample.inflationRate, sample.months);
      const paymentMinor = monthlyContribution({
        futureValueMinor: target,
        savedMinor: sample.savedMinor,
        returnRate: sample.returnRate,
        months: sample.months,
      });

      expect(
        monthsToGoal({
          costMinor: sample.costMinor,
          costAsOf: '2026-09',
          currentMonth: '2026-09',
          savedMinor: sample.savedMinor,
          paymentMinor,
          returnRate: sample.returnRate,
          inflationRate: sample.inflationRate,
        }),
      ).toBe(sample.months);
    });
  }
});

describe('goals: a month without a contribution', () => {
  const goal = {
    costMinor: 600_000 * 100,
    costAsOf: '2026-09',
    targetMonth: '2027-09',
    returnRate: 0.1,
    inflationRate: 0.08,
  };

  it('asks for more next month, because the term got shorter and nothing was put aside', () => {
    const september = contributionPlan(goal, { currentMonth: '2026-09', savedMinor: 0 });
    const october = contributionPlan(goal, { currentMonth: '2026-10', savedMinor: 0 });

    expect(september.months).toBe(12);
    expect(october.months).toBe(11);
    expect(october.contributionMinor).toBeGreaterThan(september.contributionMinor);
  });

  it('asks for less when the contribution was actually made', () => {
    const september = contributionPlan(goal, { currentMonth: '2026-09', savedMinor: 0 });
    const paid = contributionPlan(goal, {
      currentMonth: '2026-10',
      savedMinor: september.contributionMinor,
    });
    const skipped = contributionPlan(goal, { currentMonth: '2026-10', savedMinor: 0 });

    expect(paid.contributionMinor).toBeLessThan(skipped.contributionMinor);
    // and staying on plan keeps the contribution where it was, give or take a rouble
    expect(paid.contributionMinor).toBeCloseTo(september.contributionMinor, -2);
  });
});
