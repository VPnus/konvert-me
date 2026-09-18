/**
 * When the money comes in. A source of income repeats on a schedule of its own: once a month on
 * the same day, twice a month on two days, or every fourteen days whichever day that falls on.
 * Dates are strings throughout, so no time zone can move a payday.
 */

import {
  addDays,
  addMonths,
  assertIsoDate,
  daysBetween,
  monthOfDate,
  withDayOfMonth,
  type IsoDate,
} from './time';

export const PAY_SCHEDULE_KINDS = ['monthly', 'semimonthly', 'biweekly'] as const;
export type PayScheduleKind = (typeof PAY_SCHEDULE_KINDS)[number];

/**
 * How the payments of one source repeat. A month is not a fortnight: a person paid every fourteen
 * days gets 26 payments a year, and two months of every year bring three of them.
 */
export type PaySchedule =
  | { readonly kind: 'monthly'; readonly dayOfMonth: number }
  | {
      readonly kind: 'semimonthly';
      readonly dayOfMonth: number;
      readonly secondDayOfMonth: number;
    }
  | { readonly kind: 'biweekly'; readonly firstDate: IsoDate };

/** The schedule of money that comes once a month, on this day. */
export function monthlyOn(dayOfMonth: number): PaySchedule {
  return { kind: 'monthly', dayOfMonth };
}

/** How many payments a year brings. */
export const PAYMENTS_PER_YEAR: Readonly<Record<PayScheduleKind, number>> = {
  monthly: 12,
  semimonthly: 24,
  biweekly: 26,
};

/** Every fourteen days. */
const BIWEEKLY_DAYS = 14;

export interface NextPayday {
  readonly date: IsoDate;
  /** Whole days from today; zero means the money arrives today. */
  readonly inDays: number;
}

function nextMonthly(today: IsoDate, dayOfMonth: number): IsoDate {
  const month = monthOfDate(today);
  const thisMonth = withDayOfMonth(month, dayOfMonth);
  return thisMonth >= today ? thisMonth : withDayOfMonth(addMonths(month, 1), dayOfMonth);
}

function nextSemimonthly(today: IsoDate, first: number, second: number): IsoDate {
  const month = monthOfDate(today);
  const dates = [
    withDayOfMonth(month, first),
    withDayOfMonth(month, second),
    withDayOfMonth(addMonths(month, 1), Math.min(first, second)),
  ].sort();

  return dates.find((date) => date >= today) ?? dates[dates.length - 1];
}

function nextBiweekly(today: IsoDate, firstDate: IsoDate): IsoDate {
  assertIsoDate(firstDate);
  const passed = daysBetween(firstDate, today);
  if (passed <= 0) return firstDate;

  const periods = Math.ceil(passed / BIWEEKLY_DAYS);
  return addDays(firstDate, periods * BIWEEKLY_DAYS);
}

/** The next payment of a schedule, counted from today. */
export function nextPayday(today: IsoDate, schedule: PaySchedule): NextPayday {
  const date =
    schedule.kind === 'monthly'
      ? nextMonthly(today, schedule.dayOfMonth)
      : schedule.kind === 'semimonthly'
        ? nextSemimonthly(today, schedule.dayOfMonth, schedule.secondDayOfMonth)
        : nextBiweekly(today, schedule.firstDate);

  return { date, inDays: daysBetween(today, date) };
}

/**
 * What one payment is worth in an ordinary month: the payments of a year spread over its twelve
 * months. A fortnightly pay of 1 000 is not 2 000 a month but 2 166,67 — the two longer months
 * are what the budget of the year is short of otherwise.
 */
export function monthlyAmountMinor(amountMinor: number, schedule: PaySchedule): number {
  return Math.round((amountMinor * PAYMENTS_PER_YEAR[schedule.kind]) / 12);
}

/** What a list of sources brings in an ordinary month; a source with no amount adds nothing. */
export function monthlyTotalMinor(
  sources: readonly { readonly amountMinor?: number; readonly schedule: PaySchedule }[],
): number {
  return sources.reduce(
    (total, source) => total + monthlyAmountMinor(source.amountMinor ?? 0, source.schedule),
    0,
  );
}

export interface PaydaySource {
  readonly id: string;
  readonly schedule: PaySchedule;
}

export interface PaydayOf<T> extends NextPayday {
  readonly source: T;
}

/** Every source with its next payment, the nearest first. */
export function nextPaydays<T extends PaydaySource>(today: IsoDate, sources: readonly T[]): PaydayOf<T>[] {
  return sources
    .map((source) => ({ source, ...nextPayday(today, source.schedule) }))
    .sort((a, b) => a.inDays - b.inDays || a.source.id.localeCompare(b.source.id));
}
