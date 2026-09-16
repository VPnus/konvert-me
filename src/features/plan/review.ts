/**
 * The reminder of step 8 of lesson 2.7: a look at the plan once a quarter and once a year.
 */

import { reviewState, type ReviewKind, type ReviewState } from '@/core/financial-plan';
import type { IsoDate } from '@/core/time';
import type { FinancialPlan } from '@/db/models';

export function planReviewState(plan: FinancialPlan, today: IsoDate): ReviewState {
  return reviewState({
    startedOn: plan.startedOn,
    quarterlyReviewedOn: plan.quarterlyReviewedOn,
    yearlyReviewedOn: plan.yearlyReviewedOn,
    today,
  });
}

export interface PlanReviewReminder {
  readonly kind: ReviewKind;
  readonly dueOn: IsoDate;
  /** Hiding the reminder hides this one review; the next one comes back. */
  readonly key: string;
}

export function planReviewReminder(
  plan: FinancialPlan | undefined,
  today: IsoDate,
): PlanReviewReminder | null {
  if (!plan) return null;
  const state = planReviewState(plan, today);
  if (!state.due) return null;

  const dueOn = state.due === 'yearly' ? state.nextYearly : state.nextQuarterly;
  const key = `${state.due}:${dueOn}`;
  if (plan.reviewReminderDismissed === key) return null;
  return { kind: state.due, dueOn, key };
}
