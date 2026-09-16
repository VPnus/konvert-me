import { describe, expect, it } from 'vitest';

import {
  carryPropertyDeduction,
  childDeductionMinor,
  claimableYears,
  homeSaleDeductionMinor,
  homeSaleIncomeMinor,
  incomeTaxMinor,
  longTermSavingsDeductionMinor,
  propertyDeductionMinor,
  refundMinor,
  socialDeductionMinor,
  summarizeDeductionYear,
  type ChildRight,
  type ChildrenClaim,
  type DeductionClaim,
  type DeductionSummary,
  type HomeSale,
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

describe('long-term savings', () => {
  it('stops the contributions of a year at 400 000', () => {
    expect(longTermSavingsDeductionMinor(r(500_000), RULES_2026)).toBe(r(400_000));
    expect(longTermSavingsDeductionMinor(r(120_000), RULES_2026)).toBe(r(120_000));
  });

  it('refuses a negative contribution', () => {
    expect(() => longTermSavingsDeductionMinor(-1, RULES_2026)).toThrow();
  });
});

describe('a year of deductions summed up', () => {
  const claim = (patch: Partial<DeductionClaim>): DeductionClaim => ({
    incomeMinor: r(1_200_000),
    social: noSpending,
    longTermSavingsMinor: 0,
    ...patch,
  });
  const home = (purchase: number, usedBefore = 0) => ({
    purchaseMinor: r(purchase),
    mortgageInterestMinor: 0,
    loanBefore2014: false,
    usedBeforeMinor: r(usedBefore),
  });

  it('gives the tax service example: 300 000 of schooling on 100 000 a month returns 19 500', () => {
    const summary = summarizeDeductionYear(
      claim({ social: { ...noSpending, commonMinor: r(300_000) } }),
      RULES_2026,
    );

    expect(summary).toMatchObject({
      taxPaidMinor: r(156_000),
      socialDeductionMinor: r(150_000),
      socialRefundMinor: r(19_500),
      refundMinor: r(19_500),
    });
    expect(summary.property).toBeUndefined();
  });

  it('gives the scale example: a home of 2 million on 3,5 million returns 282 000 in 2025', () => {
    const summary = summarizeDeductionYear(
      claim({ incomeMinor: r(3_500_000), property: home(2_000_000) }),
      RULES_2025,
    );

    expect(summary.taxPaidMinor).toBe(r(477_000));
    expect(summary.property).toEqual({
      availableMinor: r(2_000_000),
      usedMinor: r(2_000_000),
      refundMinor: r(282_000),
      leftMinor: 0,
    });
    expect(summary.refundMinor).toBe(r(282_000));
  });

  it('returns 52 000 for 400 000 put into long-term savings at 13 %', () => {
    // a source on the investment account: 13 % of 400 000 is 52 000 a year
    const summary = summarizeDeductionYear(claim({ longTermSavingsMinor: r(500_000) }), RULES_2026);

    expect(summary.longTermSavingsDeductionMinor).toBe(r(400_000));
    expect(summary.longTermSavingsRefundMinor).toBe(r(52_000));
  });

  it('spends the deductions that die with the year first, and never gives back more than was paid', () => {
    // rule of the law: no order is set; social and savings do not carry over, a home does
    const summary = summarizeDeductionYear(
      claim({
        social: { ...noSpending, commonMinor: r(150_000) },
        longTermSavingsMinor: r(400_000),
        property: home(2_000_000),
      }),
      RULES_2026,
    );

    expect(summary.socialRefundMinor).toBe(r(19_500));
    expect(summary.longTermSavingsRefundMinor).toBe(r(52_000));
    expect(summary.property).toEqual({
      availableMinor: r(2_000_000),
      usedMinor: r(650_000),
      refundMinor: r(84_500),
      leftMinor: r(1_350_000),
    });
    expect(summary.refundMinor).toBe(summary.taxPaidMinor);
  });

  it('takes off what earlier returns already took of the home', () => {
    // rule of the law: 2 million once in a life; 1,2 million of it was used before
    const summary = summarizeDeductionYear(
      claim({ incomeMinor: r(600_000), property: home(3_000_000, 1_200_000) }),
      RULES_2026,
    );

    expect(summary.property).toEqual({
      availableMinor: r(800_000),
      usedMinor: r(600_000),
      refundMinor: r(78_000),
      leftMinor: r(200_000),
    });
  });

  it('has nothing left of a home whose deduction was taken in full before', () => {
    const summary = summarizeDeductionYear(claim({ property: home(2_000_000, 2_500_000) }), RULES_2026);

    expect(summary.property).toEqual({ availableMinor: 0, usedMinor: 0, refundMinor: 0, leftMinor: 0 });
    expect(summary.refundMinor).toBe(0);
  });

  it('counts an old year by its own limits', () => {
    // tax service: 120 000 for spending before 2024
    const summary = summarizeDeductionYear(
      claim({ social: { ...noSpending, commonMinor: r(300_000) } }),
      RULES_2023,
    );

    expect(summary.socialDeductionMinor).toBe(r(120_000));
    expect(summary.refundMinor).toBe(r(15_600));
  });

  it('refuses a negative amount of what earlier returns took', () => {
    expect(() => summarizeDeductionYear(claim({ property: home(2_000_000, -1) }), RULES_2026)).toThrow();
  });
});

const child = (order: number, patch: Partial<ChildRight> = {}): ChildRight => ({
  order,
  disabled: false,
  fromMonth: 1,
  toMonth: 12,
  ...patch,
});

const children = (items: ChildRight[], patch: Partial<ChildrenClaim> = {}): ChildrenClaim => ({
  items,
  double: false,
  guardian: false,
  appliedByEmployer: false,
  ...patch,
});

describe('the standard deduction for children', () => {
  it('gives the tax service example: four children on 40 000 a month, 16 200 a month until November', () => {
    // tax service, standard deductions: 1 400 + 2 800 + 6 000 + 6 000, "until November inclusive",
    // since the income of the year passes 450 000 in December
    const claim = children([child(1), child(2), child(3), child(3)]);

    expect(childDeductionMinor(claim, r(480_000), RULES_2025)).toBe(r(16_200 * 11));
  });

  it('stopped at 350 000 of income with 1 400 for each of the first two children before 2025', () => {
    // lesson 3.3: 1 400 for the first and the second child, until the income passes 350 000;
    // 40 000 a month passes it in September
    const claim = children([child(1), child(2)]);

    expect(childDeductionMinor(claim, r(480_000), RULES_2023)).toBe(r(2_800 * 8));
  });

  it('still gives the month in which the income reaches the border without passing it', () => {
    // tax code, art. 218 p. 1 pp. 4: the deduction stops from the month the income "passed" 450 000
    expect(childDeductionMinor(children([child(1)]), r(450_000), RULES_2025)).toBe(r(1_400 * 12));
  });

  it('lasts only four months on a salary of 100 000', () => {
    // rule of the law: 400 000 by April, 500 000 by May
    expect(childDeductionMinor(children([child(1)]), r(1_200_000), RULES_2026)).toBe(r(1_400 * 4));
  });

  it('adds a disabled child’s 12 000 to the amount by order of birth', () => {
    // tax service and a source on 2025: the amount for a disabled child adds to the one by order
    const claim = children([child(1, { disabled: true })]);

    expect(childDeductionMinor(claim, r(300_000), RULES_2025)).toBe(r((1_400 + 12_000) * 12));
  });

  it('gave a guardian of a disabled child 6 000 instead of 12 000 before 2025, and the same from then', () => {
    // a source on the disabled child deduction before 2025; tax code, art. 218 from 2025
    const claim = children([child(1, { disabled: true })], { guardian: true });

    expect(childDeductionMinor(claim, r(300_000), RULES_2024)).toBe(r((1_400 + 6_000) * 12));
    expect(childDeductionMinor(claim, r(300_000), RULES_2025)).toBe(r((1_400 + 12_000) * 12));
  });

  it('doubles for the only parent', () => {
    // tax code, art. 218 p. 1 pp. 4: "в двойном размере единственному родителю"
    const claim = children([child(1)], { double: true });

    expect(childDeductionMinor(claim, r(300_000), RULES_2025)).toBe(r(1_400 * 2 * 12));
  });

  it('counts only the months the right lasted, and none after the income passed the border', () => {
    // tax code, art. 218 p. 1 pp. 4: from the month of birth; 40 000 a month stops it after November
    const claim = children([child(1, { fromMonth: 6 })]);

    expect(childDeductionMinor(claim, r(480_000), RULES_2025)).toBe(r(1_400 * 6));
  });

  it('refuses months outside the year, months out of order and a place by birth below one', () => {
    const at = (patch: Partial<ChildRight>) =>
      childDeductionMinor(children([child(1, patch)]), r(1), RULES_2025);

    expect(() => at({ fromMonth: 0 })).toThrow();
    expect(() => at({ toMonth: 13 })).toThrow();
    expect(() => at({ fromMonth: 7, toMonth: 6 })).toThrow();
    expect(() => at({ fromMonth: 1.5 })).toThrow();
    expect(() => childDeductionMinor(children([child(0)]), r(1), RULES_2025)).toThrow();
  });

  it('gives back 23 166 of the tax service example when the employer did not give it', () => {
    // 62 400 of tax on 480 000, 39 234 on 480 000 less 178 200
    const summary = summarizeDeductionYear(
      {
        incomeMinor: r(480_000),
        social: noSpending,
        longTermSavingsMinor: 0,
        children: children([child(1), child(2), child(3), child(3)]),
      },
      RULES_2025,
    );

    expect(summary).toMatchObject({
      taxPaidMinor: r(62_400),
      childDeductionMinor: r(178_200),
      childRefundMinor: r(23_166),
      refundMinor: r(23_166),
    });
  });

  it('gives nothing back when the employer already took it off, and the tax paid was lower for it', () => {
    // tax service: with the deduction the employer counts 3 094 a month instead of 5 200
    const summary = summarizeDeductionYear(
      {
        incomeMinor: r(480_000),
        social: noSpending,
        longTermSavingsMinor: 0,
        children: children([child(1), child(2), child(3), child(3)], { appliedByEmployer: true }),
      },
      RULES_2025,
    );

    expect(summary).toMatchObject({
      taxPaidMinor: r(39_234),
      childDeductionMinor: r(178_200),
      childRefundMinor: 0,
      refundMinor: 0,
    });
  });
});

const sale = (price: number, patch: Partial<HomeSale> = {}): HomeSale => ({
  priceMinor: r(price),
  cadastralMinor: 0,
  expensesMinor: 0,
  ownedLongEnough: false,
  ...patch,
});

/** A year with nothing but a sale in it. */
const onlySale = (home: HomeSale, rules = RULES_2025, incomeMinor = 0): DeductionSummary =>
  summarizeDeductionYear({ incomeMinor, social: noSpending, longTermSavingsMinor: 0, sale: home }, rules);

/** The parts of a year add up to what it gives back less the tax on its sale. */
function partsOf(summary: DeductionSummary): number {
  return (
    summary.childRefundMinor +
    summary.socialRefundMinor +
    summary.longTermSavingsRefundMinor +
    (summary.property?.refundMinor ?? 0) -
    (summary.sale?.taxBeforeMinor ?? 0)
  );
}

describe('selling a home', () => {
  it('gives the tax service example: 3 million less 1 million is 260 000, less the 2,5 million paid — 65 000', () => {
    // tax service, the deduction on a sale: a flat bought in 2023 and sold in 2025
    expect(onlySale(sale(3_000_000)).sale).toEqual({
      exempt: false,
      declarationRequired: true,
      incomeMinor: r(3_000_000),
      deductionMinor: r(1_000_000),
      taxBeforeMinor: r(260_000),
      taxMinor: r(260_000),
    });
    expect(onlySale(sale(3_000_000, { expensesMinor: r(2_500_000) })).sale?.taxMinor).toBe(r(65_000));
  });

  it('gives the tax service example on the cadastral value: 2,1 million against 3,3 million pays 170 300', () => {
    // tax service: 70 % of 3 300 000 is 2 310 000, more than the price
    const home = sale(2_100_000, { cadastralMinor: r(3_300_000) });

    expect(homeSaleIncomeMinor(home, RULES_2025)).toBe(r(2_310_000));
    expect(onlySale(home).sale?.taxMinor).toBe(r(170_300));
  });

  it('gives the lesson examples: 364 000 on a flat sold for 3,8 million, 65 000 on a gain of 500 000', () => {
    // lesson 3.5: the tax of those years, 13 % whatever the size
    expect(onlySale(sale(3_800_000), RULES_2024).sale?.taxMinor).toBe(r(364_000));
    expect(onlySale(sale(4_500_000, { expensesMinor: r(4_000_000) }), RULES_2024).sale?.taxMinor).toBe(
      r(65_000),
    );
  });

  it('takes 15 % from what lies above 2,4 million from 2025', () => {
    // rule of the scale: the lesson's flat sold in 2025 — 312 000 plus 15 % of 400 000
    expect(onlySale(sale(3_800_000)).sale?.taxMinor).toBe(r(372_000));
    // a source on audits: 6 million less 1 million — 2,4 million at 13 % and 2,6 million at 15 %
    expect(onlySale(sale(6_000_000)).sale?.taxMinor).toBe(r(702_000));
    // Klerk, 2026: bought for 10 million, sold for 12 and for 20
    expect(onlySale(sale(12_000_000, { expensesMinor: r(10_000_000) }), RULES_2026).sale?.taxMinor).toBe(
      r(260_000),
    );
    expect(onlySale(sale(20_000_000, { expensesMinor: r(10_000_000) }), RULES_2026).sale?.taxMinor).toBe(
      r(1_452_000),
    );
  });

  it('takes nothing from a home owned long enough, and asks for no return about it', () => {
    // tax code, art. 217.1: owned for the minimum term, the income is free of tax
    expect(onlySale(sale(9_000_000, { ownedLongEnough: true })).sale).toEqual({
      exempt: true,
      declarationRequired: false,
      incomeMinor: r(9_000_000),
      deductionMinor: 0,
      taxBeforeMinor: 0,
      taxMinor: 0,
    });
  });

  it('asks for no return when the price is within 1 million', () => {
    // tax service: if the price does not pass the limit, there is nothing to declare or pay
    expect(onlySale(sale(900_000)).sale).toMatchObject({
      declarationRequired: false,
      deductionMinor: r(900_000),
      taxMinor: 0,
    });
  });

  it('never takes off more than the income, and still asks for a return when the price passed 1 million', () => {
    const home = sale(2_000_000, { expensesMinor: r(2_200_000) });

    expect(homeSaleDeductionMinor(home, RULES_2025)).toBe(r(2_000_000));
    expect(onlySale(home).sale).toMatchObject({ declarationRequired: true, taxMinor: 0 });
  });

  it('refuses a negative amount', () => {
    expect(() => homeSaleIncomeMinor(sale(-1), RULES_2025)).toThrow();
    expect(() => homeSaleDeductionMinor(sale(1_000, { expensesMinor: -1 }), RULES_2025)).toThrow();
    expect(() => homeSaleIncomeMinor(sale(1_000, { cadastralMinor: -1 }), RULES_2025)).toThrow();
  });
});

describe('a sale and the deductions of the same year', () => {
  it('lets a home bought take off the tax on a home sold, once the salary is used up', () => {
    // tax code, art. 210 p. 2.2: what the main base cannot take of the deductions for a home
    // goes onto the income from the sale of the same year
    const summary = summarizeDeductionYear(
      {
        incomeMinor: r(600_000),
        social: noSpending,
        longTermSavingsMinor: 0,
        property: {
          purchaseMinor: r(2_000_000),
          mortgageInterestMinor: 0,
          loanBefore2014: false,
          usedBeforeMinor: 0,
        },
        sale: sale(3_000_000),
      },
      RULES_2025,
    );

    expect(summary.refundMinor).toBe(r(78_000));
    expect(summary.sale).toMatchObject({ taxBeforeMinor: r(260_000), taxMinor: r(78_000) });
    expect(summary.property).toEqual({
      availableMinor: r(2_000_000),
      usedMinor: r(2_000_000),
      refundMinor: r(260_000),
      leftMinor: 0,
    });
    expect(summary.balanceMinor).toBe(0);
    expect(partsOf(summary)).toBe(summary.balanceMinor);
  });

  it('turns a tax to pay into money back when the home bought is worth more than the gain', () => {
    // the tax service example of 65 000, with a salary of 1,2 million and a flat of 2 million bought
    const summary = summarizeDeductionYear(
      {
        incomeMinor: r(1_200_000),
        social: noSpending,
        longTermSavingsMinor: 0,
        property: {
          purchaseMinor: r(2_000_000),
          mortgageInterestMinor: 0,
          loanBefore2014: false,
          usedBeforeMinor: 0,
        },
        sale: sale(3_000_000, { expensesMinor: r(2_500_000) }),
      },
      RULES_2025,
    );

    expect(summary.refundMinor).toBe(r(156_000));
    expect(summary.sale?.taxMinor).toBe(0);
    expect(summary.property).toMatchObject({ usedMinor: r(1_700_000), leftMinor: r(300_000) });
    expect(summary.balanceMinor).toBe(r(156_000));
    expect(partsOf(summary)).toBe(summary.balanceMinor);
  });

  it('keeps long-term savings off a sale from 2025, as they were not before', () => {
    // tax code, art. 210 p. 2.2 names art. 218, 219 and 220, not 219.2; until 2025 the sale
    // was a part of the main base, which every deduction reduced
    const year = (rules: typeof RULES_2025) =>
      summarizeDeductionYear(
        {
          incomeMinor: r(300_000),
          social: noSpending,
          longTermSavingsMinor: r(400_000),
          sale: sale(3_000_000),
        },
        rules,
      );

    const newer = year(RULES_2025);
    expect(newer.longTermSavingsRefundMinor).toBe(r(39_000));
    expect(newer.sale?.taxMinor).toBe(r(260_000));
    expect(newer.balanceMinor).toBe(r(39_000 - 260_000));
    expect(partsOf(newer)).toBe(newer.balanceMinor);

    const older = year(RULES_2024);
    expect(older.longTermSavingsRefundMinor).toBe(r(52_000));
    expect(older.sale?.taxMinor).toBe(r(247_000));
    expect(older.balanceMinor).toBe(r(39_000 - 247_000));
    expect(partsOf(older)).toBe(older.balanceMinor);
  });

  it('gives back as much as a year without a sale when there is none', () => {
    const summary = summarizeDeductionYear(
      {
        incomeMinor: r(1_200_000),
        social: { ...noSpending, commonMinor: r(150_000) },
        longTermSavingsMinor: 0,
      },
      RULES_2026,
    );

    expect(summary.sale).toBeUndefined();
    expect(summary.balanceMinor).toBe(summary.refundMinor);
    expect(partsOf(summary)).toBe(summary.balanceMinor);
  });
});
