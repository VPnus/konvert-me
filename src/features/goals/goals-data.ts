/**
 * Everything the goals screen shows, in one read. The screen never does money
 * arithmetic of its own: every number below comes from src/core.
 */

import {
  averageMonthlyExpenses,
  liquidAssetsMinor,
  liquidEnvelopesMinor,
  principalDueMinor,
  reserveContributionMinor,
  reserveState,
  type ReserveState,
} from '@/core/balance';
import { budgetBasis, categoryExpenseAverageMinor, planTotals, type BudgetBasis } from '@/core/budget';
import {
  allocateFreeCash,
  contributionPlan,
  realReturnRate,
  savingsByGoalMinor,
  returnBeatsInflation,
  type Allocation,
  type ContributionPlan,
} from '@/core/goals';
import { currentMonth, type IsoMonth } from '@/core/time';
import type { CoreAccount, CoreCategory } from '@/core/types';
import { db } from '@/db/db';
import { DEFAULT_SETTINGS, type Account, type AppSettings, type Envelope, type Goal } from '@/db/models';
import { getAccountBalancesMinor, holdsMoney } from '@/db/repositories/accounts';
import { LOAN_INTEREST_CATEGORY } from '@/db/repositories/categories';
import { listGoals, RESERVE_GOAL_ID } from '@/db/repositories/goals';

export interface GoalView {
  readonly goal: Goal;
  /** Sum of the envelopes of this goal — the S of formulas 4 and 5. */
  readonly savedMinor: number;
  /** The reserve has no stored cost: it is derived from the average expenses. */
  readonly costMinor: number;
  readonly plan: ContributionPlan | null;
  readonly realReturnRate: number;
  readonly beatsInflation: boolean;
  readonly envelopes: Envelope[];
  readonly progress: number;
}

export interface GoalsData {
  readonly month: IsoMonth;
  readonly settings: AppSettings;
  readonly goals: GoalView[];
  readonly accounts: Account[];
  readonly balances: Map<string, number>;
  readonly reserve: ReserveState;
  /** A usual month: the average of complete months, the plan, or the month in progress. */
  readonly basis: BudgetBasis;
  /** Income minus expenses of that month — formula 7. */
  readonly freeCashMinor: number;
  /** The scheduled debt payments less the interest among the expenses. */
  readonly principalDueMinor: number;
  /** What formula 8 hands out: the free money less the principal due. */
  readonly availableMinor: number;
  /** The reserve first, while it is short of its target; then the goals by priority. */
  readonly allocations: Allocation[];
  readonly leftoverMinor: number;
  readonly totalDeficitMinor: number;
}

function toCoreAccount(account: Account): CoreAccount {
  return {
    id: account.id,
    side: account.side,
    isLiquid: account.isLiquid,
    openingBalanceMinor: account.openingBalanceMinor,
    openingDate: account.openingDate,
    archived: account.archived,
    monthlyPaymentMinor: account.monthlyPaymentMinor,
    minPaymentRate: account.minPaymentRate,
  };
}

export async function loadGoals(now: Date = new Date()): Promise<GoalsData> {
  const month = currentMonth(now);

  const [settingsRow, goals, accounts, envelopes, transactions, plans, categories, balances] =
    await Promise.all([
      db.settings.get('app'),
      listGoals({ includeDone: true }),
      db.accounts.toArray(),
      db.envelopes.toArray(),
      db.transactions.toArray(),
      db.budgetPlans.where('month').equals(month).toArray(),
      db.categories.toArray(),
      getAccountBalancesMinor(),
    ]);

  const settings = settingsRow ?? DEFAULT_SETTINGS;
  const coreAccounts = accounts.map(toCoreAccount);
  const coreCategories: CoreCategory[] = categories.map((category) => ({
    id: category.id,
    kind: category.kind,
    group: category.group,
  }));

  const plan = planTotals(plans, month, coreCategories);
  const basis = budgetBasis({ transactions, currentMonth: month, plan });

  const savedByGoal = savingsByGoalMinor(
    envelopes,
    new Set(accounts.filter(holdsMoney).map((account) => account.id)),
  );
  // every envelope stays in sight, one on a thing too: it counts for nothing, and can be emptied
  const envelopesByGoal = new Map<string, Envelope[]>();
  for (const envelope of envelopes) {
    envelopesByGoal.set(envelope.goalId, [...(envelopesByGoal.get(envelope.goalId) ?? []), envelope]);
  }

  const reserve = reserveState({
    liquidMinor: liquidAssetsMinor(coreAccounts, transactions),
    otherGoalsEnvelopesMinor: liquidEnvelopesMinor(envelopes, coreAccounts, RESERVE_GOAL_ID),
    averageExpenses: averageMonthlyExpenses({
      transactions,
      currentMonth: month,
      planExpenseMinor: plan.expenseMinor,
    }),
    targetMonths: settings.reserveTargetMonths,
  });

  const views: GoalView[] = goals.map((goal) => {
    const isReserve = goal.kind === 'reserve';
    const savedMinor = isReserve ? reserve.reserveMinor : (savedByGoal.get(goal.id) ?? 0);
    const costMinor = isReserve ? (reserve.targetMinor ?? 0) : goal.costMinor;

    // The reserve has no date, so it has no contribution schedule of its own.
    const plannable = !isReserve && Boolean(goal.targetMonth) && goal.status === 'active';
    const contribution = plannable
      ? contributionPlan(
          {
            costMinor: goal.costMinor,
            costAsOf: goal.costAsOf,
            targetMonth: goal.targetMonth as IsoMonth,
            returnRate: goal.returnRate,
            inflationRate: goal.inflationRate,
          },
          { currentMonth: month, savedMinor },
        )
      : null;

    return {
      goal,
      savedMinor,
      costMinor,
      plan: contribution,
      realReturnRate: realReturnRate(goal.returnRate, goal.inflationRate),
      beatsInflation: returnBeatsInflation(goal.returnRate, goal.inflationRate),
      envelopes: envelopesByGoal.get(goal.id) ?? [],
      progress: costMinor > 0 ? Math.min(savedMinor / costMinor, 1) : 0,
    };
  });

  // Formula 8: the free money of a usual month, less the principal the debts take by
  // schedule, goes first to the reserve while it is short and then to the goals by priority.
  const interestMinor =
    basis.source === 'plan'
      ? plans
          .filter((line) => line.categoryId === LOAN_INTEREST_CATEGORY)
          .reduce((total, line) => total + line.amountMinor, 0)
      : categoryExpenseAverageMinor(transactions, basis.months, LOAN_INTEREST_CATEGORY);
  const principalMinor = principalDueMinor(coreAccounts, transactions, interestMinor);
  const availableMinor = basis.freeCashMinor - principalMinor;

  const reserveRequestMinor = reserveContributionMinor(reserve, basis.incomeMinor);
  const requests = [
    // Below every goal, whatever their priorities: the reserve is the foundation of the plan.
    ...(reserveRequestMinor > 0
      ? [{ goalId: RESERVE_GOAL_ID, priority: Number.NEGATIVE_INFINITY, requiredMinor: reserveRequestMinor }]
      : []),
    ...views
      .filter((view) => view.plan?.status === 'active' && view.goal.status === 'active')
      .map((view) => ({
        goalId: view.goal.id,
        priority: view.goal.priority,
        requiredMinor: view.plan?.contributionMinor ?? 0,
      })),
  ];

  const allocation = allocateFreeCash(requests, availableMinor);

  return {
    month,
    settings,
    goals: views,
    accounts: accounts.filter((account) => !account.archived && account.side === 'asset'),
    balances,
    reserve,
    basis,
    freeCashMinor: basis.freeCashMinor,
    principalDueMinor: principalMinor,
    availableMinor,
    allocations: allocation.allocations,
    leftoverMinor: allocation.leftoverMinor,
    totalDeficitMinor: allocation.totalDeficitMinor,
  };
}
