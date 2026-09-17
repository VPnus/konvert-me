import { db } from '@/db/db';
import { RESERVE_GOAL_ID } from '@/db/repositories/goals';

/**
 * How much of each kind of data there is, for the stats of the pilot: counts only, never a sum,
 * a name or a date. They show which parts of the app people come to, and nothing about their money.
 */
export interface PilotCounts {
  /** Goals of the user's own: the reserve is created for everyone, so it does not count. */
  readonly goals: number;
  /** Accounts and debts, archived ones too. */
  readonly accounts: number;
  readonly operations: number;
  /** Operations that came from a bank statement. */
  readonly importedOperations: number;
  /** Months with a budget plan. */
  readonly budgetMonths: number;
  readonly deductionYears: number;
  /** Education and pension calculations of the financial plan. */
  readonly planCalculations: number;
}

export async function countForPilot(): Promise<PilotCounts> {
  const [goals, accounts, operations, importedOperations, budgetMonths, deductionYears, plan] =
    await Promise.all([
      db.goals.filter((goal) => goal.id !== RESERVE_GOAL_ID).count(),
      db.accounts.count(),
      db.transactions.count(),
      // Operations typed by hand carry no batch, so they are not in its index.
      db.transactions.orderBy('importBatchId').count(),
      db.budgetPlans.orderBy('month').uniqueKeys(),
      db.deductionYears.count(),
      db.financialPlans.get('plan'),
    ]);

  return {
    goals,
    accounts,
    operations,
    importedOperations,
    budgetMonths: budgetMonths.length,
    deductionYears,
    planCalculations: plan ? plan.education.length + (plan.pension ? 1 : 0) : 0,
  };
}
