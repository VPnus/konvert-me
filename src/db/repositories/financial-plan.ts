/**
 * The financial plan (stage 8). One row: most of the plan is read from the budget, the
 * balance and the goals; this is only what the plan adds — the calculations of education
 * and retirement, the risk profile, the notes, the actions done and the reviews.
 *
 * Every change reads the row and writes it back in one transaction, so two quick changes
 * never lose one another. The first change starts the plan on that day.
 */

import type { RiskProfile } from '@/core/portfolio';
import type { ReviewKind } from '@/core/financial-plan';
import { todayIso, type IsoDate } from '@/core/time';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import {
  financialPlanSchema,
  type EducationPlan,
  type FinancialPlan,
  type Goal,
  type PensionPlan,
} from '@/db/models';
import { createGoal, updateGoal, type GoalInput } from '@/db/repositories/goals';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export const FINANCIAL_PLAN_ID = 'plan';

export type PlanNoteName = keyof FinancialPlan['notes'];

export function emptyFinancialPlan(today: IsoDate, now: number = Date.now()): FinancialPlan {
  return {
    id: FINANCIAL_PLAN_ID,
    startedOn: today,
    riskProfile: null,
    education: [],
    pension: null,
    notes: { mechanisms: '', protection: '', optimization: '' },
    doneActions: [],
    quarterlyReviewedOn: null,
    yearlyReviewedOn: null,
    reviewReminderDismissed: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getFinancialPlan(): Promise<FinancialPlan | undefined> {
  return db.financialPlans.get(FINANCIAL_PLAN_ID);
}

type PlanChange = Partial<Omit<FinancialPlan, 'id' | 'startedOn' | 'createdAt' | 'updatedAt'>>;

async function changePlan(
  change: (plan: FinancialPlan) => PlanChange,
  today: IsoDate,
): Promise<FinancialPlan> {
  const saved = await db.transaction('rw', db.financialPlans, async () => {
    const current = (await db.financialPlans.get(FINANCIAL_PLAN_ID)) ?? emptyFinancialPlan(today);
    const next = parseOrThrow(
      financialPlanSchema,
      { ...current, ...change(current), id: FINANCIAL_PLAN_ID, updatedAt: Date.now() },
      'Финансовый план',
    );
    await db.financialPlans.put(next);
    return next;
  });
  publishAppEvent({ type: 'data-changed' });
  return saved;
}

export type EducationPlanInput = Omit<EducationPlan, 'id' | 'goalId'> & { id?: string };

/** Adds the education of a child, or replaces the one with the same id; the goal it was saved as stays linked. */
export async function saveEducationPlan(
  input: EducationPlanInput,
  today: IsoDate = todayIso(),
): Promise<EducationPlan> {
  const id = input.id ?? crypto.randomUUID();
  const plan = await changePlan((current) => {
    const existing = current.education.find((item) => item.id === id);
    const item = { ...input, id, goalId: existing?.goalId ?? null };
    return {
      education: existing
        ? current.education.map((other) => (other.id === id ? item : other))
        : [...current.education, item],
    };
  }, today);
  return plan.education.find((item) => item.id === id) as EducationPlan;
}

/** The calculation goes; a goal saved from it stays on the goals screen. */
export async function removeEducationPlan(id: string, today: IsoDate = todayIso()): Promise<void> {
  await changePlan((current) => ({ education: current.education.filter((item) => item.id !== id) }), today);
}

export type PensionPlanInput = Omit<PensionPlan, 'goalId'>;

export async function savePensionPlan(
  input: PensionPlanInput,
  today: IsoDate = todayIso(),
): Promise<PensionPlan> {
  const plan = await changePlan(
    (current) => ({ pension: { ...input, goalId: current.pension?.goalId ?? null } }),
    today,
  );
  return plan.pension as PensionPlan;
}

export async function setRiskProfile(
  profile: RiskProfile,
  today: IsoDate = todayIso(),
): Promise<FinancialPlan> {
  return changePlan(() => ({ riskProfile: profile }), today);
}

export async function savePlanNote(
  name: PlanNoteName,
  text: string,
  today: IsoDate = todayIso(),
): Promise<FinancialPlan> {
  return changePlan((current) => ({ notes: { ...current.notes, [name]: text } }), today);
}

export async function setPlanActionDone(
  key: string,
  done: boolean,
  today: IsoDate = todayIso(),
): Promise<FinancialPlan> {
  return changePlan((current) => {
    const keys = new Set(current.doneActions);
    if (done) keys.add(key);
    else keys.delete(key);
    return { doneActions: [...keys].sort() };
  }, today);
}

/** A look at the plan is done today. A yearly look is the quarterly one as well. */
export async function markPlanReviewed(
  kind: ReviewKind,
  today: IsoDate = todayIso(),
): Promise<FinancialPlan> {
  return changePlan(
    () =>
      kind === 'yearly'
        ? { yearlyReviewedOn: today, quarterlyReviewedOn: today }
        : { quarterlyReviewedOn: today },
    today,
  );
}

export async function dismissReviewReminder(
  key: string,
  today: IsoDate = todayIso(),
): Promise<FinancialPlan> {
  return changePlan(() => ({ reviewReminderDismissed: key }), today);
}

type CalculationGoal = Pick<
  GoalInput,
  'name' | 'costMinor' | 'costAsOf' | 'targetMonth' | 'returnRate' | 'inflationRate'
>;

/**
 * A calculation saved as a goal: the first time a goal is created, later the same goal is
 * brought up to date. A goal deleted on the goals screen is created again.
 */
async function saveGoalOf(
  goalId: string | null,
  kind: 'education' | 'pension',
  input: CalculationGoal,
): Promise<Goal> {
  const existing = goalId ? await db.goals.get(goalId) : undefined;
  return existing ? updateGoal(existing.id, input) : createGoal({ ...input, kind });
}

export async function saveEducationAsGoal(
  educationId: string,
  input: CalculationGoal,
  today: IsoDate = todayIso(),
): Promise<Goal> {
  return db.transaction('rw', [db.financialPlans, db.goals, db.settings], async () => {
    const plan = await getFinancialPlan();
    const item = plan?.education.find((education) => education.id === educationId);
    if (!item) throw new RepositoryError('Расчёт образования не найден');

    const goal = await saveGoalOf(item.goalId, 'education', input);
    await changePlan(
      (current) => ({
        education: current.education.map((education) =>
          education.id === educationId ? { ...education, goalId: goal.id } : education,
        ),
      }),
      today,
    );
    return goal;
  });
}

export async function savePensionAsGoal(input: CalculationGoal, today: IsoDate = todayIso()): Promise<Goal> {
  return db.transaction('rw', [db.financialPlans, db.goals, db.settings], async () => {
    const plan = await getFinancialPlan();
    if (!plan?.pension) throw new RepositoryError('Расчёт пенсии не сохранён');

    const goal = await saveGoalOf(plan.pension.goalId, 'pension', input);
    await changePlan(
      (current) => ({ pension: current.pension ? { ...current.pension, goalId: goal.id } : null }),
      today,
    );
    return goal;
  });
}
