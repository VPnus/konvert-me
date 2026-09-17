import type { Country } from '@/core/country';
import { currentCountry } from '@/i18n/country';

/**
 * The deductions are the tax law of Russia. Elsewhere their tab, widget, reminder and step of the plan
 * are not shown; the years and papers kept stay in the data and come back with the country.
 */
export const DEDUCTION_COUNTRIES: readonly Country[] = ['ru'];

export function deductionsAvailable(country: Country = currentCountry()): boolean {
  return DEDUCTION_COUNTRIES.includes(country);
}
