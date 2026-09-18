/**
 * What the five questions of the onboarding turn into: starter categories, a plan for
 * the current month, the accounts the user named, the reserve goal and the first goal,
 * plus a ready dashboard — so nobody meets an empty screen.
 */

import { rublesToMinor } from '@/core/money';
import { addMonths, currentMonth, type IsoMonth } from '@/core/time';
import { createAccount } from '@/db/repositories/accounts';
import { setPlan } from '@/db/repositories/budget-plans';
import {
  ONBOARDING_INCOME_CATEGORY,
  ONBOARDING_MANDATORY_CATEGORY,
  ONBOARDING_VARIABLE_CATEGORY,
  seedDefaultCategories,
} from '@/db/repositories/categories';
import { resetDashboardLayout } from '@/db/repositories/dashboard';
import { createGoal, ensureReserveGoal } from '@/db/repositories/goals';
import { updateSettings } from '@/db/repositories/settings';
import { strings } from '@/i18n';
import { recordOnboarding } from '@/lib/usage';

export interface OnboardingAnswers {
  readonly incomeRub: number;
  readonly mandatoryRub: number;
  readonly variableRub: number;
  readonly savingsRub: number;
  readonly debtBalanceRub: number;
  readonly debtPaymentRub: number;
  readonly debtPaymentDay?: number;
  /** Percent a year, as typed; left out when the user does not know it. */
  readonly debtRatePercent?: number;
  readonly goalName: string;
  readonly goalCostRub: number;
  readonly goalTargetMonth?: IsoMonth;
  /** A round sum is wanted by the date, not today's price grown with inflation. */
  readonly goalExactSum?: boolean;
}

export const EMPTY_ANSWERS: OnboardingAnswers = {
  incomeRub: 0,
  mandatoryRub: 0,
  variableRub: 0,
  savingsRub: 0,
  debtBalanceRub: 0,
  debtPaymentRub: 0,
  goalName: '',
  goalCostRub: 0,
};

export async function completeOnboarding(answers: OnboardingAnswers): Promise<void> {
  const month = currentMonth();

  await seedDefaultCategories();

  if (answers.incomeRub > 0) {
    await setPlan(month, ONBOARDING_INCOME_CATEGORY, rublesToMinor(answers.incomeRub));
  }
  if (answers.mandatoryRub > 0) {
    await setPlan(month, ONBOARDING_MANDATORY_CATEGORY, rublesToMinor(answers.mandatoryRub));
  }
  if (answers.variableRub > 0) {
    await setPlan(month, ONBOARDING_VARIABLE_CATEGORY, rublesToMinor(answers.variableRub));
  }

  if (answers.savingsRub > 0) {
    await createAccount({
      name: strings.defaults.savingsAccount,
      defaultKey: 'savingsAccount',
      defaultName: strings.defaults.savingsAccount,
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: rublesToMinor(answers.savingsRub),
      isLiquid: true,
    });
  }

  if (answers.debtBalanceRub > 0 || answers.debtPaymentRub > 0) {
    await createAccount({
      name: strings.defaults.debtAccount,
      defaultKey: 'debtAccount',
      defaultName: strings.defaults.debtAccount,
      side: 'liability',
      type: 'other_debt',
      openingBalanceMinor: rublesToMinor(answers.debtBalanceRub),
      monthlyPaymentMinor: answers.debtPaymentRub > 0 ? rublesToMinor(answers.debtPaymentRub) : undefined,
      paymentDay: answers.debtPaymentDay,
      rate: answers.debtRatePercent !== undefined ? answers.debtRatePercent / 100 : undefined,
    });
  }

  await ensureReserveGoal();

  if (answers.goalName.trim() && answers.goalCostRub > 0) {
    await createGoal({
      name: answers.goalName.trim(),
      kind: 'purchase',
      costMinor: rublesToMinor(answers.goalCostRub),
      costAsOf: month,
      // A goal without a date cannot be planned, so a sensible default is used.
      targetMonth: answers.goalTargetMonth ?? addMonths(month, 36),
      inflationRate: answers.goalExactSum ? 0 : undefined,
    });
  }

  await resetDashboardLayout();
  await updateSettings({ onboardingDone: true });
  recordOnboarding('completed');
}

/** Skipping still gives the user a working app: categories, the reserve and a layout. */
export async function skipOnboarding(): Promise<void> {
  await seedDefaultCategories();
  await ensureReserveGoal();
  await resetDashboardLayout();
  await updateSettings({ onboardingDone: true });
  recordOnboarding('skipped');
}
