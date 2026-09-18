import { describe, expect, it } from 'vitest';

import { isIsoDate } from '../time';
import { COUNTRIES } from '../country';
import { KNOWN_RULES as BY_COUNTRY, latestRules, rulesForYear } from './index';
import { RU_RULES_2023 as RULES_2023 } from './ru/2023';
import { RU_RULES_2024 as RULES_2024 } from './ru/2024';
import { RU_RULES_2025 as RULES_2025 } from './ru/2025';
import { RU_RULES_2026 as RULES_2026 } from './ru/2026';
import type { Norm, YearRules } from './types';
import { US_RULES_2026 } from './us/2026';

/** Most of the norms are the deductions of Russia. */
const KNOWN_RULES = BY_COUNTRY.ru;

/** Every field of a year but its number is a norm, and every norm must answer for itself. */
function normsOf(rules: YearRules): [string, Norm<unknown>][] {
  return Object.entries(rules).filter(([key]) => key !== 'year') as [string, Norm<unknown>][];
}

describe('rules', () => {
  it('gives every norm of every year in every country a source and the date it was checked', () => {
    const everyYear: YearRules[] = COUNTRIES.flatMap((country) => [...BY_COUNTRY[country]]);

    for (const rules of everyYear) {
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

  it('keeps the years of each country in order, one file per year', () => {
    expect(BY_COUNTRY.ru.map((rules) => rules.year)).toEqual([2023, 2024, 2025, 2026]);
    expect(BY_COUNTRY.us.map((rules) => rules.year)).toEqual([2026]);
  });

  it('moves life insurance to the long-term savings deduction only in 2026, and says what is unclear', () => {
    // federal law 418-FZ of 17.11.2025: from 1 September 2026
    expect(KNOWN_RULES.map((rules) => rules.lifeInsuranceInLongTermSavings.value)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(RULES_2026.lifeInsuranceInLongTermSavings.note).toMatch(/418-ФЗ/);
  });

  it('states the deposit insurance limit of each country with its exceptions', () => {
    expect(RULES_2026.depositInsuranceLimitMinor.value).toBe(1_400_000 * 100);
    expect(RULES_2026.depositInsuranceLimitMinor.note).toBeTruthy();
    // FDIC: per depositor, per insured bank, for each account ownership category
    expect(US_RULES_2026.depositInsuranceLimitMinor.value).toBe(250_000 * 100);
    expect(US_RULES_2026.depositInsuranceLimitMinor.source).toMatch(/^https:\/\/www\.fdic\.gov\//);
    expect(US_RULES_2026.depositInsuranceLimitMinor.note).toMatch(/ownership category/);
  });

  describe('the tax advantaged accounts of the United States', () => {
    const rules = US_RULES_2026;

    it('lets a person defer 24 500 of their pay in 2026, and more from 50 and from 60 to 63', () => {
      expect(rules.deferralLimits.value).toEqual({
        electiveDeferralMinor: 24_500 * 100,
        catchUpFrom50Minor: 8_000 * 100,
        catchUpFrom60To63Minor: 11_250 * 100,
      });
      expect(rules.deferralLimits.source).toMatch(/^https:\/\/www\.irs\.gov\//);
    });

    it('gives every IRA of a person one limit of 7 500, and 1 100 more from 50', () => {
      expect(rules.iraLimits.value).toEqual({
        contributionMinor: 7_500 * 100,
        catchUpFrom50Minor: 1_100 * 100,
      });
      expect(rules.iraLimits.note).toMatch(/traditional and Roth together/);
    });

    it('allows an HSA 4 400 alone and 8 750 for a family, and 1 000 more from 55', () => {
      expect(rules.hsaLimits.value).toMatchObject({
        selfOnlyMinor: 4_400 * 100,
        familyMinor: 8_750 * 100,
        catchUpFrom55Minor: 1_000 * 100,
      });
      // a plan below these deductibles is not a high deductible one, and its holder may not contribute
      expect(rules.hsaLimits.value.minimumDeductibleSelfOnlyMinor).toBe(1_700 * 100);
      expect(rules.hsaLimits.value.minimumDeductibleFamilyMinor).toBe(3_400 * 100);
    });

    it('measures a 529 by the gift exclusion of 19 000, since the federal law sets it no limit', () => {
      expect(rules.giftExclusionMinor.value).toBe(19_000 * 100);
      expect(rules.giftExclusionMinor.note).toMatch(/no federal contribution limit/);
    });

    it('says what every limit leaves to the person: the income, the cover, the plan at work', () => {
      for (const norm of [rules.deferralLimits, rules.iraLimits, rules.hsaLimits]) {
        expect(norm.note).toBeTruthy();
      }
    });
  });

  describe('finding the rules of a year', () => {
    it('gives a written year its own rules', () => {
      for (const year of [2023, 2024, 2025, 2026]) expect(rulesForYear('ru', year)?.year).toBe(year);
      expect(rulesForYear('us', 2026)).toBe(US_RULES_2026);
    });

    it('lends the latest rules to a year nobody has written yet, and says so by their year', () => {
      expect(rulesForYear('ru', 2031)?.year).toBe(2026);
      expect(rulesForYear('us', 2031)).toBe(US_RULES_2026);
    });

    it('gives nothing to a year before the first written one', () => {
      // counting 2022 by the rules of 2023 would promise a refund that is not due
      expect(rulesForYear('ru', 2022)).toBeUndefined();
      expect(rulesForYear('us', 2025)).toBeUndefined();
    });

    it('knows the latest rules written', () => {
      expect(latestRules('ru')).toBe(RULES_2026);
      expect(latestRules('us')).toBe(US_RULES_2026);
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

  it('asked for contracts, licences and receipts until 2024, and for one certificate of payment from then', () => {
    expect(RULES_2023.socialPaymentCertificates.value).toBe(false);
    for (const rules of [RULES_2024, RULES_2025, RULES_2026]) {
      expect(rules.socialPaymentCertificates.value).toBe(true);
    }
    for (const rules of KNOWN_RULES) expect(rules.socialPaymentCertificates.note).toBeTruthy();
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
