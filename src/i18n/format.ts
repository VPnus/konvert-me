import { fill, strings } from '@/i18n';
import { currentLocale } from '@/i18n/locale';

/** A percentage as the language writes it: "24,43 %" in Russian, "24.43%" in English. */
export function percentLabel(percent: number, maximumFractionDigits = 2): string {
  return fill(strings.formats.percent, {
    value: percent.toLocaleString(currentLocale(), { maximumFractionDigits }),
  });
}
