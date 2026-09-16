import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import {
  getFinancialPlan,
  markPlanReviewed,
  removeEducationPlan,
  saveEducationAsGoal,
  saveEducationPlan,
  savePensionAsGoal,
  savePensionPlan,
  savePlanNote,
  setPlanActionDone,
  setRiskProfile,
  type EducationPlanInput,
  type PensionPlanInput,
} from '@/db/repositories/financial-plan';
import { deleteGoal, listGoals } from '@/db/repositories/goals';

const RUB = 100;

const CHILD: EducationPlanInput = {
  name: 'Маша',
  yearlyCostMinor: 600_000 * RUB,
  years: 6,
  costAsOf: '2026-09',
  startMonth: '2034-09',
  returnRate: 0.0883,
  inflationRate: 0.069,
};

const PENSION: PensionPlanInput = {
  birthMonth: '1986-03',
  retirementAge: 60,
  lifeAge: 80,
  monthlyExpensesMinor: 116_149 * RUB,
  replacementRate: 0.7,
  statePensionMinor: 26_000 * RUB,
  costAsOf: '2026-09',
  returnRate: 0.0873,
  inflationRate: 0.069,
  strategy: 'spend-capital',
};

beforeEach(async () => {
  await clearAllData();
});

describe('financial plan: storage', () => {
  it('there is no plan until something is saved, and the first change starts it that day', async () => {
    expect(await getFinancialPlan()).toBeUndefined();

    await setRiskProfile('moderate', '2026-09-16');
    await setRiskProfile('conservative', '2026-10-01');

    const plan = await getFinancialPlan();
    expect(plan?.startedOn).toBe('2026-09-16');
    expect(plan?.riskProfile).toBe('conservative');
  });

  it('adds the education of a child, replaces it by its id and removes it', async () => {
    const saved = await saveEducationPlan(CHILD);
    await saveEducationPlan({ ...CHILD, name: 'Петя', startMonth: '2036-09' });
    await saveEducationPlan({ ...CHILD, id: saved.id, years: 4 });

    let plan = await getFinancialPlan();
    expect(plan?.education.map((item) => [item.name, item.years])).toEqual([
      ['Маша', 4],
      ['Петя', 6],
    ]);

    await removeEducationPlan(saved.id);
    plan = await getFinancialPlan();
    expect(plan?.education.map((item) => item.name)).toEqual(['Петя']);
  });

  it('refuses a pension that ends before it starts', async () => {
    await expect(savePensionPlan({ ...PENSION, lifeAge: 60 })).rejects.toBeInstanceOf(ValidationError);
    expect(await getFinancialPlan()).toBeUndefined();
  });

  it('keeps both of two actions ticked at the same time', async () => {
    await Promise.all([setPlanActionDone('open-account', true), setPlanActionDone('reserve', true)]);
    await setPlanActionDone('insurance', true);
    await setPlanActionDone('insurance', false);

    expect((await getFinancialPlan())?.doneActions).toEqual(['open-account', 'reserve']);
  });

  it('keeps the notes of the steps apart', async () => {
    await savePlanNote('mechanisms', 'Квартиру — в ипотеку');
    await savePlanNote('protection', 'Застраховать жизнь');

    expect((await getFinancialPlan())?.notes).toEqual({
      mechanisms: 'Квартиру — в ипотеку',
      protection: 'Застраховать жизнь',
      optimization: '',
    });
  });

  it('a yearly look is the quarterly one as well', async () => {
    await markPlanReviewed('quarterly', '2026-12-20');
    let plan = await getFinancialPlan();
    expect([plan?.quarterlyReviewedOn, plan?.yearlyReviewedOn]).toEqual(['2026-12-20', null]);

    await markPlanReviewed('yearly', '2027-09-16');
    plan = await getFinancialPlan();
    expect([plan?.quarterlyReviewedOn, plan?.yearlyReviewedOn]).toEqual(['2027-09-16', '2027-09-16']);
  });
});

describe('financial plan: a calculation saved as a goal', () => {
  const goalOf = (costRubles: number) => ({
    name: 'Образование Маши',
    costMinor: costRubles * RUB,
    costAsOf: '2034-09',
    targetMonth: '2034-09',
    returnRate: 0.0883,
    inflationRate: 0.069,
  });

  it('creates the goal once and brings the same goal up to date afterwards', async () => {
    const child = await saveEducationPlan(CHILD);

    const first = await saveEducationAsGoal(child.id, goalOf(5_000_000));
    const second = await saveEducationAsGoal(child.id, goalOf(5_500_000));

    expect(second.id).toBe(first.id);
    const goals = (await listGoals()).filter((goal) => goal.kind === 'education');
    expect(goals).toHaveLength(1);
    expect(goals[0].costMinor).toBe(5_500_000 * RUB);
    expect((await getFinancialPlan())?.education[0].goalId).toBe(first.id);
  });

  it('keeps the link when the calculation is saved again', async () => {
    const child = await saveEducationPlan(CHILD);
    const goal = await saveEducationAsGoal(child.id, goalOf(5_000_000));

    await saveEducationPlan({ ...CHILD, id: child.id, years: 5 });

    expect((await getFinancialPlan())?.education[0].goalId).toBe(goal.id);
  });

  it('creates the goal again when it was deleted on the goals screen', async () => {
    const child = await saveEducationPlan(CHILD);
    const first = await saveEducationAsGoal(child.id, goalOf(5_000_000));
    await deleteGoal(first.id);

    const again = await saveEducationAsGoal(child.id, goalOf(5_000_000));

    expect(again.id).not.toBe(first.id);
    expect(await db.goals.get(again.id)).toBeDefined();
  });

  it('saves the pension as a goal of its own kind', async () => {
    await savePensionPlan(PENSION);
    const goal = await savePensionAsGoal({ ...goalOf(49_000_000), name: 'Пенсия', targetMonth: '2046-03' });

    expect(goal.kind).toBe('pension');
    expect((await getFinancialPlan())?.pension?.goalId).toBe(goal.id);
  });

  it('refuses to save a calculation that is not there', async () => {
    await expect(saveEducationAsGoal('nobody', goalOf(1))).rejects.toBeInstanceOf(RepositoryError);
    await expect(savePensionAsGoal(goalOf(1))).rejects.toBeInstanceOf(RepositoryError);
    expect(await listGoals()).toEqual([]);
  });
});
