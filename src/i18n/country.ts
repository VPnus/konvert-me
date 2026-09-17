/**
 * The country of the data on this page: the currency every sum is written in, the norms and the
 * tabs. Unlike the language it belongs to the data, not to the device, so it is not read here: the
 * app session sets it from the settings before a screen of the app is drawn, and draws them anew
 * when it changes. The pages of the site show no sums of the user and keep the default.
 */

import { COUNTRY_CURRENCY, DEFAULT_COUNTRY, type Country, type Currency } from '@/core/country';

let current: Country = DEFAULT_COUNTRY;

export function currentCountry(): Country {
  return current;
}

/** The currency of every sum: "RUB" or "USD". */
export function currentCurrency(): Currency {
  return COUNTRY_CURRENCY[current];
}

export function setCurrentCountry(country: Country): void {
  current = country;
}
