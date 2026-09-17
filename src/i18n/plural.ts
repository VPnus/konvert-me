import { currentLocale } from '@/i18n/locale';
import type { PluralForms } from '@/i18n/types';

const RULES = new Map<string, Intl.PluralRules>();

/** The form of a word for a number, by the rules of the language: 21 месяц, 22 месяца, 25 месяцев. */
export function pluralForm(forms: PluralForms, count: number): string {
  const locale = currentLocale();
  let rules = RULES.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    RULES.set(locale, rules);
  }
  const category = rules.select(count);
  return category === 'one' || category === 'few' || category === 'many' ? forms[category] : forms.other;
}
