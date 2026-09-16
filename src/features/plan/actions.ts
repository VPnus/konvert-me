/**
 * Step 7 of lesson 2.7, carrying the plan out: what there is to do, read from the rest of
 * the plan. Each action has a stable key, so its tick survives the list being built again.
 */

import type { Account, AppSettings, InsurancePolicy } from '@/db/models';
import { holdsMoney } from '@/db/repositories/accounts';
import { RESERVE_GOAL_ID } from '@/db/repositories/goals';
import type { GoalView } from '@/features/goals/goals-data';
import type { ReserveState } from '@/core/balance';

export type PlanAction =
  | { readonly key: string; readonly kind: 'reserve'; readonly amountMinor: number; readonly to: string }
  | {
      readonly key: string;
      readonly kind: 'contribution';
      readonly name: string;
      readonly amountMinor: number;
      readonly to: string;
    }
  | { readonly key: string; readonly kind: 'account'; readonly name: string; readonly to: string }
  | { readonly key: string; readonly kind: 'insurance'; readonly to: string }
  | {
      readonly key: string;
      readonly kind: 'debt';
      readonly name: string;
      readonly rate: number;
      readonly to: string;
    }
  | { readonly key: string; readonly kind: 'deductions'; readonly to: string };

export interface PlanActionsParams {
  readonly goals: readonly GoalView[];
  readonly reserve: ReserveState;
  readonly accounts: readonly Account[];
  readonly policies: readonly InsurancePolicy[];
  readonly settings: Pick<AppSettings, 'defaultReturnRate'>;
}

export function planActions({
  goals,
  reserve,
  accounts,
  policies,
  settings,
}: PlanActionsParams): PlanAction[] {
  const actions: PlanAction[] = [];

  // Protection first: the reserve is the foundation of the plan (lesson 2.7, step 4).
  if (reserve.targetMinor !== null && reserve.status !== 'done') {
    actions.push({
      key: 'reserve',
      kind: 'reserve',
      amountMinor: Math.max(reserve.targetMinor - reserve.reserveMinor, 0),
      to: '/goals',
    });
  }

  if (!policies.some((policy) => policy.type === 'life' || policy.type === 'health')) {
    actions.push({ key: 'insurance', kind: 'insurance', to: '/balance' });
  }

  const money = new Set(accounts.filter(holdsMoney).map((account) => account.id));
  for (const view of goals) {
    if (view.goal.id === RESERVE_GOAL_ID || view.goal.status !== 'active') continue;
    // an envelope on a home or a car is no account chosen for the money of the goal
    if (!view.envelopes.some((envelope) => money.has(envelope.accountId))) {
      actions.push({ key: `account:${view.goal.id}`, kind: 'account', name: view.goal.name, to: '/goals' });
    }
    if (view.plan?.status === 'active' && view.plan.contributionMinor > 0) {
      actions.push({
        key: `contribution:${view.goal.id}`,
        kind: 'contribution',
        name: view.goal.name,
        amountMinor: view.plan.contributionMinor,
        to: '/goals',
      });
    }
  }

  // A debt dearer than what the savings are expected to earn is cheaper to repay first.
  for (const account of accounts) {
    if (account.side !== 'liability' || account.archived) continue;
    if (account.rate === undefined || account.rate <= settings.defaultReturnRate) continue;
    actions.push({
      key: `debt:${account.id}`,
      kind: 'debt',
      name: account.name,
      rate: account.rate,
      to: '/balance',
    });
  }

  actions.push({ key: 'deductions', kind: 'deductions', to: '/deductions' });
  return actions;
}
