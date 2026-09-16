import { ru } from '@/i18n/ru';

/** "сегодня", "завтра", "через 5 дней" — the Russian plural of a number of days. */
export function daysLabel(days: number): string {
  if (days === 0) return ru.income.today;
  if (days === 1) return ru.income.tomorrow;

  const [many, one, few] = ru.income.days;
  const tail = days % 100;
  const last = days % 10;
  const word = tail >= 11 && tail <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;

  return ru.income.inDays.replace('{days}', `${days} ${word}`);
}
