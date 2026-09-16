import { describe, expect, it } from 'vitest';

import { isIsoDate } from '../time';
import { RULES_2026 } from './2026';
import { rulesForYear } from './index';

describe('rules', () => {
  it('states the deposit insurance limit of 2026 with its source', () => {
    const limit = RULES_2026.depositInsuranceLimitMinor;

    expect(limit.value).toBe(1_400_000 * 100);
    expect(limit.source).toMatch(/^https:\/\//);
    expect(isIsoDate(limit.checkedAt)).toBe(true);
    expect(limit.note).toBeTruthy();
  });

  it('falls back to the latest year it knows', () => {
    expect(rulesForYear(2026).year).toBe(2026);
    // a year nobody has written rules for yet must not leave the app without any
    expect(rulesForYear(2031).year).toBe(2026);
    expect(rulesForYear(2020).year).toBe(2026);
  });
});
