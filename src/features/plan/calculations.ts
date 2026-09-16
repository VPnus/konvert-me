/**
 * The calculators of the plan, from what was saved to what the screen shows. Every
 * number comes from src/core; here they are only put together for one card.
 */

import {
  educationCapitalMinor,
  educationLumpSumMinor,
  educationSchedule,
  type EducationYear,
} from '@/core/education';
import { monthlyContribution } from '@/core/goals';
import {
  courseCapitalMinor,
  pensionCapitalMinor,
  pensionDrawdown,
  pensionNeed,
  type PensionNeed,
  type PensionYear,
} from '@/core/pension';
import { addMonths, monthsBetween, type IsoMonth } from '@/core/time';
import type { EducationPlan, PensionPlan } from '@/db/models';

/** What is left to put aside by a date, or nothing when the date has come or it is covered. */
function contributionBy(targetMinor: number, savedMinor: number, returnRate: number, months: number) {
  if (months <= 0) return null;
  return monthlyContribution({ futureValueMinor: targetMinor, savedMinor, returnRate, months });
}

export interface EducationView {
  readonly item: EducationPlan;
  readonly years: EducationYear[];
  /** Year by year: what has to be there on the day of the start. */
  readonly capitalMinor: number;
  /** The course: every year in the prices of the start. */
  readonly courseSumMinor: number;
  /** Months until the start; zero or less once the studies have begun. */
  readonly months: number;
  readonly savedMinor: number;
  readonly contributionMinor: number | null;
  readonly courseContributionMinor: number | null;
}

export function educationView(item: EducationPlan, month: IsoMonth, savedMinor: number): EducationView {
  const capitalMinor = educationCapitalMinor(item);
  const courseSumMinor = educationLumpSumMinor(item);
  const months = monthsBetween(month, item.startMonth);

  return {
    item,
    years: educationSchedule(item),
    capitalMinor,
    courseSumMinor,
    months,
    savedMinor,
    contributionMinor: contributionBy(capitalMinor, savedMinor, item.returnRate, months),
    courseContributionMinor: contributionBy(courseSumMinor, savedMinor, item.returnRate, months),
  };
}

export interface PensionView {
  readonly pension: PensionPlan;
  readonly retirementMonth: IsoMonth;
  /** Months until retiring; zero or less once retired. */
  readonly months: number;
  readonly years: number;
  readonly need: PensionNeed;
  /** Null when the return does not beat inflation: no capital lets one live off it. */
  readonly keepCapitalMinor: number | null;
  readonly spendCapitalMinor: number;
  /** The capital of the chosen strategy. */
  readonly capitalMinor: number | null;
  readonly courseCapitalMinor: number | null;
  /** The age in the year the course capital runs out, or null when it lasts. */
  readonly courseRunsOutAge: number | null;
  readonly savedMinor: number;
  readonly contributionMinor: number | null;
  /** The chosen capital on retirement, year by year. */
  readonly drawdown: PensionYear[];
}

export function retirementMonthOf(pension: Pick<PensionPlan, 'birthMonth' | 'retirementAge'>): IsoMonth {
  return addMonths(pension.birthMonth, 12 * pension.retirementAge);
}

export function pensionView(pension: PensionPlan, month: IsoMonth, savedMinor: number): PensionView {
  const retirementMonth = retirementMonthOf(pension);
  const months = monthsBetween(month, retirementMonth);
  const years = pension.lifeAge - pension.retirementAge;
  const need = pensionNeed({
    monthlyExpensesMinor: pension.monthlyExpensesMinor,
    replacementRate: pension.replacementRate,
    statePensionMinor: pension.statePensionMinor,
    inflationRate: pension.inflationRate,
    months: monthsBetween(pension.costAsOf, retirementMonth),
  });
  const rates = { returnRate: pension.returnRate, inflationRate: pension.inflationRate };
  const spending = need.annualSpendingMinor;

  const keepCapitalMinor = pensionCapitalMinor({
    annualSpendingMinor: spending,
    ...rates,
    strategy: { kind: 'keep-capital' },
  });
  const spendCapitalMinor =
    pensionCapitalMinor({
      annualSpendingMinor: spending,
      ...rates,
      strategy: { kind: 'spend-capital', years },
    }) ?? 0;
  const capitalMinor = pension.strategy === 'keep-capital' ? keepCapitalMinor : spendCapitalMinor;

  const course = courseCapitalMinor(spending, pension.returnRate);
  const courseYears =
    course === null || spending === 0
      ? []
      : pensionDrawdown({ capitalMinor: course, annualSpendingMinor: spending, ...rates, years });
  const runsOut = courseYears.findIndex((year) => year.endMinor < 0);

  return {
    pension,
    retirementMonth,
    months,
    years,
    need,
    keepCapitalMinor,
    spendCapitalMinor,
    capitalMinor,
    courseCapitalMinor: course,
    courseRunsOutAge: runsOut < 0 ? null : pension.retirementAge + runsOut,
    savedMinor,
    contributionMinor:
      capitalMinor === null ? null : contributionBy(capitalMinor, savedMinor, pension.returnRate, months),
    drawdown:
      capitalMinor === null || spending === 0
        ? []
        : pensionDrawdown({ capitalMinor, annualSpendingMinor: spending, ...rates, years }),
  };
}
