import { describe, expect, it } from 'vitest';

import {
  carryPropertyDeduction,
  claimableYears,
  incomeTaxMinor,
  propertyDeductionMinor,
  refundMinor,
  socialDeductionMinor,
  type SocialSpending,
} from './deductions';
import { RULES_2023 } from './rules/2023';
import { RULES_2024 } from './rules/2024';
import { RULES_2025 } from './rules/2025';
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
    // tax service: "in 2025 a return can be filed for 2024, 2023 and 2022"
    expect(claimableYears(2025, RULES_2025.deductionYearsBack.value)).toEqual([2022, 2023, 2024]);
    expect(claimableYears(2026, RULES_2026.deductionYearsBack.value)).toEqual([2023, 2024, 2025]);
  });
});

describe('a year counted by its own rules', () => {
  it('taxed 5 million at 13 % whole in 2024, and only the rest at 15 %', () => {
    // example of the two-step scale: 650 000 plus 15 % of what lies above 5 million
    const bands2024 = RULES_2024.incomeTaxBands.value;

    expect(incomeTaxMinor(r(5_000_000), bands2024)).toBe(r(650_000));
    expect(incomeTaxMinor(r(6_000_000), bands2024)).toBe(r(650_000 + 150_000));
  });

  it('returned 19 500 for 2024 and returns 22 500 for 2025 on the same income of 3 million', () => {
    // example of the scale: the maximal social deduction on 3 million, a year apart
    expect(refundMinor(r(3_000_000), r(150_000), RULES_2024.incomeTaxBands.value)).toBe(r(19_500));
    expect(refundMinor(r(3_000_000), r(150_000), RULES_2025.incomeTaxBands.value)).toBe(r(22_500));
  });

  it('stopped the shared pot at 120 000 in 2023', () => {
    // tax service: the limit was 120 000 for spending before 2024
    const deduction = socialDeductionMinor({ ...noSpending, commonMinor: r(300_000) }, RULES_2023);

    expect(deduction).toBe(r(120_000));
    expect(refundMinor(r(1_200_000), deduction, RULES_2023.incomeTaxBands.value)).toBe(r(15_600));
  });

  it('limited a child’s schooling to 50 000 in 2023', () => {
    // tax service: 50 000 per child before 2024
    const spending: SocialSpending = { ...noSpending, childEducationMinor: [r(80_000)] };

    expect(socialDeductionMinor(spending, RULES_2023)).toBe(r(50_000));
    expect(socialDeductionMinor(spending, RULES_2024)).toBe(r(80_000));
  });
});

describe('the property deduction', () => {
  const property = (purchase: number, interest: number, loanBefore2014 = false) =>
    propertyDeductionMinor(
      { purchaseMinor: r(purchase), mortgageInterestMinor: r(interest), loanBefore2014 },
      RULES_2025,
    );

  it('stops the purchase at 2 million and the mortgage interest at 3 million', () => {
    // tax code, art. 220 p. 3 and p. 4
    expect(property(3_000_000, 0)).toBe(r(2_000_000));
    expect(property(0, 3_500_000)).toBe(r(3_000_000));
    expect(property(5_000_000, 4_000_000)).toBe(r(5_000_000));
  });

  it('puts no limit on the interest of a loan taken before 2014', () => {
    // tax code, art. 220: the 3 million limit applies to loans from 1 January 2014
    expect(property(0, 4_000_000, true)).toBe(r(4_000_000));
  });

  it('refuses a negative amount', () => {
    expect(() => property(-1, 0)).toThrow();
    expect(() => property(0, -1)).toThrow();
  });

  it('returns 282 000 on 3,5 million for a purchase of 2 million in 2025', () => {
    // example of the scale: 477 000 of tax, 195 000 after the deduction
    const years = carryPropertyDeduction(property(2_000_000, 0), [
      {
        year: 2025,
        incomeMinor: r(3_500_000),
        otherDeductionsMinor: 0,
        bands: RULES_2025.incomeTaxBands.value,
      },
    ]);

    expect(years).toEqual([{ year: 2025, usedMinor: r(2_000_000), refundMinor: r(282_000), leftMinor: 0 }]);
  });

  it('returns 438 000 on 3,5 million for a purchase and 1,2 million of interest in 2025', () => {
    // example of the scale: 477 000 of tax, 39 000 after a deduction of 3,2 million
    expect(refundMinor(r(3_500_000), property(2_000_000, 1_200_000), RULES_2025.incomeTaxBands.value)).toBe(
      r(438_000),
    );
  });

  it('returns 752 000 on 6 million for both deductions in full in 2025', () => {
    // example of the scale: 882 000 of tax, 130 000 after a deduction of 5 million
    expect(refundMinor(r(6_000_000), property(5_000_000, 4_000_000), RULES_2025.incomeTaxBands.value)).toBe(
      r(752_000),
    );
  });
});

describe('carrying the property deduction over the years', () => {
  const year = (value: number, income: number, other = 0) => ({
    year: value,
    incomeMinor: r(income),
    otherDeductionsMinor: r(other),
    bands: [RULES_2023, RULES_2024, RULES_2025, RULES_2026].find((rules) => rules.year === value)!
      .incomeTaxBands.value,
  });

  it('takes a salary’s worth each year until 2 million is used up', () => {
    // tax code, art. 220 p. 10: what a year cannot use moves on until it is used in full
    const years = carryPropertyDeduction(r(2_000_000), [
      year(2023, 600_000),
      year(2024, 600_000),
      year(2025, 600_000),
      year(2026, 600_000),
    ]);

    expect(years.map((item) => item.usedMinor)).toEqual([r(600_000), r(600_000), r(600_000), r(200_000)]);
    expect(years.map((item) => item.refundMinor)).toEqual([r(78_000), r(78_000), r(78_000), r(26_000)]);
    expect(years.map((item) => item.leftMinor)).toEqual([r(1_400_000), r(800_000), r(200_000), 0]);
    expect(years.reduce((total, item) => total + item.refundMinor, 0)).toBe(r(260_000));
  });

  it('lets a year without taxed income use nothing, and keeps the rest waiting', () => {
    // a source on the rest of the deduction: no taxed income that year, the rest came later
    const years = carryPropertyDeduction(r(500_000), [year(2024, 0), year(2025, 1_000_000)]);

    expect(years).toEqual([
      { year: 2024, usedMinor: 0, refundMinor: 0, leftMinor: r(500_000) },
      { year: 2025, usedMinor: r(500_000), refundMinor: r(65_000), leftMinor: 0 },
    ]);
  });

  it('comes after the deductions that would be lost, and never returns more than was paid', () => {
    // no order is set by law; a social deduction dies with its year and this one does not,
    // so the social one goes first
    const [only] = carryPropertyDeduction(r(2_000_000), [year(2026, 1_200_000, 150_000)]);

    expect(only).toEqual({
      year: 2026,
      usedMinor: r(1_050_000),
      refundMinor: r(136_500),
      leftMinor: r(950_000),
    });
    // with the social refund, the year gives back exactly the tax it paid
    const social = refundMinor(r(1_200_000), r(150_000), RULES_2026.incomeTaxBands.value);
    expect(social + only.refundMinor).toBe(incomeTaxMinor(r(1_200_000), RULES_2026.incomeTaxBands.value));
  });

  it('refuses years out of order', () => {
    expect(() => carryPropertyDeduction(r(100_000), [year(2025, 100_000), year(2024, 100_000)])).toThrow();
  });

  it('refuses a negative income instead of treating it as none', () => {
    expect(() => carryPropertyDeduction(r(100_000), [year(2025, -1)])).toThrow();
  });
});
