import { describe, expect, it } from 'vitest';

import { isIsoDate } from '../time';
import { RULES_2023 } from './2023';
import { RULES_2024 } from './2024';
import { RULES_2025 } from './2025';
import { RULES_2026 } from './2026';
import { KNOWN_RULES, latestRules, rulesForYear } from './index';
import type { Norm, YearRules } from './types';

/** Every field of a year but its number is a norm, and every norm must answer for itself. */
function normsOf(rules: YearRules): [string, Norm<unknown>][] {
  return Object.entries(rules).filter(([key]) => key !== 'year') as [string, Norm<unknown>][];
}

describe('rules', () => {
  it('gives every norm of every year a source and the date it was checked', () => {
    for (const rules of KNOWN_RULES) {
      const norms = normsOf(rules);
      expect(norms.length).toBeGreaterThan(0);

      for (const [name, norm] of norms) {
        const label = `${rules.year}.${name}`;
        expect(norm.value, label).toBeDefined();
        expect(norm.source, label).toMatch(/^https:\/\//);
        expect(isIsoDate(norm.checkedAt), label).toBe(true);
      }
    }
  });

  it('keeps the years in order, one file per year', () => {
    expect(KNOWN_RULES.map((rules) => rules.year)).toEqual([2023, 2024, 2025, 2026]);
  });

  it('states the deposit insurance limit with its exceptions', () => {
    expect(RULES_2026.depositInsuranceLimitMinor.value).toBe(1_400_000 * 100);
    expect(RULES_2026.depositInsuranceLimitMinor.note).toBeTruthy();
  });

  describe('finding the rules of a year', () => {
    it('gives a written year its own rules', () => {
      for (const year of [2023, 2024, 2025, 2026]) expect(rulesForYear(year)?.year).toBe(year);
    });

    it('lends the latest rules to a year nobody has written yet, and says so by their year', () => {
      expect(rulesForYear(2031)?.year).toBe(2026);
    });

    it('gives nothing to a year before the first written one', () => {
      // counting 2022 by the rules of 2023 would promise a refund that is not due
      expect(rulesForYear(2022)).toBeUndefined();
    });

    it('knows the latest rules written', () => {
      expect(latestRules().year).toBe(2026);
    });
  });

  describe('social deductions over the years', () => {
    it('had a shared pot of 120 000 until 2024 and 150 000 from then', () => {
      expect(RULES_2023.socialDeductionLimitMinor.value).toBe(120_000 * 100);
      expect(RULES_2024.socialDeductionLimitMinor.value).toBe(150_000 * 100);
      expect(RULES_2025.socialDeductionLimitMinor.value).toBe(150_000 * 100);
      expect(RULES_2026.socialDeductionLimitMinor.value).toBe(150_000 * 100);
    });

    it('limited one child’s schooling to 50 000 until 2024 and 110 000 from then', () => {
      expect(RULES_2023.childEducationLimitMinor.value).toBe(50_000 * 100);
      expect(RULES_2024.childEducationLimitMinor.value).toBe(110_000 * 100);
      expect(RULES_2025.childEducationLimitMinor.value).toBe(110_000 * 100);
      expect(RULES_2026.childEducationLimitMinor.value).toBe(110_000 * 100);
    });

    it('notes what lies outside the shared pot', () => {
      for (const rules of KNOWN_RULES) expect(rules.socialDeductionLimitMinor.note).toBeTruthy();
    });
  });

  describe('child deductions over the years', () => {
    it('were 1 400, 1 400 and 3 000 up to an income of 350 000 before 2025', () => {
      for (const rules of [RULES_2023, RULES_2024]) {
        expect(rules.childDeduction.value).toMatchObject({
          firstMinor: 1_400 * 100,
          secondMinor: 1_400 * 100,
          thirdAndOnMinor: 3_000 * 100,
          incomeCapMinor: 350_000 * 100,
        });
      }
    });

    it('are 1 400, 2 800 and 6 000 up to an income of 450 000 from 2025', () => {
      for (const rules of [RULES_2025, RULES_2026]) {
        expect(rules.childDeduction.value).toMatchObject({
          firstMinor: 1_400 * 100,
          secondMinor: 2_800 * 100,
          thirdAndOnMinor: 6_000 * 100,
          incomeCapMinor: 450_000 * 100,
        });
      }
    });

    it('paid a guardian of a disabled child half of a parent’s share before 2025', () => {
      for (const rules of [RULES_2023, RULES_2024]) {
        expect(rules.childDeduction.value.disabledParentMinor).toBe(12_000 * 100);
        expect(rules.childDeduction.value.disabledGuardianMinor).toBe(6_000 * 100);
      }
    });

    it('pay a guardian of a disabled child as much as a parent from 2025', () => {
      for (const rules of [RULES_2025, RULES_2026]) {
        expect(rules.childDeduction.value.disabledParentMinor).toBe(12_000 * 100);
        expect(rules.childDeduction.value.disabledGuardianMinor).toBe(12_000 * 100);
      }
    });
  });

  describe('property deductions over the years', () => {
    it('allow 2 million for a home and 3 million of its loan interest in every year', () => {
      for (const rules of KNOWN_RULES) {
        expect(rules.propertyPurchaseLimitMinor.value).toBe(2_000_000 * 100);
        expect(rules.mortgageInterestLimitMinor.value).toBe(3_000_000 * 100);
      }
    });

    it('say what the limits do not cover', () => {
      for (const rules of KNOWN_RULES) {
        expect(rules.propertyPurchaseLimitMinor.note).toBeTruthy();
        expect(rules.mortgageInterestLimitMinor.note).toBeTruthy();
      }
    });
  });

  describe('long-term savings over the years', () => {
    it('allow 400 000 a year', () => {
      for (const rules of KNOWN_RULES) expect(rules.longTermSavingsLimitMinor.value).toBe(400_000 * 100);
    });

    it('say what the limit covers, since that changed in 2024', () => {
      for (const rules of KNOWN_RULES) expect(rules.longTermSavingsLimitMinor.note).toBeTruthy();
    });
  });

  it('lets a deduction be claimed three years back in every year', () => {
    for (const rules of KNOWN_RULES) expect(rules.deductionYearsBack.value).toBe(3);
  });

  describe('selling a home over the years', () => {
    it('takes 1 000 000 off the price, 70 % of the cadastral value at the least, and frees a home after 3 or 5 years', () => {
      for (const rules of KNOWN_RULES) {
        expect(rules.homeSale.value).toEqual({
          deductionLimitMinor: 1_000_000 * 100,
          cadastralShare: 0.7,
          minimumYears: 5,
          minimumYearsSpecial: 3,
        });
        expect(rules.homeSale.note).toBeTruthy();
      }
    });

    it('taxed a sale at 13 % whatever its size until 2025, and at 15 % above 2,4 million from then', () => {
      for (const rules of [RULES_2023, RULES_2024]) {
        expect(rules.homeSaleTaxBands.value).toEqual([{ fromMinor: 0, rate: 0.13 }]);
      }
      for (const rules of [RULES_2025, RULES_2026]) {
        expect(rules.homeSaleTaxBands.value).toEqual([
          { fromMinor: 0, rate: 0.13 },
          { fromMinor: 2_400_000 * 100, rate: 0.15 },
        ]);
      }
    });

    it('counted a sale with the salary until 2025, and as a base of its own from then', () => {
      for (const rules of [RULES_2023, RULES_2024]) expect(rules.saleIncomeInMainBase.value).toBe(true);
      for (const rules of [RULES_2025, RULES_2026]) expect(rules.saleIncomeInMainBase.value).toBe(false);
      for (const rules of KNOWN_RULES) expect(rules.saleIncomeInMainBase.note).toBeTruthy();
    });
  });

  it('asks for a return by 30 April and for its tax by 15 July of the year after', () => {
    for (const rules of KNOWN_RULES) {
      expect(rules.declarationDeadline.value).toBe('04-30');
      expect(rules.taxPaymentDeadline.value).toBe('07-15');
    }
  });

  describe('the income tax scale', () => {
    it('had two steps, 13 % and 15 % above 5 million, until 2025', () => {
      for (const rules of [RULES_2023, RULES_2024]) {
        expect(rules.incomeTaxBands.value).toEqual([
          { fromMinor: 0, rate: 0.13 },
          { fromMinor: 5_000_000 * 100, rate: 0.15 },
        ]);
      }
    });

    it('has five steps from 2025', () => {
      for (const rules of [RULES_2025, RULES_2026]) {
        const bands = rules.incomeTaxBands.value;
        expect(bands.map((band) => band.rate)).toEqual([0.13, 0.15, 0.18, 0.2, 0.22]);
        expect(bands.map((band) => band.fromMinor)).toEqual([
          0,
          2_400_000 * 100,
          5_000_000 * 100,
          20_000_000 * 100,
          50_000_000 * 100,
        ]);
      }
    });

    it('starts at the bottom and climbs in every year', () => {
      for (const rules of KNOWN_RULES) {
        const bands = rules.incomeTaxBands.value;
        expect(bands[0].fromMinor).toBe(0);

        for (let index = 1; index < bands.length; index += 1) {
          expect(bands[index].fromMinor).toBeGreaterThan(bands[index - 1].fromMinor);
          expect(bands[index].rate).toBeGreaterThan(bands[index - 1].rate);
        }
      }
    });
  });
});
