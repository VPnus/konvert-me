/**
 * Dates live as strings: YYYY-MM-DD for transactions, YYYY-MM for months.
 * No Date objects cross module boundaries, so no time zone can shift a month.
 */

export class TimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeError';
  }
}

/** YYYY-MM */
export type IsoMonth = string;
/** YYYY-MM-DD */
export type IsoDate = string;

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isIsoMonth(value: unknown): value is IsoMonth {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

export function assertIsoMonth(value: unknown, label = 'month'): asserts value is IsoMonth {
  if (!isIsoMonth(value)) {
    throw new TimeError(`${label}: a month as YYYY-MM expected, got ${String(value)}`);
  }
}

export function assertIsoDate(value: unknown, label = 'date'): asserts value is IsoDate {
  if (!isIsoDate(value)) {
    throw new TimeError(`${label}: a date as YYYY-MM-DD expected, got ${String(value)}`);
  }
}

function monthIndex(month: IsoMonth): number {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return year * 12 + (monthNumber - 1);
}

function fromMonthIndex(index: number): IsoMonth {
  const year = Math.floor(index / 12);
  const monthNumber = index - year * 12 + 1;
  return `${String(year).padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}`;
}

/** Formula 1: (year_b - year_a) * 12 + (month_b - month_a). */
export function monthsBetween(from: IsoMonth, to: IsoMonth): number {
  assertIsoMonth(from, 'from');
  assertIsoMonth(to, 'to');
  return monthIndex(to) - monthIndex(from);
}

export function monthOfDate(date: IsoDate): IsoMonth {
  assertIsoDate(date);
  return date.slice(0, 7);
}

export function addMonths(month: IsoMonth, delta: number): IsoMonth {
  assertIsoMonth(month);
  if (!Number.isInteger(delta)) {
    throw new TimeError(`delta: a whole number of months expected, got ${String(delta)}`);
  }
  return fromMonthIndex(monthIndex(month) + delta);
}

export function compareMonths(a: IsoMonth, b: IsoMonth): number {
  assertIsoMonth(a, 'a');
  assertIsoMonth(b, 'b');
  return monthIndex(a) - monthIndex(b);
}

export function monthsRange(from: IsoMonth, to: IsoMonth): IsoMonth[] {
  const length = monthsBetween(from, to) + 1;
  if (length <= 0) return [];
  return Array.from({ length }, (_, offset) => addMonths(from, offset));
}

export function yearOfMonth(month: IsoMonth): number {
  assertIsoMonth(month);
  return Number(month.slice(0, 4));
}

export function monthsOfYear(year: number): IsoMonth[] {
  if (!Number.isInteger(year)) {
    throw new TimeError(`year: a whole year expected, got ${String(year)}`);
  }
  return Array.from(
    { length: 12 },
    (_, index) => `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`,
  );
}

function daysFromEpoch(date: IsoDate): number {
  assertIsoDate(date);
  return (
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000
  );
}

/** Whole days from one calendar date to another; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return daysFromEpoch(to) - daysFromEpoch(from);
}

export function dayOfMonth(date: IsoDate): number {
  assertIsoDate(date);
  return Number(date.slice(8, 10));
}

export function daysInMonth(month: IsoMonth): number {
  assertIsoMonth(month);
  // Day zero of the next month is the last day of this one.
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
}

/**
 * A date in a month by its day number. A day the month does not have becomes its last
 * day: a payment due on the 31st arrives on the 30th of a thirty-day month.
 */
export function withDayOfMonth(month: IsoMonth, day: number): IsoDate {
  assertIsoMonth(month);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new TimeError(`day: a day of the month from 1 to 31 expected, got ${String(day)}`);
  }
  const clamped = Math.min(day, daysInMonth(month));
  return `${month}-${String(clamped).padStart(2, '0')}`;
}

/** The same day some months later or earlier; a day the month does not have becomes its last. */
export function addMonthsToDate(date: IsoDate, months: number): IsoDate {
  return withDayOfMonth(addMonths(monthOfDate(date), months), dayOfMonth(date));
}

/** Local calendar date of an instant — never the UTC one. */
export function todayIso(now: Date = new Date()): IsoDate {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function currentMonth(now: Date = new Date()): IsoMonth {
  return todayIso(now).slice(0, 7);
}
