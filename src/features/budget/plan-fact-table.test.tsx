import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Category } from '@/db/models';
import type { BudgetMonthData } from '@/features/budget/budget-data';
import { PlanFactTable } from '@/features/budget/plan-fact-table';

const RUB = 100;

afterEach(cleanup);

const category = (id: string, kind: Category['kind'], group?: Category['group']): Category => ({
  id,
  name: id,
  kind,
  group,
  sortOrder: 0,
  archived: false,
});

/** A month with a salary nobody planned and groceries past their plan. */
const month: BudgetMonthData = {
  month: '2026-09',
  categories: [category('salary', 'income'), category('groceries', 'expense', 'variable')],
  accounts: [],
  plans: [],
  rows: [
    {
      categoryId: 'salary',
      kind: 'income',
      planMinor: 0,
      factMinor: 39_000 * RUB,
      deviationMinor: 39_000 * RUB,
      remainingMinor: -39_000 * RUB,
    },
    {
      categoryId: 'groceries',
      kind: 'expense',
      planMinor: 20_000 * RUB,
      factMinor: 22_000 * RUB,
      deviationMinor: -2_000 * RUB,
      remainingMinor: -2_000 * RUB,
    },
  ],
  fact: { incomeMinor: 39_000 * RUB, expenseMinor: 22_000 * RUB, freeCashMinor: 17_000 * RUB },
  plan: { incomeMinor: 0, expenseMinor: 20_000 * RUB, freeCashMinor: -20_000 * RUB },
  groups: { mandatoryMinor: 0, variableMinor: 22_000 * RUB, ungroupedMinor: 0 },
};

describe('the plan against the fact', () => {
  it('shows income over the plan with a plus and without red', () => {
    // the scenario report: "Зарплата, осталось −39 000" in red read as an overspend
    render(<PlanFactTable data={month} />);

    const salary = screen.getByTestId('remaining-salary');
    expect(salary.textContent).toMatch(/^\+39\s000$/);
    expect(salary).not.toHaveClass('text-destructive');
    expect(salary).toHaveAttribute('title', 'сверх плана');
    expect(screen.getByTestId('group-remaining-income')).not.toHaveClass('text-destructive');
    expect(screen.getByTestId('total-income-remaining').textContent).toMatch(/^\+39\s000$/);
  });

  it('still paints spending past the plan red, with a minus', () => {
    render(<PlanFactTable data={month} />);

    const groceries = screen.getByTestId('remaining-groceries');
    expect(groceries.textContent).toMatch(/^[-−]2\s000$/);
    expect(groceries).toHaveClass('text-destructive');
    expect(groceries).toHaveAttribute('title', 'перерасход');
    expect(screen.getByTestId('group-remaining-variable')).toHaveClass('text-destructive');
  });
});
