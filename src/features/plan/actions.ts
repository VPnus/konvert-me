/**
 * Step 7 of lesson 2.7, carrying the plan out: what there is to do, read from the rest of
 * the plan. Each action has a stable key, so its tick survives the list being built again.
 */

import type { ReserveState } from '@/core/balance';
import type { CardGrace } from '@/core/credit-card';
import type { IsoDate } from '@/core/time';
import type { Account, AppSettings, InsurancePolicy } from '@/db/models';
import { holdsMoney } from '@/db/repositories/accounts';
import { RESERVE_GOAL_ID } from '@/db/repositories/goals';
import type { GoalView } from '@/features/goals/goals-data';
import { debtQueue, savingsBenchmark } from '@/features/plan/debts';

export type PlanAction =
  | {
      readonly key: string;
      readonly kind: 'statement';
      readonly name: string;
      readonly amountMinor: number;
      readonly dueDate: IsoDate;
      readonly to: string;
    }
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
  readonly balances?: ReadonlyMap<string, number>;
  readonly cards?: ReadonlyMap<string, CardGrace>;
  /** Formula 8: the free money of a usual month less the principal due; below zero nothing is left for goals. */
  readonly availableMinor?: number;
}

export function planActions({
  goals,
  reserve,
  accounts,
  policies,
  settings,
  balances = new Map(),
  cards = new Map(),
  availableMinor = 0,
}: PlanActionsParams): PlanAction[] {
  const actions: PlanAction[] = [];
  const debts = debtQueue({
    accounts,
    balances,
    cards,
    benchmark: savingsBenchmark(accounts, balances, settings.defaultReturnRate),
  });

  // A statement due costs nothing paid in full and a lot otherwise: nothing is more urgent.
  for (const debt of debts) {
    if (!debt.statement) continue;
    actions.push({
      key: `statement:${debt.account.id}:${debt.statement.dueDate}`,
      kind: 'statement',
      name: debt.account.name,
      amountMinor: debt.statement.remainingMinor,
      dueDate: debt.statement.dueDate,
      to: '/budget',
    });
  }

  // Protection next: the reserve is the foundation of the plan (lesson 2.7, step 4).
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

  // A debt dearer than what the savings really earn is cheaper to repay first, the dearest first.
  const dear = debts.filter((debt) => debt.dear);
  for (const debt of dear) {
    actions.push({
      key: `debt:${debt.account.id}`,
      kind: 'debt',
      name: debt.account.name,
      rate: debt.account.rate ?? 0,
      to: '/balance',
    });
  }

  // Saving for a goal is no step while the debts take more than is free, or cost more than savings earn.
  const saving = availableMinor >= 0 && dear.length === 0;
  const money = new Set(accounts.filter(holdsMoney).map((account) => account.id));
  for (const view of goals) {
    if (view.goal.id === RESERVE_GOAL_ID || view.goal.status !== 'active') continue;
    // an envelope on a home or a car is no account chosen for the money of the goal
    if (!view.envelopes.some((envelope) => money.has(envelope.accountId))) {
      actions.push({ key: `account:${view.goal.id}`, kind: 'account', name: view.goal.name, to: '/goals' });
    }
    if (saving && view.plan?.status === 'active' && view.plan.contributionMinor > 0) {
      actions.push({
        key: `contribution:${view.goal.id}`,
        kind: 'contribution',
        name: view.goal.name,
        amountMinor: view.plan.contributionMinor,
        to: '/goals',
      });
    }
  }

  actions.push({ key: 'deductions', kind: 'deductions', to: '/deductions' });
  return actions;
}
