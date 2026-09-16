import { ru } from '@/i18n/ru';

/** "60 месяцев", "1 месяц", "3 месяца" — the Russian plural of a number of months. */
export function monthsLabel(months: number): string {
  const [many, one, few] = ru.goals.months;
  const tail = months % 100;
  const last = months % 10;
  const word = tail >= 11 && tail <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;
  return `${months} ${word}`;
}
