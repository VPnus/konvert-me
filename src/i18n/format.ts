import { currencySign } from '@/core/money';
import { fill, strings } from '@/i18n';
import { currentLocale } from '@/i18n/locale';

/** A percentage as the language writes it: "24,43 %" in Russian, "24.43%" in English. */
export function percentLabel(percent: number, maximumFractionDigits = 2): string {
  return fill(strings.formats.percent, {
    value: percent.toLocaleString(currentLocale(), { maximumFractionDigits }),
  });
}

/** The label of a field of a sum with the sign of the currency of the data: "Сумма, ₽", "Amount, $". */
export function inCurrency(label: string): string {
  return fill(strings.formats.inCurrency, { label, currency: currencySign() });
}
