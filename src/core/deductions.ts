/**
 * Tax deductions — what a deduction is worth and how much of a year's spending
 * counts towards one.
 *
 * Section 5 of docs/PLAN.md has no formulas for this: stage 7 is accepted on the
 * examples of the tax service, and the tests say which example each case comes from.
 * The numbers themselves — limits, rates, borders — come from src/core/rules.
 */

import { assertNonNegativeMinor, type Minor } from './money';
import type { TaxBand, YearRules } from './rules/types';

/** Rates are kept as basis points inside, so a slice of income times a rate stays whole. */
const BASIS_POINTS = 10_000;
/** A whole rouble in kopecks times basis points: the unit the tax is rounded in. */
const ROUBLE_IN_TAX_UNITS = 100 * BASIS_POINTS;

/**
 * Income tax on a year of income under the progressive scale: each band takes its
 * rate only from the part of the income that lies inside it.
 *
 * Tax code, art. 52 p. 6: the tax is counted in whole roubles — under 50 kopecks is
 * dropped, 50 and over rounds up. The sum is carried in whole units and divided once,
 * so no rate like 0,13 ever meets a binary fraction on the way.
 */
export function incomeTaxMinor(incomeMinor: number, bands: readonly TaxBand[]): Minor {
  assertNonNegativeMinor(incomeMinor, 'incomeMinor');

  let taxUnits = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const from = bands[index].fromMinor;
    if (incomeMinor <= from) break;

    const to = index + 1 < bands.length ? bands[index + 1].fromMinor : Infinity;
    taxUnits += (Math.min(incomeMinor, to) - from) * Math.round(bands[index].rate * BASIS_POINTS);
  }

  return Math.floor((taxUnits + ROUBLE_IN_TAX_UNITS / 2) / ROUBLE_IN_TAX_UNITS) * 100;
}

/**
 * What a deduction gives back: the tax that was paid on the income, less the tax the
 * income would have paid with the deduction taken off it. The deduction comes off the
 * top, so above a border it returns the higher rate; and it can never give back more
 * than was paid in the first place.
 */
export function refundMinor(incomeMinor: number, deductionMinor: number, bands: readonly TaxBand[]): Minor {
  assertNonNegativeMinor(deductionMinor, 'deductionMinor');

  const paid = incomeTaxMinor(incomeMinor, bands);
  const owed = incomeTaxMinor(Math.max(0, incomeMinor - deductionMinor), bands);
  return paid - owed;
}

/** A year of spending that social deductions are made of. */
export interface SocialSpending {
  /** Treatment, medicine, one's own schooling, sport, voluntary insurance: one shared pot. */
  readonly commonMinor: number;
  /** Schooling paid for each child, one entry per child. */
  readonly childEducationMinor: readonly number[];
  /** Treatment from the government's list of expensive ones: no limit at all. */
  readonly expensiveTreatmentMinor: number;
}

/**
 * The social deduction of a year: the shared pot up to its limit, each child's
 * schooling up to its own limit, and expensive treatment in full.
 */
export function socialDeductionMinor(
  spending: SocialSpending,
  rules: Pick<YearRules, 'socialDeductionLimitMinor' | 'childEducationLimitMinor'>,
): Minor {
  assertNonNegativeMinor(spending.commonMinor, 'commonMinor');
  assertNonNegativeMinor(spending.expensiveTreatmentMinor, 'expensiveTreatmentMinor');

  const childLimit = rules.childEducationLimitMinor.value;
  let children = 0;
  for (const paid of spending.childEducationMinor) {
    assertNonNegativeMinor(paid, 'childEducationMinor');
    children += Math.min(paid, childLimit);
  }

  return (
    Math.min(spending.commonMinor, rules.socialDeductionLimitMinor.value) +
    children +
    spending.expensiveTreatmentMinor
  );
}

/**
 * The years a return can still be filed for: as far back as the law allows, and not
 * the current year — a year is claimed only once it is over.
 */
export function claimableYears(currentYear: number, yearsBack: number): number[] {
  return Array.from({ length: yearsBack }, (_, index) => currentYear - yearsBack + index);
}

/** What was spent on a home that a property deduction is made of. */
export interface PropertyClaim {
  /** What was paid for the home itself. */
  readonly purchaseMinor: number;
  /** Interest paid on the loan for it so far. */
  readonly mortgageInterestMinor: number;
  /** A loan taken before 2014 has no limit on its interest. */
  readonly loanBefore2014: boolean;
}

type PropertyLimits = Pick<YearRules, 'propertyPurchaseLimitMinor' | 'mortgageInterestLimitMinor'>;

/** A home's deduction in the two parts a return keeps apart: the home itself and the interest. */
export interface PropertyParts {
  readonly purchaseMinor: Minor;
  readonly interestMinor: Minor;
}

/** The two parts of the deduction a home gives, each up to its own limit. */
export function propertyDeductionPartsMinor(claim: PropertyClaim, rules: PropertyLimits): PropertyParts {
  assertNonNegativeMinor(claim.purchaseMinor, 'purchaseMinor');
  assertNonNegativeMinor(claim.mortgageInterestMinor, 'mortgageInterestMinor');

  return {
    purchaseMinor: Math.min(claim.purchaseMinor, rules.propertyPurchaseLimitMinor.value),
    interestMinor: claim.loanBefore2014
      ? claim.mortgageInterestMinor
      : Math.min(claim.mortgageInterestMinor, rules.mortgageInterestLimitMinor.value),
  };
}

/** The property deduction a home gives: the purchase and the interest, each up to its limit. */
export function propertyDeductionMinor(claim: PropertyClaim, rules: PropertyLimits): Minor {
  const parts = propertyDeductionPartsMinor(claim, rules);
  return parts.purchaseMinor + parts.interestMinor;
}

/** What earlier returns took of a home, part by part. */
export interface PropertyUsedBefore {
  readonly usedBeforePurchaseMinor: number;
  readonly usedBeforeInterestMinor: number;
}

/**
 * One sum of what earlier returns took of a home, split into its two parts — for answers kept
 * before the two were asked for apart. A return takes the home itself first and the interest only
 * after it, so the sum goes to the home up to its deduction and the rest to the interest. What is
 * left of the home comes out the same as it was counted from the one sum.
 *
 * Without the rules of the year the home is not capped by its limit, only by what it cost.
 */
export function splitUsedBefore(
  claim: PropertyClaim,
  usedBeforeMinor: number,
  rules: PropertyLimits | undefined,
): PropertyUsedBefore {
  assertNonNegativeMinor(usedBeforeMinor, 'usedBeforeMinor');
  assertNonNegativeMinor(claim.purchaseMinor, 'purchaseMinor');

  const purchase = rules ? propertyDeductionPartsMinor(claim, rules).purchaseMinor : claim.purchaseMinor;
  const onPurchase = Math.min(usedBeforeMinor, purchase);
  return { usedBeforePurchaseMinor: onPurchase, usedBeforeInterestMinor: usedBeforeMinor - onPurchase };
}

/** One year a property deduction can be spent against. */
export interface TaxYear {
  readonly year: number;
  readonly incomeMinor: number;
  /**
   * Deductions of the same year that do not carry over — social, standard. The law sets
   * no order, but those die with their year and this one does not, so they go first.
   */
  readonly otherDeductionsMinor: number;
  /** The tax scale of that year: a refund is counted by the rules it was paid under. */
  readonly bands: readonly TaxBand[];
}

export interface CarriedYear {
  readonly year: number;
  /** How much of the deduction the year took. */
  readonly usedMinor: number;
  /** What that part gives back. */
  readonly refundMinor: number;
  /** What is left for the years after. */
  readonly leftMinor: number;
}

/**
 * Tax code, art. 220 p. 10: a year takes as much of the property deduction as its
 * income allows, and the rest moves on until it is used in full. Years go oldest first.
 */
export function carryPropertyDeduction(deductionMinor: number, years: readonly TaxYear[]): CarriedYear[] {
  assertNonNegativeMinor(deductionMinor, 'deductionMinor');

  let left = deductionMinor;
  return years.map((taxYear, index) => {
    if (index > 0 && taxYear.year <= years[index - 1].year) {
      throw new RangeError(`Years must go in order: ${years[index - 1].year}, then ${taxYear.year}`);
    }
    assertNonNegativeMinor(taxYear.incomeMinor, 'incomeMinor');
    assertNonNegativeMinor(taxYear.otherDeductionsMinor, 'otherDeductionsMinor');

    const base = Math.max(0, taxYear.incomeMinor - taxYear.otherDeductionsMinor);
    const used = Math.min(left, base);
    left -= used;

    return {
      year: taxYear.year,
      usedMinor: used,
      refundMinor: refundMinor(base, used, taxYear.bands),
      leftMinor: left,
    };
  });
}

const MONTHS = 12;

function assertMonth(month: number, label: string): void {
  if (!Number.isInteger(month) || month < 1 || month > MONTHS) {
    throw new RangeError(`${label}: a month must be from 1 to 12, got ${month}`);
  }
}

/** One child the standard deduction is given for. */
export interface ChildRight {
  /** Place by birth among all the children, grown ones included: 1, 2, and 3 for the third and on. */
  readonly order: number;
  /** A disabled child, or a full-time student under 24 of disability group I or II. */
  readonly disabled: boolean;
  /**
   * The months of the year the right lasted: from the month of birth or adoption to the end
   * of the year the child turned 18 — or 24 for a full-time student.
   */
  readonly fromMonth: number;
  readonly toMonth: number;
}

export interface ChildrenClaim {
  readonly items: readonly ChildRight[];
  /** The only parent, or the other parent gave theirs up: the deduction is doubled. */
  readonly double: boolean;
  /** A guardian, a trustee or a foster parent: before 2025, half as much for a disabled child. */
  readonly guardian: boolean;
  /** The employer already took it off the income through the year, so the tax paid was lower. */
  readonly appliedByEmployer: boolean;
}

/**
 * The standard deduction for children over a year. Tax code, art. 218 p. 1 pp. 4: an amount
 * a month by each child's place by birth, a disabled child's amount on top of it, doubled for
 * the only parent — and none from the month the income since January passes the border.
 *
 * The months of the income are not known, so it is taken as coming in evenly: a month keeps
 * the right while that many twelfths of the year's income stay within the border.
 */
export function childDeductionMinor(
  claim: ChildrenClaim,
  incomeMinor: number,
  rules: Pick<YearRules, 'childDeduction'>,
): Minor {
  assertNonNegativeMinor(incomeMinor, 'incomeMinor');
  const norm = rules.childDeduction.value;

  let total = 0;
  for (const child of claim.items) {
    if (!Number.isInteger(child.order) || child.order < 1) {
      throw new RangeError(`The order of a child must be a whole number from 1, got ${child.order}`);
    }
    assertMonth(child.fromMonth, 'fromMonth');
    assertMonth(child.toMonth, 'toMonth');
    if (child.fromMonth > child.toMonth) {
      throw new RangeError(`Months are out of order: ${child.fromMonth}, then ${child.toMonth}`);
    }

    const byOrder =
      child.order === 1 ? norm.firstMinor : child.order === 2 ? norm.secondMinor : norm.thirdAndOnMinor;
    const disabled = child.disabled
      ? claim.guardian
        ? norm.disabledGuardianMinor
        : norm.disabledParentMinor
      : 0;

    for (let month = child.fromMonth; month <= child.toMonth; month += 1) {
      // month × income / 12 ≤ border, kept in whole kopecks
      if (month * incomeMinor <= norm.incomeCapMinor * MONTHS) total += byOrder + disabled;
    }
  }

  return claim.double ? total * 2 : total;
}

/** A home sold within the year. */
export interface HomeSale {
  readonly priceMinor: number;
  /** The cadastral value on 1 January of the year the sale was registered; 0 when not known. */
  readonly cadastralMinor: number;
  /** What buying it cost, with the papers to show for it; 0 when there are none. */
  readonly expensesMinor: number;
  /** Owned for the minimum term or longer: the sale is free of tax. */
  readonly ownedLongEnough: boolean;
}

/**
 * The income a sale is taxed on. Tax code, art. 214.10: the price, but not less than the
 * cadastral value times its share — a home sold on paper for next to nothing is still taxed.
 */
export function homeSaleIncomeMinor(sale: HomeSale, rules: Pick<YearRules, 'homeSale'>): Minor {
  assertNonNegativeMinor(sale.priceMinor, 'priceMinor');
  assertNonNegativeMinor(sale.cadastralMinor, 'cadastralMinor');

  const share = Math.round(rules.homeSale.value.cadastralShare * BASIS_POINTS);
  return Math.max(sale.priceMinor, Math.round((sale.cadastralMinor * share) / BASIS_POINTS));
}

/**
 * What a sale's income is reduced by. Tax code, art. 220 p. 2: the fixed amount or the cost of
 * buying, whichever the person chooses — so whichever is more — and never more than the income.
 */
export function homeSaleDeductionMinor(sale: HomeSale, rules: Pick<YearRules, 'homeSale'>): Minor {
  assertNonNegativeMinor(sale.expensesMinor, 'expensesMinor');

  const deduction = Math.max(rules.homeSale.value.deductionLimitMinor, sale.expensesMinor);
  return Math.min(deduction, homeSaleIncomeMinor(sale, rules));
}

/** Contributions to an investment account and other long-term savings, up to the yearly limit. */
export function longTermSavingsDeductionMinor(
  contributionsMinor: number,
  rules: Pick<YearRules, 'longTermSavingsLimitMinor'>,
): Minor {
  assertNonNegativeMinor(contributionsMinor, 'longTermSavingsMinor');
  return Math.min(contributionsMinor, rules.longTermSavingsLimitMinor.value);
}

/** What a person claims for one year, in the terms of the law. */
export interface DeductionClaim {
  /** Income before tax, taxed on the progressive scale. */
  readonly incomeMinor: number;
  readonly social: SocialSpending;
  /** Contributions to an investment account and other long-term savings. */
  readonly longTermSavingsMinor: number;
  /**
   * A home, as this year's return states it: what earlier returns took is taken off each part.
   * The return keeps the home itself and the interest apart, and what is left of each as well.
   */
  readonly property?: PropertyClaim & PropertyUsedBefore;
  readonly children?: ChildrenClaim;
  readonly sale?: HomeSale;
}

export interface HomeSaleSummary {
  /** Owned long enough: there is no tax, and nothing about the sale to declare. */
  readonly exempt: boolean;
  /** A return must be filed for the sale, even if its tax comes out as nothing. */
  readonly declarationRequired: boolean;
  readonly incomeMinor: Minor;
  readonly deductionMinor: Minor;
  /** The tax on the sale before the other deductions of the year reached it. */
  readonly taxBeforeMinor: Minor;
  /** The tax on the sale that is left to pay. */
  readonly taxMinor: Minor;
}

/** One part of a home's deduction over the year. */
export interface PropertyPart {
  /** What was left of the part when the year began. */
  readonly availableMinor: Minor;
  readonly usedMinor: Minor;
  /** What moves on to the returns of the years after. */
  readonly leftMinor: Minor;
}

export interface DeductionSummary {
  /** The tax taken from the income over the year — less, if the employer gave the child deduction. */
  readonly taxPaidMinor: Minor;
  readonly childDeductionMinor: Minor;
  readonly childRefundMinor: Minor;
  readonly socialDeductionMinor: Minor;
  readonly socialRefundMinor: Minor;
  readonly longTermSavingsDeductionMinor: Minor;
  readonly longTermSavingsRefundMinor: Minor;
  readonly property?: {
    /** What was left of the home's deduction when the year began. */
    readonly availableMinor: Minor;
    readonly usedMinor: Minor;
    readonly refundMinor: Minor;
    /** What moves on to the returns of the years after. */
    readonly leftMinor: Minor;
    /** The home itself: the return takes it first. */
    readonly purchase: PropertyPart;
    /** The interest: it gets only what the income has left after the home itself. */
    readonly interest: PropertyPart;
  };
  readonly sale?: HomeSaleSummary;
  /** Everything the year gives back from the tax paid — never more than that tax. */
  readonly refundMinor: Minor;
  /** What comes back less the tax on a sale: below zero, the year owes rather than gets. */
  readonly balanceMinor: number;
}

/**
 * One year of deductions, the way a return is counted.
 *
 * The deductions that die with the year — for children, social ones, long-term savings —
 * are spent first; the home takes what is left, and its rest moves on. Each comes off the
 * top of the income; what the income cannot take goes onto the income from a sale, where
 * the law lets it (tax code, art. 210 p. 2.2).
 *
 * A part's refund is what it takes off the tax — the income's and the sale's — after the
 * parts before it. So the parts, less the tax on the sale, add up to the balance of the year.
 */
export function summarizeDeductionYear(claim: DeductionClaim, rules: YearRules): DeductionSummary {
  const bands = rules.incomeTaxBands.value;
  const saleBands = rules.homeSaleTaxBands.value;
  assertNonNegativeMinor(claim.incomeMinor, 'incomeMinor');

  let sale: Omit<HomeSaleSummary, 'taxMinor'> | undefined;
  let incomeLeft = claim.incomeMinor;
  let saleLeft = 0;
  if (claim.sale) {
    const income = homeSaleIncomeMinor(claim.sale, rules);
    const deduction = claim.sale.ownedLongEnough ? 0 : homeSaleDeductionMinor(claim.sale, rules);
    saleLeft = claim.sale.ownedLongEnough ? 0 : income - deduction;
    sale = {
      exempt: claim.sale.ownedLongEnough,
      declarationRequired: !claim.sale.ownedLongEnough && income > rules.homeSale.value.deductionLimitMinor,
      incomeMinor: income,
      deductionMinor: deduction,
      taxBeforeMinor: incomeTaxMinor(saleLeft, saleBands),
    };
  }

  const taxNow = () => incomeTaxMinor(incomeLeft, bands) + incomeTaxMinor(saleLeft, saleBands);

  /** Takes a deduction off the income, then what is left of it off the sale, if it may go there. */
  const spend = (amountMinor: number, ontoSale: boolean) => {
    const before = taxNow();
    const fromIncome = Math.min(amountMinor, incomeLeft);
    incomeLeft -= fromIncome;
    const fromSale = ontoSale ? Math.min(amountMinor - fromIncome, saleLeft) : 0;
    saleLeft -= fromSale;
    return { usedMinor: fromIncome + fromSale, fromIncomeMinor: fromIncome, refundMinor: before - taxNow() };
  };

  const taxOnIncome = incomeTaxMinor(claim.incomeMinor, bands);
  const childDeduction = claim.children ? childDeductionMinor(claim.children, claim.incomeMinor, rules) : 0;
  const children = spend(childDeduction, true);
  // What the employer already took off lowered the tax paid; it is not given back a second time.
  const givenByEmployer = claim.children?.appliedByEmployer
    ? taxOnIncome - incomeTaxMinor(claim.incomeMinor - children.fromIncomeMinor, bands)
    : 0;

  const social = socialDeductionMinor(claim.social, rules);
  const socialPart = spend(social, true);
  const savings = longTermSavingsDeductionMinor(claim.longTermSavingsMinor, rules);
  const savingsPart = spend(savings, rules.saleIncomeInMainBase.value);

  let property: DeductionSummary['property'];
  if (claim.property) {
    const { usedBeforePurchaseMinor, usedBeforeInterestMinor } = claim.property;
    assertNonNegativeMinor(usedBeforePurchaseMinor, 'usedBeforePurchaseMinor');
    assertNonNegativeMinor(usedBeforeInterestMinor, 'usedBeforeInterestMinor');

    const parts = propertyDeductionPartsMinor(claim.property, rules);
    const purchase = Math.max(0, parts.purchaseMinor - usedBeforePurchaseMinor);
    const interest = Math.max(0, parts.interestMinor - usedBeforeInterestMinor);
    const part = spend(purchase + interest, true);
    // 3-NDFL, appendix 7: the interest taken in a year is at most the base less the home itself.
    const purchaseUsed = Math.min(part.usedMinor, purchase);
    const interestUsed = part.usedMinor - purchaseUsed;

    property = {
      availableMinor: purchase + interest,
      usedMinor: part.usedMinor,
      refundMinor: part.refundMinor,
      leftMinor: purchase + interest - part.usedMinor,
      purchase: { availableMinor: purchase, usedMinor: purchaseUsed, leftMinor: purchase - purchaseUsed },
      interest: { availableMinor: interest, usedMinor: interestUsed, leftMinor: interest - interestUsed },
    };
  }

  const taxPaid = taxOnIncome - givenByEmployer;
  const refund = taxPaid - incomeTaxMinor(incomeLeft, bands);
  const saleTax = incomeTaxMinor(saleLeft, saleBands);

  return {
    taxPaidMinor: taxPaid,
    childDeductionMinor: childDeduction,
    childRefundMinor: children.refundMinor - givenByEmployer,
    socialDeductionMinor: social,
    socialRefundMinor: socialPart.refundMinor,
    longTermSavingsDeductionMinor: savings,
    longTermSavingsRefundMinor: savingsPart.refundMinor,
    property,
    sale: sale && { ...sale, taxMinor: saleTax },
    refundMinor: refund,
    balanceMinor: refund - saleTax,
  };
}
