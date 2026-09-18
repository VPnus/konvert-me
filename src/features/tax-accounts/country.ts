import type { Country } from '@/core/country';
import { currentCountry } from '@/i18n/country';

/**
 * A 401(k), an IRA, an HSA and a 529 are the tax law of the United States. Elsewhere their tab is
 * not shown; the accounts kept stay in the data and come back with the country.
 */
export const TAX_ACCOUNT_COUNTRIES: readonly Country[] = ['us'];

export function taxAccountsAvailable(country: Country = currentCountry()): boolean {
  return TAX_ACCOUNT_COUNTRIES.includes(country);
}
