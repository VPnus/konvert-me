import type { MonthDay } from '@/core/rules';
import { fill } from '@/features/deductions/fill';
import { ru } from '@/i18n/ru';

const DAY_MONTH = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

/** A day that comes back every year, in the year given: '04-30', 2027 → «30 апреля 2027 года». */
export function dateOfYear(day: MonthDay, year: number): string {
  const [month, date] = day.split('-').map(Number);
  return fill(ru.deductions.dateOfYear, {
    dayMonth: DAY_MONTH.format(new Date(year, month - 1, date)),
    year,
  });
}
