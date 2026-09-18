/**
 * The stretch of time the operations list shows. A month alone was not enough: a purchase three
 * months back was found only by clicking through the months one by one.
 *
 * A period is always read against an anchor month — the month chosen on the screen — so the arrows
 * above the list keep their meaning: "three months" ending on the chosen one, "a year" around it.
 */

import { assertIsoDate, daysInMonth, isIsoDate, withDayOfMonth, type IsoDate, type IsoMonth } from './time';
import { addMonths, assertIsoMonth, yearOfMonth } from './time';

export const PERIOD_KINDS = ['month', 'quarter', 'year', 'all', 'custom'] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export interface Period {
  readonly kind: PeriodKind;
  /** Only a custom period carries dates; an empty end means "up to the last operation". */
  readonly from?: IsoDate;
  readonly to?: IsoDate;
}

/** Both ends are inclusive; an absent end means the range is open on that side. */
export interface DateRange {
  readonly from?: IsoDate;
  readonly to?: IsoDate;
}

export const MONTH_PERIOD: Period = { kind: 'month' };

export function isPeriodKind(value: unknown): value is PeriodKind {
  return typeof value === 'string' && (PERIOD_KINDS as readonly string[]).includes(value);
}

function lastDayOf(month: IsoMonth): IsoDate {
  return withDayOfMonth(month, daysInMonth(month));
}

/** The dates a period covers around the month chosen on the screen. */
export function rangeOfPeriod(period: Period, anchor: IsoMonth): DateRange {
  assertIsoMonth(anchor);

  switch (period.kind) {
    case 'month':
      return { from: `${anchor}-01`, to: lastDayOf(anchor) };
    case 'quarter':
      return { from: `${addMonths(anchor, -2)}-01`, to: lastDayOf(anchor) };
    case 'year': {
      const year = String(yearOfMonth(anchor)).padStart(4, '0');
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    case 'all':
      return {};
    case 'custom':
      return { from: period.from, to: period.to };
  }
}

/** Keeps only what a period can hold: a custom one needs its dates, the rest carry none. */
export function normalizePeriod(period: Period): Period {
  if (period.kind !== 'custom') return { kind: period.kind };

  // Anything that is not a date is dropped; a custom period with no date left covers everything,
  // and keeps its kind — the screen is showing its two date fields, waiting for them to be typed.
  const from = period.from && isIsoDate(period.from) ? period.from : undefined;
  const to = period.to && isIsoDate(period.to) ? period.to : undefined;
  return { kind: 'custom', from, to };
}

export function isDateInRange(date: IsoDate, range: DateRange): boolean {
  assertIsoDate(date);
  if (range.from && date < range.from) return false;
  return !(range.to && date > range.to);
}
