import { beforeEach, describe, expect, it } from 'vitest';

import { pensionCapitalMinor } from '@/core/pension';
import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import type { EducationPlan, FinancialPlan, PensionPlan } from '@/db/models';
import { createAccount } from '@/db/repositories/accounts';
import {
  emptyFinancialPlan,
  saveEducationPlan,
  savePensionPlan,
  setPlanActionDone,
} from '@/db/repositories/financial-plan';
import { createGoal, ensureReserveGoal } from '@/db/repositories/goals';
import { planActions } from '@/features/plan/actions';
import { educationView, pensionView, retirementMonthOf } from '@/features/plan/calculations';
import { loadPlan } from '@/features/plan/plan-data';
import { planReviewReminder } from '@/features/plan/review';

const RUB = 100;
// The middle of September 2026: no month or year boundary is near.
const NOW = new Date(2026, 8, 16, 12);

// Lesson 7.4: 70 % of 116 149 less 26 000 of state pension, prices of January 2021, retiring at 60 in 2043.
const PENSION: PensionPlan = {
  birthMonth: '1983-01',
  retirementAge: 60,
  lifeAge: 80,
  monthlyExpensesMinor: 116_149 * RUB,
  replacementRate: 0.7,
  statePensionMinor: 26_000 * RUB,
  costAsOf: '2021-01',
  returnRate: 0.0873,
  inflationRate: 0.069,
  strategy: 'spend-capital',
  goalId: null,
};

const CHILD: EducationPlan = {
  id: 'masha',
  name: 'Маша',
  yearlyCostMinor: 600_000 * RUB,
  years: 6,
  costAsOf: '2021-09',
  startMonth: '2029-09',
  returnRate: 0.0883,
  inflationRate: 0.069,
  goalId: null,
};

beforeEach(async () => {
  await clearAllData();
});

describe('plan: the pension calculator', () => {
  it('retires in the month of the birthday', () => {
    expect(retirementMonthOf(PENSION)).toBe('2043-01');
  });

  it('counts the need in the prices of the year of retiring and both strategies from it', () => {
    const view = pensionView(PENSION, '2026-09', 0);

    expect(view.years).toBe(20);
    expect(view.months).toBe(196);
    expect(Math.round(view.need.gapAtRetirementMinor / RUB)).toBe(240_032);
    expect(view.spendCapitalMinor).toBe(
      pensionCapitalMinor({
        annualSpendingMinor: view.need.annualSpendingMinor,
        returnRate: 0.0873,
        inflationRate: 0.069,
        strategy: { kind: 'spend-capital', years: 20 },
      }),
    );
    expect(view.capitalMinor).toBe(view.spendCapitalMinor);
    expect(view.keepCapitalMinor).toBeGreaterThan(view.spendCapitalMinor);
    expect(view.drawdown).toHaveLength(20);
  });

  it('shows how soon the capital of the course would run out', () => {
    const view = pensionView(PENSION, '2026-09', 0);

    expect(view.courseRunsOutAge).not.toBeNull();
    expect(view.courseRunsOutAge ?? 0).toBeGreaterThan(60);
    expect(view.courseRunsOutAge ?? 0).toBeLessThan(80);
  });

  it('puts aside less when part of the capital is already saved, and nothing after retiring', () => {
    const fromScratch = pensionView(PENSION, '2026-09', 0).contributionMinor ?? 0;
    const withSavings = pensionView(PENSION, '2026-09', 5_000_000 * RUB).contributionMinor ?? 0;

    expect(withSavings).toBeLessThan(fromScratch);
    expect(pensionView(PENSION, '2043-01', 0).contributionMinor).toBeNull();
  });

  it('has no capital to live off when the return does not beat inflation', () => {
    const view = pensionView({ ...PENSION, strategy: 'keep-capital', returnRate: 0.05 }, '2026-09', 0);

    expect(view.keepCapitalMinor).toBeNull();
    expect(view.capitalMinor).toBeNull();
    expect(view.contributionMinor).toBeNull();
    expect(view.drawdown).toEqual([]);
  });
});

describe('plan: the education calculator', () => {
  it('shows the year-by-year capital next to the course sum, and the months until the start', () => {
    const view = educationView(CHILD, '2021-09', 0);

    expect(view.months).toBe(96);
    expect(Math.round(view.capitalMinor)).toBe(Math.round(5_825_523.25 * RUB));
    expect(Math.round(view.courseSumMinor)).toBe(Math.round(6_139_374.73 * RUB));
    expect(Math.round(view.contributionMinor ?? 0)).toBe(Math.round(41_966.08 * RUB));
    expect(Math.round(view.courseContributionMinor ?? 0)).toBe(Math.round(44_227.02 * RUB));
  });

  it('asks for nothing once the studies have begun', () => {
    const view = educationView(CHILD, '2029-09', 0);
    expect(view.contributionMinor).toBeNull();
    expect(view.courseContributionMinor).toBeNull();
  });
});

describe('plan: when to look at it again', () => {
  const plan: FinancialPlan = emptyFinancialPlan('2026-09-16');

  it('says nothing before the quarter is over', () => {
    expect(planReviewReminder(plan, '2026-12-15')).toBeNull();
    expect(planReviewReminder(undefined, '2030-01-01')).toBeNull();
  });

  it('reminds of the quarterly look, and hiding it hides only that one', () => {
    const reminder = planReviewReminder(plan, '2026-12-20');
    expect(reminder).toEqual({ kind: 'quarterly', dueOn: '2026-12-16', key: 'quarterly:2026-12-16' });

    const hidden = { ...plan, reviewReminderDismissed: reminder?.key ?? null };
    expect(planReviewReminder(hidden, '2027-01-10')).toBeNull();

    // After a look in December, the next quarter brings the reminder back.
    const looked = { ...hidden, quarterlyReviewedOn: '2026-12-20' };
    expect(planReviewReminder(looked, '2027-03-20')?.key).toBe('quarterly:2027-03-20');
  });
});

describe('plan: what there is to do', () => {
  it('an empty app still has the deductions to check and the insurance to think about', async () => {
    const data = await loadPlan(NOW);

    expect(data.started).toBe(false);
    expect(data.actions.map((action) => action.key)).toEqual(['insurance', 'deductions']);
  });

  it('names the reserve short of its norm, the goals and a debt dearer than the savings earn', async () => {
    const card = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 50_000 * RUB,
      openingDate: '2026-01-01',
    });
    await createAccount({
      name: 'Кредитка',
      side: 'liability',
      type: 'credit_card',
      openingBalanceMinor: 30_000 * RUB,
      openingDate: '2026-01-01',
      rate: 0.29,
    });
    await createAccount({
      name: 'Ипотека',
      side: 'liability',
      type: 'mortgage',
      openingBalanceMinor: 3_000_000 * RUB,
      openingDate: '2026-01-01',
      rate: 0.06,
    });
    await db.categories.add({
      id: 'food',
      name: 'Еда',
      kind: 'expense',
      group: 'variable',
      sortOrder: 0,
      archived: false,
    });
    await db.transactions.add({
      id: 't1',
      date: '2026-08-10',
      amountMinor: 90_000 * RUB,
      kind: 'expense',
      accountId: card.id,
      categoryId: 'food',
      createdAt: 1,
    });
    await ensureReserveGoal();
    const flat = await createGoal({
      name: 'Квартира',
      kind: 'purchase',
      costMinor: 3_000_000 * RUB,
      targetMonth: '2031-09',
    });

    const data = await loadPlan(NOW);
    const keys = data.actions.map((action) => action.key);

    expect(keys).toEqual([
      'reserve',
      'insurance',
      `account:${flat.id}`,
      `contribution:${flat.id}`,
      expect.stringMatching(/^debt:/),
      'deductions',
    ]);
    const debt = data.actions.find((action) => action.kind === 'debt');
    expect(debt?.kind === 'debt' ? debt.name : null).toBe('Кредитка');
  });

  it('builds the same list from its parts', () => {
    const actions = planActions({
      goals: [],
      reserve: { reserveMinor: 0, months: null, targetMinor: null, norm: null, status: 'unknown' },
      accounts: [],
      policies: [
        {
          id: 'p',
          name: 'Жизнь',
          type: 'life',
          endDate: '2027-01-01',
          archived: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      settings: { defaultReturnRate: 0.1 },
    });
    expect(actions.map((action) => action.key)).toEqual(['deductions']);
  });
});

describe('plan: the whole screen', () => {
  it('reads what the plan saved and keeps the ticks of the actions', async () => {
    await saveEducationPlan({ ...CHILD, startMonth: '2034-09' }, '2026-09-16');
    await savePensionPlan(PENSION, '2026-09-16');
    await setPlanActionDone('deductions', true, '2026-09-16');

    const data = await loadPlan(NOW);

    expect(data.started).toBe(true);
    expect(data.plan.startedOn).toBe('2026-09-16');
    expect(data.education).toHaveLength(1);
    expect(data.education[0].months).toBe(96);
    expect(data.pension?.retirementMonth).toBe('2043-01');
    expect(data.plan.doneActions).toEqual(['deductions']);
    expect(data.review.nextQuarterly).toBe('2026-12-16');
  });

  it('calls a budget with no money left over balanced, and says where the numbers came from', async () => {
    const data = await loadPlan(NOW);

    expect(data.budget.balance).toBe('balanced');
    expect(data.budget.fromFact).toBe(false);
  });
});
