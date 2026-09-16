/**
 * The education of a child — lesson 7.3.
 *
 * The course counts the whole cost of the studies as one sum in the prices of the first
 * year and saves for it by that date. That is a conservative shortcut (section 8.1 of
 * the plan): the money of the later years is not spent at the start, it keeps earning,
 * while the price of each year keeps growing. Stage 8 counts the studies year by year;
 * the course sum stays alongside it for comparison.
 */

import { futureValueMinor, monthlyRate } from './goals';
import type { IsoMonth } from './time';
import { addMonths, monthsBetween } from './time';

export interface EducationParams {
  /** A year of studies — the fee and, away from home, the living — in the prices of costAsOf. */
  readonly yearlyCostMinor: number;
  readonly years: number;
  readonly costAsOf: IsoMonth;
  /** When the first year starts and its money is needed. */
  readonly startMonth: IsoMonth;
  readonly returnRate: number;
  readonly inflationRate: number;
}

export interface EducationYear {
  /** Years since the start: 0 is the first year. */
  readonly index: number;
  readonly month: IsoMonth;
  /** What the year costs when it comes, in the prices of that month. */
  readonly costMinor: number;
  /** What has to be there on the day of the start to pay for this year when it comes. */
  readonly atStartMinor: number;
}

function assertYears(years: number): void {
  if (!Number.isInteger(years) || years < 1) {
    throw new RangeError(`years: срок учёбы — целое число лет от одного, получено ${String(years)}`);
  }
}

/** The course: every year of the studies in the prices of the start, all of it by then. */
export function educationLumpSumMinor(params: EducationParams): number {
  assertYears(params.years);
  return futureValueMinor(
    params.yearlyCostMinor * params.years,
    params.inflationRate,
    monthsBetween(params.costAsOf, params.startMonth),
  );
}

/**
 * Year by year: the money of year k is paid at its start and costs
 * C * (1 + inflation)^((months to the start + 12k) / 12); on the day of the start it is
 * worth that divided by (1 + i)^(12k), since it earns the monthly rate until then.
 */
export function educationSchedule(params: EducationParams): EducationYear[] {
  assertYears(params.years);
  const i = monthlyRate(params.returnRate);
  const toStart = monthsBetween(params.costAsOf, params.startMonth);

  return Array.from({ length: params.years }, (_, index) => {
    const costMinor = futureValueMinor(params.yearlyCostMinor, params.inflationRate, toStart + 12 * index);
    return {
      index,
      month: addMonths(params.startMonth, 12 * index),
      costMinor,
      atStartMinor: index === 0 || i === 0 ? costMinor : costMinor / Math.pow(1 + i, 12 * index),
    };
  });
}

/** The capital needed on the day of the start to pay for all the years. */
export function educationCapitalMinor(params: EducationParams): number {
  return educationSchedule(params).reduce((total, year) => total + year.atStartMinor, 0);
}
