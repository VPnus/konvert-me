import { describe, expect, it } from 'vitest';

import { isIsoDate } from '../time';
import { RULES_2026 } from './2026';
import { rulesForYear } from './index';
import type { Norm, YearRules } from './types';

/** Every field of a year but its number is a norm, and every norm must answer for itself. */
function normsOf(rules: YearRules): [string, Norm<unknown>][] {
  return Object.entries(rules).filter(([key]) => key !== 'year') as [string, Norm<unknown>][];
}

describe('rules', () => {
  it('gives every norm a source and the date it was checked', () => {
    const norms = normsOf(RULES_2026);
    expect(norms.length).toBeGreaterThan(0);

    for (const [name, norm] of norms) {
      expect(norm.value, name).toBeDefined();
      expect(norm.source, name).toMatch(/^https:\/\//);
      expect(isIsoDate(norm.checkedAt), name).toBe(true);
    }
  });

  it('states the deposit insurance limit of 2026 with its source', () => {
    const limit = RULES_2026.depositInsuranceLimitMinor;

    expect(limit.value).toBe(1_400_000 * 100);
    expect(limit.note).toBeTruthy();
  });

  it('falls back to the latest year it knows', () => {
    expect(rulesForYear(2026).year).toBe(2026);
    // a year nobody has written rules for yet must not leave the app without any
    expect(rulesForYear(2031).year).toBe(2026);
    expect(rulesForYear(2020).year).toBe(2026);
  });

  describe('deductions of 2026', () => {
    it('limits the social deductions that share one pot', () => {
      expect(RULES_2026.socialDeductionLimitMinor.value).toBe(150_000 * 100);
      // the pot is not the whole story: two kinds of spending sit outside it
      expect(RULES_2026.socialDeductionLimitMinor.note).toBeTruthy();
    });

    it('limits the schooling of one child separately from that pot', () => {
      expect(RULES_2026.childEducationLimitMinor.value).toBe(110_000 * 100);
    });

    it('states the standard deduction per child and the income it stops at', () => {
      const child = RULES_2026.childDeduction.value;

      expect(child.firstMinor).toBe(1_400 * 100);
      expect(child.secondMinor).toBe(2_800 * 100);
      expect(child.thirdAndOnMinor).toBe(6_000 * 100);
      expect(child.incomeCapMinor).toBe(450_000 * 100);
    });

    it('pays a guardian of a disabled child half of what it pays a parent', () => {
      const child = RULES_2026.childDeduction.value;

      expect(child.disabledParentMinor).toBe(12_000 * 100);
      expect(child.disabledGuardianMinor).toBe(6_000 * 100);
    });

    it('limits a year of contributions to a long-term investment account', () => {
      expect(RULES_2026.longTermSavingsLimitMinor.value).toBe(400_000 * 100);
      // the limit is shared with other long-term savings, not the account's alone
      expect(RULES_2026.longTermSavingsLimitMinor.note).toBeTruthy();
    });

    it('lets a deduction be claimed three years back', () => {
      expect(RULES_2026.deductionYearsBack.value).toBe(3);
    });
  });

  describe('the income tax scale of 2026', () => {
    const bands = RULES_2026.incomeTaxBands.value;

    it('starts at the bottom and climbs', () => {
      expect(bands[0].fromMinor).toBe(0);

      for (let index = 1; index < bands.length; index += 1) {
        expect(bands[index].fromMinor).toBeGreaterThan(bands[index - 1].fromMinor);
        expect(bands[index].rate).toBeGreaterThan(bands[index - 1].rate);
      }
    });

    it('has the five steps of the progressive scale', () => {
      expect(bands.map((band) => band.rate)).toEqual([0.13, 0.15, 0.18, 0.2, 0.22]);
      expect(bands.map((band) => band.fromMinor)).toEqual([
        0,
        2_400_000 * 100,
        5_000_000 * 100,
        20_000_000 * 100,
        50_000_000 * 100,
      ]);
    });
  });
});
