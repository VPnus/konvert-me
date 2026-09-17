/**
 * The countries whose economy the app knows. The country belongs to the data, not to the device:
 * it sets the currency of every sum, the norms of the law and the set of tabs. One currency serves
 * all the data, and a change of the country converts no sum.
 */

export const COUNTRIES = ['ru', 'us'] as const;
export type Country = (typeof COUNTRIES)[number];

export const CURRENCIES = ['RUB', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const COUNTRY_CURRENCY: Readonly<Record<Country, Currency>> = { ru: 'RUB', us: 'USD' };

/** Data kept before the country was asked lived in Russia and in rubles. */
export const DEFAULT_COUNTRY: Country = 'ru';
