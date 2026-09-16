/**
 * Everything the dashboard shows, computed by src/core from the repositories.
 * One read for the whole screen: widgets never query the database themselves.
 */

import {
  averageMonthlyExpenses,
  debtBurden,
  liquidAssetsMinor,
  monthlyDebtPaymentsMinor,
  netWorthMinor,
  reserveState,
  totalAssetsMinor,
  totalLiabilitiesMinor,
  type AverageExpenses,
  type DebtBurden,
  type ReserveState,
} from '@/core/balance';
import { monthTotals, planTotals, type MonthTotals } from '@/core/budget';
import { upcomingEvents, type UpcomingEvent } from '@/core/upcoming';
import { contributionPlan, returnBeatsInflation, type ContributionPlan } from '@/core/goals';
import { currentMonth, todayIso, type IsoMonth } from '@/core/time';
import type { CoreAccount, CoreCategory, CoreTransaction } from '@/core/types';
import { db } from '@/db/db';
import type { Account, AppSettings, Goal } from '@/db/models';
import { DEFAULT_SETTINGS } from '@/db/models';
import { getAccountBalancesMinor } from '@/db/repositories/accounts';
import { getSavingsByGoal, RESERVE_GOAL_ID } from '@/db/repositories/goals';
import { ru } from '@/i18n/ru';

export interface GoalView {
  readonly goal: Goal;
  readonly savedMinor: number;
  readonly plan: ContributionPlan | null;
  readonly beatsInflation: boolean;
}

export interface OverviewData {
  readonly month: IsoMonth;
  readonly settings: AppSettings;
  readonly accounts: Account[];
  readonly balances: Map<string, number>;
  readonly fact: MonthTotals;
  readonly plan: MonthTotals;
  readonly averageExpenses: AverageExpenses;
  readonly reserve: ReserveState;
  readonly netWorthMinor: number;
  readonly assetsMinor: number;
  readonly liabilitiesMinor: number;
  readonly debtBurden: DebtBurden;
  readonly hasDebts: boolean;
  readonly goals: GoalView[];
  readonly hasPlan: boolean;
  readonly hasTransactions: boolean;
  readonly warnings: Warning[];
  /** The dates that are about to matter — the "soon" feed of stage 6. */
  readonly upcoming: UpcomingEvent[];
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
  };
}

export async function loadOverview(now: Date = new Date()): Promise<OverviewData> {
  const month = currentMonth(now);

  const [settingsRow, accounts, transactions, plans, categories, goals, savingsByGoal, balances, policies] =
    await Promise.all([
      db.settings.get('app'),
      db.accounts.toArray(),
      db.transactions.toArray(),
      db.budgetPlans.where('month').equals(month).toArray(),
      db.categories.toArray(),
      db.goals.toArray(),
      getSavingsByGoal(),
      getAccountBalancesMinor(),
      db.policies.toArray(),
    ]);

  const settings = settingsRow ?? DEFAULT_SETTINGS;
  const coreAccounts = accounts.map(toCoreAccount);
  const coreTransactions: CoreTransaction[] = transactions;
  const coreCategories: CoreCategory[] = categories.map((category) => ({
    id: category.id,
    kind: category.kind,
    group: category.group,
  }));

  const fact = monthTotals(coreTransactions, month);
  const plan = planTotals(plans, month, coreCategories);

  const averageExpenses = averageMonthlyExpenses({
    transactions: coreTransactions,
    currentMonth: month,
    planExpenseMinor: plan.expenseMinor,
  });

  const otherGoalsEnvelopesMinor = [...savingsByGoal.entries()]
    .filter(([goalId]) => goalId !== RESERVE_GOAL_ID)
    .reduce((total, [, amount]) => total + amount, 0);

  const reserve = reserveState({
    liquidMinor: liquidAssetsMinor(coreAccounts, coreTransactions),
    otherGoalsEnvelopesMinor,
    averageExpenses,
    targetMonths: settings.reserveTargetMonths,
  });

  const incomeForBurden = fact.incomeMinor > 0 ? fact.incomeMinor : plan.incomeMinor;
  const monthlyPayments = monthlyDebtPaymentsMinor(coreAccounts);

  const goalViews: GoalView[] = goals
    .filter((goal) => goal.status !== 'done')
    .sort((a, b) => a.priority - b.priority)
    .map((goal) => {
      const savedMinor = goal.kind === 'reserve' ? reserve.reserveMinor : (savingsByGoal.get(goal.id) ?? 0);

      const costMinor = goal.kind === 'reserve' ? (reserve.targetMinor ?? 0) : goal.costMinor;
      const plannable = goal.kind !== 'reserve' && Boolean(goal.targetMonth) && goal.status === 'active';

      return {
        goal: goal.kind === 'reserve' ? { ...goal, costMinor } : goal,
        savedMinor,
        plan: plannable
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
          : null,
        beatsInflation: returnBeatsInflation(goal.returnRate, goal.inflationRate),
      };
    });

  const data: Omit<OverviewData, 'warnings'> = {
    month,
    settings,
    accounts,
    balances,
    fact,
    plan,
    averageExpenses,
    reserve,
    netWorthMinor: netWorthMinor(coreAccounts, coreTransactions),
    assetsMinor: totalAssetsMinor(coreAccounts, coreTransactions),
    liabilitiesMinor: totalLiabilitiesMinor(coreAccounts, coreTransactions),
    debtBurden: debtBurden(monthlyPayments, incomeForBurden),
    hasDebts: accounts.some((account) => account.side === 'liability' && !account.archived),
    upcoming: upcomingEvents({
      today: todayIso(now),
      accounts,
      policies: policies.map((policy) => ({
        id: policy.id,
        name: policy.name,
        endDate: policy.endDate,
        premiumMinor: policy.premiumMinor,
        archived: policy.archived,
      })),
    }),
    goals: goalViews,
    hasPlan: plans.length > 0,
    hasTransactions: transactions.length > 0,
  };

  return { ...data, warnings: collectWarnings(data, ru.widgets.warnings) };
}

export interface Warning {
  readonly id: string;
  readonly text: string;
  readonly to?: string;
}

/** The "Предупреждения" widget: what is worth fixing right now. */
export function collectWarnings(data: Omit<OverviewData, 'warnings'>, texts: WarningTexts): Warning[] {
  const warnings: Warning[] = [];

  if (data.accounts.length > 0 && data.netWorthMinor < 0) {
    warnings.push({ id: 'net-worth', text: texts.negativeNetWorth, to: '/balance' });
  }
  if (data.debtBurden.status === 'tense') {
    warnings.push({ id: 'debt', text: texts.debtTense, to: '/balance' });
  }
  if (data.reserve.status === 'unknown' && data.accounts.length > 0) {
    warnings.push({ id: 'reserve-data', text: texts.noReserveData, to: '/budget' });
  } else if (data.reserve.months !== null && data.reserve.months < 3) {
    warnings.push({ id: 'reserve-low', text: texts.reserveLow, to: '/goals' });
  }
  if (data.fact.freeCashMinor < 0) {
    warnings.push({ id: 'free-cash', text: texts.negativeFreeCash, to: '/budget' });
  }

  for (const view of data.goals) {
    if (view.goal.kind === 'reserve') continue;
    if (!view.beatsInflation) {
      warnings.push({
        id: `inflation-${view.goal.id}`,
        text: texts.returnBelowInflation.replace('{name}', view.goal.name),
        to: '/goals',
      });
    }
    if (view.plan?.status === 'overdue') {
      warnings.push({
        id: `overdue-${view.goal.id}`,
        text: texts.goalOverdue.replace('{name}', view.goal.name),
        to: '/goals',
      });
    }
  }

  if (data.settings.lastBackupAt === null && data.hasTransactions) {
    warnings.push({ id: 'backup', text: texts.noBackup, to: '/settings' });
  }

  return warnings;
}

export interface WarningTexts {
  readonly negativeNetWorth: string;
  readonly debtTense: string;
  readonly reserveLow: string;
  readonly noReserveData: string;
  readonly negativeFreeCash: string;
  readonly returnBelowInflation: string;
  readonly goalOverdue: string;
  readonly noBackup: string;
}
