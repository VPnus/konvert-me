import { pluralForm, strings } from '@/i18n';

/** "60 месяцев", "1 месяц", "3 месяца": a number of months with its word in the language of the page. */
export function monthsLabel(months: number): string {
  return `${months} ${pluralForm(strings.goals.months, months)}`;
}
