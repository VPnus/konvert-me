import { describe, expect, it } from 'vitest';

import type { DeductionYear } from '@/db/models';
import { deductionReminder } from '@/features/deductions/reminder';

const RUB = 100;

function year(value: number, patch: Partial<DeductionYear> = {}): DeductionYear {
  return {
    year: value,
    incomeMinor: 1_200_000 * RUB,
    spending: {
      treatmentMinor: 0,
      educationMinor: 300_000 * RUB,
      sportMinor: 0,
      insuranceMinor: 0,
      childEducationMinor: [],
      expensiveTreatmentMinor: 0,
    },
    longTermSavingsMinor: 0,
    status: 'draft',
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

const sold = {
  priceMinor: 3_000_000 * RUB,
  cadastralMinor: 0,
  expensesMinor: 2_500_000 * RUB,
  ownedLongEnough: false,
};

describe('the reminder of a return for the year past', () => {
  it('asks in January to look at the year that ended, when nothing is written for it', () => {
    expect(deductionReminder('2026-01-10', [], null)).toEqual({ kind: 'start', year: 2025 });
  });

  it('says nothing about an empty year after January, nor in the rest of the year', () => {
    expect(deductionReminder('2026-02-01', [], null)).toBeNull();
    expect(deductionReminder('2026-12-31', [], null)).toBeNull();
  });

  it('keeps quiet once hidden for that year, and speaks again about the next one', () => {
    expect(deductionReminder('2026-01-10', [], '2025:start')).toBeNull();
    expect(deductionReminder('2027-01-10', [], '2025:start')).toEqual({ kind: 'start', year: 2026 });
  });

  it('does not let a hidden January look hide the return a sale requires', () => {
    expect(deductionReminder('2026-02-10', [year(2025, { sale: sold })], '2025:start')).toMatchObject({
      kind: 'sale',
    });
  });

  it('names the money of a year written but not filed, until 30 April', () => {
    // the tax service example: 300 000 of schooling on 100 000 a month returns 19 500
    expect(deductionReminder('2026-03-15', [year(2025)], null)).toEqual({
      kind: 'refund',
      year: 2025,
      amountMinor: 19_500 * RUB,
    });
    expect(deductionReminder('2026-05-01', [year(2025)], null)).toBeNull();
  });

  it('says nothing about a year already filed or paid back', () => {
    expect(deductionReminder('2026-01-10', [year(2025, { status: 'filed' })], null)).toBeNull();
    expect(deductionReminder('2026-01-10', [year(2025, { status: 'refunded' })], null)).toBeNull();
  });

  it('says nothing about a year written that gives nothing back', () => {
    expect(
      deductionReminder(
        '2026-01-10',
        [year(2025, { spending: { ...year(2025).spending, educationMinor: 0 } })],
        null,
      ),
    ).toBeNull();
  });

  it('warns of the return a sale requires, by its day, even when there is money back too', () => {
    expect(deductionReminder('2026-04-30', [year(2025, { sale: sold })], null)).toEqual({
      kind: 'sale',
      year: 2025,
      fileBy: '04-30',
    });
    expect(deductionReminder('2026-05-01', [year(2025, { sale: sold })], null)).toBeNull();
  });

  it('asks nothing about a sale owned long enough', () => {
    const exempt = year(2025, {
      spending: { ...year(2025).spending, educationMinor: 0 },
      sale: { ...sold, ownedLongEnough: true },
    });

    expect(deductionReminder('2026-01-10', [exempt], null)).toBeNull();
  });

  it('looks only at the year that has just ended', () => {
    expect(deductionReminder('2026-01-10', [year(2024), year(2026)], null)).toEqual({
      kind: 'start',
      year: 2025,
    });
  });
});
