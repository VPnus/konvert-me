import { describe, expect, it } from 'vitest';

import { RULES_2023 } from '@/core/rules/2023';
import { RULES_2025 } from '@/core/rules/2025';
import { checklistFor } from '@/features/deductions/checklist';

const RUB = 100;

const nothing = {
  spending: {
    treatmentMinor: 0,
    educationMinor: 0,
    sportMinor: 0,
    insuranceMinor: 0,
    childEducationMinor: [],
    expensiveTreatmentMinor: 0,
  },
  longTermSavingsMinor: 0,
};

const ids = (groups: ReturnType<typeof checklistFor>) => groups.map((group) => group.id);

describe('the checklist of papers', () => {
  it('asks for nothing when nothing is claimed', () => {
    expect(checklistFor(nothing, RULES_2025)).toEqual([]);
  });

  it('asks for one certificate of payment for treatment from 2024, and says it may not be needed', () => {
    // tax service: from the spending of 2024, only the certificate of payment is attached
    const groups = checklistFor(
      { ...nothing, spending: { ...nothing.spending, treatmentMinor: 50_000 * RUB } },
      RULES_2025,
    );

    expect(ids(groups)).toEqual(['general', 'treatment', 'medicine', 'relatives']);
    expect(groups.find((group) => group.id === 'treatment')).toMatchObject({
      items: ['treatmentCertificate'],
      certificate: true,
    });
  });

  it('asks for the contract, the certificate and the licence of the lesson for 2023', () => {
    // lesson 3.7: treatment in a clinic
    const groups = checklistFor(
      { ...nothing, spending: { ...nothing.spending, treatmentMinor: 50_000 * RUB } },
      RULES_2023,
    );

    expect(groups.find((group) => group.id === 'treatment')).toMatchObject({
      items: ['treatmentContract', 'treatmentCertificate', 'treatmentLicense'],
      certificate: false,
    });
  });

  it('asks nothing about children the employer already gave the deduction for', () => {
    const children = {
      items: [{ order: 1, disabled: true, fromMonth: 1, toMonth: 12 }],
      double: true,
      guardian: false,
      appliedByEmployer: true,
    };

    expect(checklistFor({ ...nothing, children }, RULES_2025)).toEqual([]);
    expect(
      checklistFor({ ...nothing, children: { ...children, appliedByEmployer: false } }, RULES_2025).find(
        (group) => group.id === 'kids',
      )?.items,
    ).toEqual(['kidsBirth', 'kidsDisability', 'kidsStudent', 'kidsDouble']);
  });

  it('asks for the loan papers only when interest was paid', () => {
    const property = {
      purchaseMinor: 2_000_000 * RUB,
      mortgageInterestMinor: 0,
      loanBefore2014: false,
      usedBeforeMinor: 0,
    };

    expect(ids(checklistFor({ ...nothing, property }, RULES_2025))).toEqual(['general', 'property']);
    expect(
      ids(
        checklistFor({ ...nothing, property: { ...property, mortgageInterestMinor: 1 * RUB } }, RULES_2025),
      ),
    ).toEqual(['general', 'property', 'mortgage']);
  });

  it('asks for the sale papers only when the sale needs a return', () => {
    const sale = {
      priceMinor: 3_000_000 * RUB,
      cadastralMinor: 0,
      expensesMinor: 2_500_000 * RUB,
      ownedLongEnough: false,
    };

    expect(
      checklistFor({ ...nothing, sale }, RULES_2025).find((group) => group.id === 'sale')?.items,
    ).toEqual(['saleContract', 'salePayment', 'saleExpenses']);
    expect(checklistFor({ ...nothing, sale: { ...sale, ownedLongEnough: true } }, RULES_2025)).toEqual([]);
    // tax service: within 1 million there is nothing to declare
    expect(checklistFor({ ...nothing, sale: { ...sale, priceMinor: 900_000 * RUB } }, RULES_2025)).toEqual(
      [],
    );
  });

  it('asks for the investment account papers of the lesson', () => {
    expect(ids(checklistFor({ ...nothing, longTermSavingsMinor: 400_000 * RUB }, RULES_2025))).toEqual([
      'general',
      'savings',
    ]);
  });
});
