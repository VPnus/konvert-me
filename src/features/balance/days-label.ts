import { fill, pluralForm, strings } from '@/i18n';

/** "сегодня", "завтра", "через 5 дней": how long to wait, in the language of the page. */
export function daysLabel(days: number): string {
  if (days === 0) return strings.income.today;
  if (days === 1) return strings.income.tomorrow;

  return fill(strings.income.inDays, { days: `${days} ${pluralForm(strings.income.days, days)}` });
}
