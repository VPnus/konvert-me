import { beforeEach, describe, expect, it } from 'vitest';

import { currentMonth } from '@/core/time';
import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { DEFAULT_CATEGORIES } from '@/db/repositories/categories';
import { DEFAULT_WIDGETS } from '@/db/repositories/dashboard';
import { RESERVE_GOAL_ID } from '@/db/repositories/goals';
import { getSettings } from '@/db/repositories/settings';
import { completeOnboarding, EMPTY_ANSWERS, skipOnboarding } from '@/features/onboarding/complete-onboarding';
import { loadOverview } from '@/features/overview/overview-data';

const RUB = 100;

const ANSWERS = {
  ...EMPTY_ANSWERS,
  incomeRub: 150_000,
  mandatoryRub: 70_000,
  variableRub: 30_000,
  savingsRub: 400_000,
  debtBalanceRub: 300_000,
  debtPaymentRub: 12_000,
  debtPaymentDay: 15,
  goalName: 'Квартира',
  goalCostRub: 4_000_000,
  goalTargetMonth: '2029-09',
};

beforeEach(async () => {
  await clearAllData();
});

describe('onboarding', () => {
  it('turns five answers into a working app', async () => {
    await completeOnboarding(ANSWERS);

    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);

    const plans = await db.budgetPlans.where('month').equals(currentMonth()).toArray();
    expect(plans).toHaveLength(3);
    expect(plans.find((line) => line.categoryId === 'salary')?.amountMinor).toBe(150_000 * RUB);
    expect(plans.find((line) => line.categoryId === 'other-mandatory')?.amountMinor).toBe(70_000 * RUB);
    expect(plans.find((line) => line.categoryId === 'other-variable')?.amountMinor).toBe(30_000 * RUB);

    const accounts = await db.accounts.toArray();
    expect(accounts).toHaveLength(2);
    const savings = accounts.find((account) => account.side === 'asset');
    expect(savings?.openingBalanceMinor).toBe(400_000 * RUB);
    expect(savings?.isLiquid).toBe(true);
    const debt = accounts.find((account) => account.side === 'liability');
    expect(debt?.monthlyPaymentMinor).toBe(12_000 * RUB);
    expect(debt?.paymentDay).toBe(15);

    const goals = await db.goals.toArray();
    expect(goals.map((goal) => goal.id)).toContain(RESERVE_GOAL_ID);
    const flat = goals.find((goal) => goal.name === 'Квартира');
    expect(flat?.costMinor).toBe(4_000_000 * RUB);
    expect(flat?.targetMonth).toBe('2029-09');
    expect(flat?.priority).toBeGreaterThan(0);

    const layout = await db.dashboardLayouts.get('default');
    expect(layout?.items).toHaveLength(DEFAULT_WIDGETS.length);

    expect((await getSettings()).onboardingDone).toBe(true);
  });

  it('skipping still leaves categories, the reserve and a dashboard', async () => {
    await skipOnboarding();

    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
    expect(await db.goals.get(RESERVE_GOAL_ID)).toBeDefined();
    expect((await db.dashboardLayouts.get('default'))?.items.length).toBeGreaterThan(0);
    expect(await db.accounts.count()).toBe(0);
    expect((await getSettings()).onboardingDone).toBe(true);
  });

  it('answers with zeroes create nothing but the basics', async () => {
    await completeOnboarding(EMPTY_ANSWERS);

    expect(await db.budgetPlans.count()).toBe(0);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.goals.count()).toBe(1);
  });
});

describe('the overview right after the onboarding', () => {
  it('answers "how much to put aside and does the budget hold"', async () => {
    await completeOnboarding(ANSWERS);
    const data = await loadOverview();

    // 150 000 − (70 000 + 30 000)
    expect(data.plan.freeCashMinor).toBe(50_000 * RUB);
    // no operations yet, so the fact is empty
    expect(data.fact.freeCashMinor).toBe(0);

    // the average expense falls back to the plan of the current month
    expect(data.averageExpenses.source).toBe('plan');
    expect(data.averageExpenses.valueMinor).toBe(100_000 * RUB);

    // 400 000 of liquid savings, no envelopes yet
    expect(data.reserve.reserveMinor).toBe(400_000 * RUB);
    expect(data.reserve.months).toBeCloseTo(4, 5);
    expect(data.reserve.status).toBe('partial');

    // 400 000 − 300 000
    expect(data.netWorthMinor).toBe(100_000 * RUB);

    // 12 000 / 150 000 = 8 %
    expect(data.debtBurden.ratio).toBeCloseTo(0.08, 5);
    expect(data.debtBurden.status).toBe('normal');

    const flat = data.goals.find((view) => view.goal.name === 'Квартира');
    expect(flat?.plan?.status).toBe('active');
    expect(flat?.plan?.contributionMinor).toBeGreaterThan(0);

    const reserve = data.goals.find((view) => view.goal.kind === 'reserve');
    expect(reserve?.savedMinor).toBe(400_000 * RUB);
    expect(reserve?.goal.costMinor).toBe(600_000 * RUB);
  });

  it('warns about a reserve below three months and a tense debt burden', async () => {
    await completeOnboarding({
      ...ANSWERS,
      savingsRub: 100_000,
      debtPaymentRub: 60_000,
    });

    const data = await loadOverview();
    const ids = data.warnings.map((warning) => warning.id);

    expect(ids).toContain('reserve-low');
    expect(ids).toContain('debt');
    expect(data.debtBurden.status).toBe('tense');
  });
});
