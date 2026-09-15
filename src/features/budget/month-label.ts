import { addMonths, currentMonth, type IsoMonth } from '@/core/time';
import { ru } from '@/i18n/ru';

/** "2026-09" → "Сентябрь 2026". Built from the string, so no time zone can shift it. */
export function monthLabel(month: IsoMonth): string {
  const index = Number(month.slice(5, 7)) - 1;
  return `${ru.budget.months[index]} ${month.slice(0, 4)}`;
}

/** "2026-09" → "сен" — for the twelve columns of the year view. */
export function shortMonthLabel(month: IsoMonth): string {
  return ru.budget.monthsShort[Number(month.slice(5, 7)) - 1];
}

export function isCurrentMonth(month: IsoMonth, now: Date = new Date()): boolean {
  return month === currentMonth(now);
}

export function shiftMonth(month: IsoMonth, delta: number): IsoMonth {
  return addMonths(month, delta);
}
