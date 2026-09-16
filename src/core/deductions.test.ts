import { describe, expect, it } from 'vitest';

import {
  claimableYears,
  incomeTaxMinor,
  refundMinor,
  socialDeductionMinor,
  type SocialSpending,
} from './deductions';
import { RULES_2026 } from './rules/2026';

const RUB = 100;
const r = (rubles: number): number => Math.round(rubles * RUB);
const bands = RULES_2026.incomeTaxBands.value;

const noSpending: SocialSpending = { commonMinor: 0, childEducationMinor: [], expensiveTreatmentMinor: 0 };

// Section 5 of the plan has no formulas for deductions: stage 7 is accepted on the
// examples of the tax service instead. Each vector below says where it comes from —
// an example printed by a source, or a rule of the law the case follows from.

describe('income tax on a year of income', () => {
  it('taxes an ordinary salary at 13 %', () => {
    // rule of the scale: 1 200 000 sits wholly in the first band
    expect(incomeTaxMinor(r(1_200_000), bands)).toBe(r(156_000));
  });

  it('taxes only what rises above a band at that band’s rate', () => {
    // example of the scale: 13 % of the first 2,4 million plus 15 % of the other 2,6
    expect(incomeTaxMinor(r(5_000_000), bands)).toBe(r(702_000));
  });

  it('climbs every step of the scale up to 22 % on what lies above 50 million', () => {
    // rule of the scale: 2,4 M × 13 % + 2,6 M × 15 % + 15 M × 18 % + 30 M × 20 % + 10 M × 22 %
    expect(incomeTaxMinor(r(60_000_000), bands)).toBe(
      r(312_000 + 390_000 + 2_700_000 + 6_000_000 + 2_200_000),
    );
  });

  it('takes nothing from nothing', () => {
    expect(incomeTaxMinor(0, bands)).toBe(0);
  });

  it('counts the tax in whole roubles, dropping under 50 kopecks and rounding up from 50', () => {
    // tax code, art. 52 p. 6: 3,85 ₽ gives 50,05 kopecks of tax, 3,84 ₽ gives 49,92
    expect(incomeTaxMinor(385, bands)).toBe(r(1));
    expect(incomeTaxMinor(384, bands)).toBe(0);
  });

  it('refuses a negative or fractional income', () => {
    expect(() => incomeTaxMinor(-1, bands)).toThrow();
    expect(() => incomeTaxMinor(0.5, bands)).toThrow();
  });
});

describe('the refund a deduction brings', () => {
  it('returns 13 % of the deduction on an ordinary salary', () => {
    // tax service, deduction for schooling: 100 000 a month, deduction 150 000 → 19 500
    expect(refundMinor(r(1_200_000), r(150_000), bands)).toBe(r(19_500));
  });

  it('returns 13 000 a year for 100 000 of schooling, 39 000 over three years', () => {
    // tax service, the same page: paying 100 000 each year instead of 300 000 at once
    const yearly = refundMinor(r(1_200_000), r(100_000), bands);

    expect(yearly).toBe(r(13_000));
    expect(yearly * 3).toBe(r(39_000));
  });

  it('comes off the top of the income, so above 2,4 million it returns 15 %', () => {
    // example of the scale: income 3 million, deduction 150 000 → 22 500, not 19 500
    expect(refundMinor(r(3_000_000), r(150_000), bands)).toBe(r(22_500));
  });

  it('splits across two bands when the deduction reaches below the border', () => {
    // rule of the scale: of 150 000, the top 100 000 was taxed at 15 % and 50 000 at 13 %
    expect(refundMinor(r(2_500_000), r(150_000), bands)).toBe(r(21_500));
  });

  it('never returns more tax than was paid', () => {
    // rule of the law: a refund gives back paid tax, it does not pay out on top of it
    expect(refundMinor(r(100_000), r(150_000), bands)).toBe(r(13_000));
  });

  it('returns nothing without a deduction', () => {
    expect(refundMinor(r(1_200_000), 0, bands)).toBe(0);
  });
});

describe('the social deduction of a year', () => {
  it('stops the shared pot at 150 000 however much was spent', () => {
    // tax service, deduction for schooling: 300 000 paid at once gives a deduction of 150 000
    expect(socialDeductionMinor({ ...noSpending, commonMinor: r(300_000) }, RULES_2026)).toBe(r(150_000));
  });

  it('gives the tax service example end to end: 300 000 of schooling returns 19 500', () => {
    const deduction = socialDeductionMinor({ ...noSpending, commonMinor: r(300_000) }, RULES_2026);

    expect(refundMinor(r(1_200_000), deduction, bands)).toBe(r(19_500));
  });

  it('keeps each child’s schooling in its own pot of 110 000, outside the shared one', () => {
    // tax code, art. 219: 110 000 per child, not counted against the 150 000
    const spending: SocialSpending = {
      commonMinor: r(150_000),
      childEducationMinor: [r(200_000), r(50_000)],
      expensiveTreatmentMinor: 0,
    };

    expect(socialDeductionMinor(spending, RULES_2026)).toBe(r(150_000 + 110_000 + 50_000));
  });

  it('puts no limit on expensive treatment', () => {
    // tax service, deduction for treatment: expensive treatment is outside every limit
    const spending: SocialSpending = {
      commonMinor: r(200_000),
      childEducationMinor: [],
      expensiveTreatmentMinor: r(1_000_000),
    };

    expect(socialDeductionMinor(spending, RULES_2026)).toBe(r(150_000 + 1_000_000));
  });

  it('is nothing when nothing was spent', () => {
    expect(socialDeductionMinor(noSpending, RULES_2026)).toBe(0);
  });

  it('refuses a negative amount', () => {
    expect(() => socialDeductionMinor({ ...noSpending, commonMinor: -1 }, RULES_2026)).toThrow();
    expect(() => socialDeductionMinor({ ...noSpending, childEducationMinor: [-1] }, RULES_2026)).toThrow();
  });
});

describe('the years a deduction can still be claimed', () => {
  it('reaches three years back and stops before the current one', () => {
    // tax service: a return for a year can be filed within three years after it,
    // and not for the year that is still going on
    expect(claimableYears(2026, RULES_2026.deductionYearsBack.value)).toEqual([2023, 2024, 2025]);
  });
});
