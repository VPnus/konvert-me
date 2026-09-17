import { strings } from '@/i18n';

/** "сегодня", "завтра", "через 5 дней" — the Russian plural of a number of days. */
export function daysLabel(days: number): string {
  if (days === 0) return strings.income.today;
  if (days === 1) return strings.income.tomorrow;

  const [many, one, few] = strings.income.days;
  const tail = days % 100;
  const last = days % 10;
  const word = tail >= 11 && tail <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;

  return strings.income.inDays.replace('{days}', `${days} ${word}`);
}
