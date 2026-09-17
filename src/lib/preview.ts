/**
 * The language and the country are released together, at stage 9.5. Until then the choice of the
 * country is hidden: the author and the tests show it on a device by saving this key as 'on'.
 */
export const COUNTRY_CHOICE_KEY = 'konvert-me.country-choice';

export function countryChoiceShown(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(COUNTRY_CHOICE_KEY) === 'on';
  } catch {
    return false;
  }
}
