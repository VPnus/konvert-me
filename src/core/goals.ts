/**
 * Goal mathematics — formulas 2 to 6 and 8 of docs/PLAN.md, section 5.
 *
 * The monthly rate is the nominal r / 12 (the convention of the course and of
 * Excel PMT), not the effective (1 + r)^(1/12) - 1.
 */

import type { IsoMonth } from './time';
import { addMonths, monthsBetween } from './time';

export const MAX_GOAL_MONTHS = 1200;

/**
 * Half a kopeck. Money is whole kopecks, so a shortfall smaller than this is not a
 * shortfall — without it the term of formula 5 answers "37 months" for a contribution
 * that formula 4 computed for exactly 36.
 */
const MONEY_EPSILON = 0.5;

export interface GoalMath {
  readonly costMinor: number;
  readonly costAsOf: IsoMonth;
  readonly targetMonth: IsoMonth;
  readonly returnRate: number;
  readonly inflationRate: number;
}

export function monthlyRate(annualRate: number): number {
  return annualRate / 12;
}

/** Formula 2: C * (1 + inflation)^(months / 12). A negative term never discounts the cost. */
export function futureValueMinor(costMinor: number, inflationRate: number, months: number): number {
  if (months <= 0) return costMinor;
  return costMinor * Math.pow(1 + inflationRate, months / 12);
}

export function goalFutureValueMinor(goal: GoalMath): number {
  return futureValueMinor(goal.costMinor, goal.inflationRate, monthsBetween(goal.costAsOf, goal.targetMonth));
}

/** Formula 3. */
export function remainingMonths(from: IsoMonth, targetMonth: IsoMonth): number {
  return monthsBetween(from, targetMonth);
}

export interface MonthlyContributionParams {
  readonly futureValueMinor: number;
  readonly savedMinor: number;
  readonly returnRate: number;
  readonly months: number;
}

/**
 * Formula 4: PMT = (FV - S * (1 + i)^n) * i / ((1 + i)^n - 1), payment at the end of
 * the month, the starting capital earns interest as well.
 */
export function monthlyContribution({
  futureValueMinor: target,
  savedMinor,
  returnRate,
  months,
}: MonthlyContributionParams): number {
  if (!Number.isFinite(months) || months <= 0) {
    throw new RangeError(`months: срок должен быть больше нуля, получено ${String(months)}`);
  }
  const i = monthlyRate(returnRate);
  const grown = i === 0 ? savedMinor : savedMinor * Math.pow(1 + i, months);
  if (grown >= target) return 0;
  if (i === 0) return (target - savedMinor) / months;
  return ((target - grown) * i) / (Math.pow(1 + i, months) - 1);
}

export type GoalPlanStatus = 'active' | 'funded' | 'overdue';

export interface ContributionPlan {
  readonly status: GoalPlanStatus;
  readonly futureValueMinor: number;
  readonly months: number;
  readonly contributionMinor: number;
}

export interface ContributionPlanParams {
  readonly currentMonth: IsoMonth;
  readonly savedMinor: number;
}

export function contributionPlan(goal: GoalMath, params: ContributionPlanParams): ContributionPlan {
  const months = remainingMonths(params.currentMonth, goal.targetMonth);
  const target = goalFutureValueMinor(goal);
  const i = monthlyRate(goal.returnRate);
  const grown = months > 0 && i !== 0 ? params.savedMinor * Math.pow(1 + i, months) : params.savedMinor;

  if (grown >= target) {
    return { status: 'funded', futureValueMinor: target, months, contributionMinor: 0 };
  }
  if (months <= 0) {
    return { status: 'overdue', futureValueMinor: target, months, contributionMinor: 0 };
  }
  return {
    status: 'active',
    futureValueMinor: target,
    months,
    contributionMinor: monthlyContribution({
      futureValueMinor: target,
      savedMinor: params.savedMinor,
      returnRate: goal.returnRate,
      months,
    }),
  };
}

export interface MonthsToGoalParams {
  readonly costMinor: number;
  readonly costAsOf: IsoMonth;
  readonly currentMonth: IsoMonth;
  readonly savedMinor: number;
  readonly paymentMinor: number;
  readonly returnRate: number;
  readonly inflationRate: number;
  readonly maxMonths?: number;
}

/**
 * Formula 5: the first n in 1..1200 where the savings catch up with the cost that
 * keeps inflating. A linear scan, on purpose: the condition is not monotonic in n,
 * so a binary search can report "unreachable" for a goal that is reachable.
 */
export function monthsToGoal(params: MonthsToGoalParams): number | null {
  const {
    costMinor,
    costAsOf,
    currentMonth,
    savedMinor,
    paymentMinor,
    returnRate,
    inflationRate,
    maxMonths = MAX_GOAL_MONTHS,
  } = params;

  if (!(paymentMinor > 0)) {
    throw new RangeError(`paymentMinor: взнос должен быть больше нуля, получено ${String(paymentMinor)}`);
  }

  const i = monthlyRate(returnRate);
  const elapsed = monthsBetween(costAsOf, currentMonth);

  for (let n = 1; n <= maxMonths; n += 1) {
    const growth = i === 0 ? 1 : Math.pow(1 + i, n);
    const accumulated =
      savedMinor * growth + (i === 0 ? paymentMinor * n : (paymentMinor * (growth - 1)) / i);
    const needed = costMinor * Math.pow(1 + inflationRate, (elapsed + n) / 12);
    if (accumulated >= needed - MONEY_EPSILON) return n;
  }
  return null;
}

/** Formula 6. */
export function realReturnRate(returnRate: number, inflationRate: number): number {
  return (1 + returnRate) / (1 + inflationRate) - 1;
}

/** Warning of formula 6: twelve monthly periods of i must beat the yearly inflation. */
export function returnBeatsInflation(returnRate: number, inflationRate: number): boolean {
  return Math.pow(1 + monthlyRate(returnRate), 12) > 1 + inflationRate;
}

export interface GoalProjectionParams extends GoalMath {
  readonly currentMonth: IsoMonth;
  readonly savedMinor: number;
  readonly contributionMinor: number;
  /** How many months to draw; defaults to the months left until the target. */
  readonly months?: number;
}

export interface ProjectionPoint {
  /** Months from the current one: 0 is today. */
  readonly offset: number;
  readonly month: IsoMonth;
  /** Savings with the interest they earn along the way. */
  readonly savedMinor: number;
  /** What the goal costs by then: the price keeps inflating while it is saved for. */
  readonly targetMinor: number;
}

/**
 * The line of a goal, month by month: what will be put aside against what it will
 * cost. The same arithmetic as formulas 4 and 5, only kept at every step instead of
 * the last one, so a screen can draw it.
 */
export function goalProjection(params: GoalProjectionParams): ProjectionPoint[] {
  const { costMinor, costAsOf, currentMonth: from, savedMinor, contributionMinor } = params;
  const months = params.months ?? remainingMonths(from, params.targetMonth);
  if (months <= 0) return [];

  const i = monthlyRate(params.returnRate);
  const elapsed = monthsBetween(costAsOf, from);

  return Array.from({ length: months + 1 }, (_, offset) => {
    const growth = i === 0 ? 1 : Math.pow(1 + i, offset);
    const contributed = i === 0 ? contributionMinor * offset : (contributionMinor * (growth - 1)) / i;

    return {
      offset,
      month: addMonths(from, offset),
      savedMinor: savedMinor * growth + contributed,
      targetMinor: costMinor * Math.pow(1 + params.inflationRate, (elapsed + offset) / 12),
    };
  });
}

export interface AllocationRequest {
  readonly goalId: string;
  readonly priority: number;
  readonly requiredMinor: number;
}

export interface Allocation extends AllocationRequest {
  readonly allocatedMinor: number;
  readonly deficitMinor: number;
}

export interface AllocationResult {
  readonly allocations: Allocation[];
  readonly leftoverMinor: number;
  readonly totalDeficitMinor: number;
}

/**
 * Formula 8: active goals by ascending priority (smaller number is more important,
 * the reserve is always 0); every goal takes min(rest, required).
 */
export function allocateFreeCash(
  requests: readonly AllocationRequest[],
  availableMinor: number,
): AllocationResult {
  const ordered = [...requests].sort((a, b) => a.priority - b.priority || a.goalId.localeCompare(b.goalId));

  let rest = Math.max(availableMinor, 0);
  let totalDeficitMinor = 0;

  const allocations = ordered.map((request) => {
    const required = Math.max(request.requiredMinor, 0);
    const allocatedMinor = Math.min(rest, required);
    const deficitMinor = required - allocatedMinor;
    rest -= allocatedMinor;
    totalDeficitMinor += deficitMinor;
    return { ...request, allocatedMinor, deficitMinor };
  });

  return { allocations, leftoverMinor: rest, totalDeficitMinor };
}
