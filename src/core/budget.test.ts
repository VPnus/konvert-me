import { describe, expect, it } from 'vitest';

import {
  affectsCashFlow,
  expensesByCategory,
  expensesByGroup,
  freeCashMinor,
  monthTotals,
  planTotals,
  planVsFact,
  yearPlanTotals,
  yearTotals,
} from './budget';
import type { CoreCategory, CoreTransaction } from './types';

const RUB = 100;
const r = (rubles: number): number => Math.round(rubles * RUB);

const categories: CoreCategory[] = [
  { id: 'salary', kind: 'income' },
  { id: 'rent', kind: 'expense', group: 'mandatory' },
  { id: 'food', kind: 'expense', group: 'variable' },
];

const tx = (
  partial: Partial<CoreTransaction> & Pick<CoreTransaction, 'date' | 'kind' | 'amountMinor'>,
): CoreTransaction => ({
  accountId: 'debit',
  ...partial,
});

const september: CoreTransaction[] = [
  tx({ date: '2026-09-05', kind: 'income', amountMinor: r(150_000), categoryId: 'salary' }),
  tx({ date: '2026-09-06', kind: 'expense', amountMinor: r(40_000), categoryId: 'rent' }),
  tx({ date: '2026-09-07', kind: 'expense', amountMinor: r(20_000), categoryId: 'food' }),
  tx({ date: '2026-09-08', kind: 'refund', amountMinor: r(2_000), categoryId: 'food' }),
  tx({ date: '2026-09-09', kind: 'transfer', amountMinor: r(30_000), toAccountId: 'savings' }),
  tx({ date: '2026-09-10', kind: 'adjustment', amountMinor: r(1_000), direction: 'increase' }),
  tx({
    date: '2026-09-11',
    kind: 'revaluation',
    amountMinor: r(500_000),
    accountId: 'flat',
    direction: 'increase',
  }),
  tx({ date: '2026-10-01', kind: 'expense', amountMinor: r(9_999), categoryId: 'food' }),
];

describe('budget: which kinds are cash flow', () => {
  it('counts only income, expense and refund', () => {
    expect(affectsCashFlow('income')).toBe(true);
    expect(affectsCashFlow('expense')).toBe(true);
    expect(affectsCashFlow('refund')).toBe(true);
    expect(affectsCashFlow('transfer')).toBe(false);
    expect(affectsCashFlow('adjustment')).toBe(false);
    expect(affectsCashFlow('revaluation')).toBe(false);
  });
});

describe('budget: month totals (formula 7)', () => {
  it('ignores transfers, adjustments, revaluations and other months', () => {
    const totals = monthTotals(september, '2026-09');
    expect(totals.incomeMinor).toBe(r(150_000));
    expect(totals.expenseMinor).toBe(r(58_000));
    expect(totals.freeCashMinor).toBe(r(92_000));
  });

  it('subtracts refunds from the expenses of their own category', () => {
    expect(expensesByCategory(september, '2026-09').get('food')).toBe(r(18_000));
    expect(expensesByCategory(september, '2026-09').get('rent')).toBe(r(40_000));
  });

  it('skips a transaction without a category in the per-category breakdown', () => {
    const uncategorised = [tx({ date: '2026-09-03', kind: 'expense', amountMinor: r(1_000) })];
    expect(expensesByCategory(uncategorised, '2026-09').size).toBe(0);
    expect(monthTotals(uncategorised, '2026-09').expenseMinor).toBe(r(1_000));
  });

  it('can go negative when spending exceeds income', () => {
    const totals = monthTotals(
      [
        tx({ date: '2026-09-01', kind: 'income', amountMinor: r(10_000), categoryId: 'salary' }),
        tx({ date: '2026-09-02', kind: 'expense', amountMinor: r(15_000), categoryId: 'food' }),
      ],
      '2026-09',
    );
    expect(totals.freeCashMinor).toBe(-r(5_000));
  });

  it('returns zeroes for a month without data', () => {
    expect(monthTotals(september, '2026-01')).toEqual({
      incomeMinor: 0,
      expenseMinor: 0,
      freeCashMinor: 0,
    });
  });

  it('exposes the free balance directly', () => {
    expect(freeCashMinor(september, '2026-09')).toBe(r(92_000));
  });

  it('counts a card purchase as an expense even though it grows a debt', () => {
    const totals = monthTotals(
      [
        tx({
          date: '2026-09-02',
          kind: 'expense',
          amountMinor: r(5_000),
          categoryId: 'food',
          accountId: 'card',
        }),
      ],
      '2026-09',
    );
    expect(totals.expenseMinor).toBe(r(5_000));
  });

  it('counts repaying a card as a transfer, not an expense', () => {
    const totals = monthTotals(
      [
        tx({
          date: '2026-09-20',
          kind: 'transfer',
          amountMinor: r(5_000),
          accountId: 'debit',
          toAccountId: 'card',
        }),
      ],
      '2026-09',
    );
    expect(totals.expenseMinor).toBe(0);
    expect(totals.freeCashMinor).toBe(0);
  });
});

describe('budget: year totals', () => {
  it('sums twelve months and keeps the monthly breakdown', () => {
    const year = yearTotals(september, 2026);
    expect(year.incomeMinor).toBe(r(150_000));
    expect(year.expenseMinor).toBe(r(67_999));
    expect(year.freeCashMinor).toBe(r(82_001));
    expect(Object.keys(year.byMonth)).toHaveLength(12);
    expect(year.byMonth['2026-09'].freeCashMinor).toBe(r(92_000));
    expect(year.byMonth['2026-10'].expenseMinor).toBe(r(9_999));
    expect(year.byMonth['2026-01'].incomeMinor).toBe(0);
  });
});

describe('budget: plan versus fact', () => {
  const plans = [
    { month: '2026-09', categoryId: 'salary', amountMinor: r(150_000) },
    { month: '2026-09', categoryId: 'rent', amountMinor: r(40_000) },
    { month: '2026-09', categoryId: 'food', amountMinor: r(25_000) },
    { month: '2026-10', categoryId: 'food', amountMinor: r(25_000) },
  ];

  it('totals the plan of a month', () => {
    const totals = planTotals(plans, '2026-09', categories);
    expect(totals.incomeMinor).toBe(r(150_000));
    expect(totals.expenseMinor).toBe(r(65_000));
    expect(totals.freeCashMinor).toBe(r(85_000));
  });

  it('ignores a plan line of an unknown category in the totals', () => {
    const totals = planTotals(
      [{ month: '2026-09', categoryId: 'ghost', amountMinor: r(1_000) }],
      '2026-09',
      categories,
    );
    expect(totals).toEqual({ incomeMinor: 0, expenseMinor: 0, freeCashMinor: 0 });
  });

  it('ignores plan lines of other months', () => {
    expect(planTotals(plans, '2026-10', categories).expenseMinor).toBe(r(25_000));
  });

  it('reports the deviation per category', () => {
    const rows = planVsFact(plans, september, '2026-09', categories);
    expect(rows).toEqual([
      {
        categoryId: 'salary',
        kind: 'income',
        planMinor: r(150_000),
        factMinor: r(150_000),
        deviationMinor: 0,
      },
      { categoryId: 'rent', kind: 'expense', planMinor: r(40_000), factMinor: r(40_000), deviationMinor: 0 },
      {
        categoryId: 'food',
        kind: 'expense',
        planMinor: r(25_000),
        factMinor: r(18_000),
        deviationMinor: r(7_000),
      },
    ]);
  });

  it('shows categories that have a fact but no plan', () => {
    const rows = planVsFact([], september, '2026-09', categories);
    expect(rows.map((row) => row.categoryId)).toEqual(['salary', 'rent', 'food']);
    expect(rows.every((row) => row.planMinor === 0)).toBe(true);
  });

  it('ignores an unknown category id', () => {
    const rows = planVsFact(
      [{ month: '2026-09', categoryId: 'ghost', amountMinor: r(1_000) }],
      [],
      '2026-09',
      categories,
    );
    expect(rows).toEqual([]);
  });
});

/**
 * The acceptance test of stage 4: a month with transfers, a refund and a purchase on a
 * credit card, checked against numbers computed by hand.
 *
 * Income   120 000 + 15 000                                   = 135 000
 * Expenses  35 000 + (18 500 - 1 200) + 24 990                =  77 290
 * Free     135 000 - 77 290                                   =  57 710
 */
describe('budget: the totals of stage 4 match a hand calculation', () => {
  const fullCategories: CoreCategory[] = [
    { id: 'salary', kind: 'income' },
    { id: 'side', kind: 'income' },
    { id: 'rent', kind: 'expense', group: 'mandatory' },
    { id: 'food', kind: 'expense', group: 'variable' },
    { id: 'tech', kind: 'expense', group: 'variable' },
  ];

  const set: CoreTransaction[] = [
    tx({ date: '2026-09-05', kind: 'income', amountMinor: r(120_000), categoryId: 'salary' }),
    tx({ date: '2026-09-18', kind: 'income', amountMinor: r(15_000), categoryId: 'side', accountId: 'cash' }),
    tx({ date: '2026-09-06', kind: 'expense', amountMinor: r(35_000), categoryId: 'rent' }),
    tx({ date: '2026-09-07', kind: 'expense', amountMinor: r(18_500), categoryId: 'food' }),
    tx({ date: '2026-09-12', kind: 'refund', amountMinor: r(1_200), categoryId: 'food' }),
    // bought with a credit card: an expense of the month that also grows a debt
    tx({
      date: '2026-09-14',
      kind: 'expense',
      amountMinor: r(24_990),
      categoryId: 'tech',
      accountId: 'card',
    }),
    // a contribution to a goal and a card repayment: money moves, the budget does not
    tx({ date: '2026-09-20', kind: 'transfer', amountMinor: r(30_000), toAccountId: 'savings' }),
    tx({ date: '2026-09-25', kind: 'transfer', amountMinor: r(12_000), toAccountId: 'card' }),
    tx({ date: '2026-09-30', kind: 'adjustment', amountMinor: r(500), accountId: 'cash' }),
    // october, so that the year is more than one month
    tx({ date: '2026-10-05', kind: 'income', amountMinor: r(120_000), categoryId: 'salary' }),
    tx({ date: '2026-10-09', kind: 'expense', amountMinor: r(20_000), categoryId: 'food' }),
  ];

  const plans = [
    { month: '2026-09', categoryId: 'salary', amountMinor: r(120_000) },
    { month: '2026-09', categoryId: 'side', amountMinor: r(10_000) },
    { month: '2026-09', categoryId: 'rent', amountMinor: r(35_000) },
    { month: '2026-09', categoryId: 'food', amountMinor: r(20_000) },
  ];

  it('totals the month exactly as the hand calculation does', () => {
    expect(monthTotals(set, '2026-09')).toEqual({
      incomeMinor: r(135_000),
      expenseMinor: r(77_290),
      freeCashMinor: r(57_710),
    });
  });

  it('splits the expenses into mandatory and variable', () => {
    expect(expensesByGroup(set, '2026-09', fullCategories)).toEqual({
      mandatoryMinor: r(35_000),
      variableMinor: r(42_290),
      ungroupedMinor: 0,
    });
  });

  it('puts an expense without a category outside both groups', () => {
    const groups = expensesByGroup(
      [tx({ date: '2026-09-03', kind: 'expense', amountMinor: r(700) })],
      '2026-09',
      fullCategories,
    );
    expect(groups).toEqual({ mandatoryMinor: 0, variableMinor: 0, ungroupedMinor: r(700) });
  });

  it('sums the year from the months', () => {
    const year = yearTotals(set, 2026);
    expect(year.incomeMinor).toBe(r(255_000));
    expect(year.expenseMinor).toBe(r(97_290));
    expect(year.freeCashMinor).toBe(r(157_710));
    expect(year.byMonth['2026-09'].freeCashMinor).toBe(r(57_710));
    expect(year.byMonth['2026-10'].freeCashMinor).toBe(r(100_000));
  });

  it('sums the plan of the year the same way', () => {
    const year = yearPlanTotals(plans, 2026, fullCategories);
    expect(year.incomeMinor).toBe(r(130_000));
    expect(year.expenseMinor).toBe(r(55_000));
    expect(year.freeCashMinor).toBe(r(75_000));
    expect(year.byMonth['2026-09'].freeCashMinor).toBe(r(75_000));
    expect(year.byMonth['2026-10'].incomeMinor).toBe(0);
  });

  it('keeps the deviations of the categories equal to the deviation of the month', () => {
    const rows = planVsFact(plans, set, '2026-09', fullCategories);
    expect(rows.map((row) => [row.categoryId, row.deviationMinor])).toEqual([
      ['salary', 0],
      ['side', r(5_000)],
      ['rent', 0],
      ['food', r(2_700)],
      ['tech', -r(24_990)],
    ]);

    const sum = rows.reduce((total, row) => total + row.deviationMinor, 0);
    const fact = monthTotals(set, '2026-09').freeCashMinor;
    const plan = planTotals(plans, '2026-09', fullCategories).freeCashMinor;
    expect(sum).toBe(fact - plan);
  });

  it('keeps a row for an untouched category when the screen asks for one', () => {
    const rows = planVsFact([], [], '2026-09', fullCategories, { includeEmpty: true });
    expect(rows).toHaveLength(fullCategories.length);
    expect(rows.every((row) => row.planMinor === 0 && row.factMinor === 0)).toBe(true);
  });
});
