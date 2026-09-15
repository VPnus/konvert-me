import { describe, expect, it } from 'vitest';

import {
  affectsCashFlow,
  expensesByCategory,
  freeCashMinor,
  monthTotals,
  planTotals,
  planVsFact,
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
