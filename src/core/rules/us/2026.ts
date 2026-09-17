import { SOURCES } from './sources';
import type { UsYearRules } from './types';

/** The day every norm below was read from its source. */
const CHECKED = '2026-09-17';

export const US_RULES_2026: UsYearRules = {
  year: 2026,
  depositInsuranceLimitMinor: {
    value: 250_000 * 100,
    source: SOURCES.depositInsurance,
    checkedAt: CHECKED,
    note:
      'Per depositor, per insured bank, for each account ownership category: single, joint, certain ' +
      'retirement accounts such as an IRA, trust accounts and others each have a limit of their own. ' +
      'The app does not know the ownership categories and counts every account of a bank together.',
  },
};
