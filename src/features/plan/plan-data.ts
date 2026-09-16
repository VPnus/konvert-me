/**
 * Everything the financial plan shows, in one read. The plan is mostly the rest of the app
 * seen as a whole — the budget, the balance, the reserve and the goals — plus what only the
 * plan keeps: the calculators, the risk profile, the notes and the reviews.
 */

import type { ReviewState } from '@/core/financial-plan';
import { budgetBalance, type BudgetBalance } from '@/core/financial-plan';
import { todayIso, type IsoDate } from '@/core/time';
import { db } from '@/db/db';
import type { FinancialPlan, InsurancePolicy } from '@/db/models';
import { emptyFinancialPlan, getFinancialPlan } from '@/db/repositories/financial-plan';
import { loadGoals, type GoalsData } from '@/features/goals/goals-data';
import { loadOverview, type OverviewData } from '@/features/overview/overview-data';
import { planActions, type PlanAction } from '@/features/plan/actions';
import {
  educationView,
  pensionView,
  type EducationView,
  type PensionView,
} from '@/features/plan/calculations';
import { planReviewState } from '@/features/plan/review';

export interface PlanBudget {
  /** The same month and the same source as the distribution of free money on the goals screen. */
  readonly fromFact: boolean;
  readonly incomeMinor: number;
  readonly expenseMinor: number;
  readonly freeCashMinor: number;
  readonly balance: BudgetBalance;
}

export interface PlanData {
  readonly today: IsoDate;
  readonly overview: OverviewData;
  readonly goals: GoalsData;
  /** What was saved, or an empty plan that is not stored until something changes. */
  readonly plan: FinancialPlan;
  readonly started: boolean;
  /** Policies in force today. */
  readonly policies: InsurancePolicy[];
  readonly budget: PlanBudget;
  readonly education: EducationView[];
  readonly pension: PensionView | null;
  readonly actions: PlanAction[];
  readonly review: ReviewState;
}

export async function loadPlan(now: Date = new Date()): Promise<PlanData> {
  const today = todayIso(now);
  const [overview, goals, stored, policies] = await Promise.all([
    loadOverview(now),
    loadGoals(now),
    getFinancialPlan(),
    db.policies.toArray(),
  ]);

  const plan = stored ?? emptyFinancialPlan(today, now.getTime());
  const month = goals.month;
  const totals = goals.freeCashFromFact ? overview.fact : overview.plan;
  const savedOf = (goalId: string | null) =>
    goalId ? (goals.goals.find((view) => view.goal.id === goalId)?.savedMinor ?? 0) : 0;
  const inForce = policies.filter((policy) => !policy.archived && policy.endDate >= today);

  return {
    today,
    overview,
    goals,
    plan,
    started: stored !== undefined,
    policies: inForce,
    budget: {
      fromFact: goals.freeCashFromFact,
      incomeMinor: totals.incomeMinor,
      expenseMinor: totals.expenseMinor,
      freeCashMinor: goals.freeCashMinor,
      balance: budgetBalance(goals.freeCashMinor),
    },
    education: plan.education.map((item) => educationView(item, month, savedOf(item.goalId))),
    pension: plan.pension ? pensionView(plan.pension, month, savedOf(plan.pension.goalId)) : null,
    actions: planActions({
      goals: goals.goals,
      reserve: goals.reserve,
      // The goals screen keeps only the accounts money can lie on; the debts are in the overview.
      accounts: overview.accounts,
      policies: inForce,
      settings: goals.settings,
    }),
    review: planReviewState(plan, today),
  };
}
