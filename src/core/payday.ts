/**
 * When the money comes in. A source of income repeats on the same day of every month,
 * so the next payment is either this month's day (if it has not passed yet) or the
 * next month's. Dates are strings throughout, so no time zone can move a payday.
 */

import { addMonths, daysBetween, monthOfDate, withDayOfMonth, type IsoDate } from './time';

export interface NextPayday {
  readonly date: IsoDate;
  /** Whole days from today; zero means the money arrives today. */
  readonly inDays: number;
}

export function nextPayday(today: IsoDate, dayOfMonth: number): NextPayday {
  const month = monthOfDate(today);
  const thisMonth = withDayOfMonth(month, dayOfMonth);
  const date = thisMonth >= today ? thisMonth : withDayOfMonth(addMonths(month, 1), dayOfMonth);

  return { date, inDays: daysBetween(today, date) };
}

export interface PaydaySource {
  readonly id: string;
  readonly dayOfMonth: number;
}

export interface PaydayOf<T> extends NextPayday {
  readonly source: T;
}

/** Every source with its next payment, the nearest first. */
export function nextPaydays<T extends PaydaySource>(today: IsoDate, sources: readonly T[]): PaydayOf<T>[] {
  return sources
    .map((source) => ({ source, ...nextPayday(today, source.dayOfMonth) }))
    .sort((a, b) => a.inDays - b.inDays || a.source.id.localeCompare(b.source.id));
}
