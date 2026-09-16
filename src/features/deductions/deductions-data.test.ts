import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { saveDeductionYear, type DeductionYearInput } from '@/db/repositories/deductions';
import { addDocument } from '@/db/repositories/documents';
import { loadDeductions } from '@/features/deductions/deductions-data';

const RUB = 100;
// The middle of September: no year boundary is anywhere near.
const NOW = new Date(2026, 8, 16, 12);

function year(value: number, patch: Partial<DeductionYearInput> = {}): DeductionYearInput {
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
    ...patch,
  };
}

beforeEach(async () => {
  await clearAllData();
});

describe('the deductions screen', () => {
  it('offers the year going on and the three years a return can still be filed for', async () => {
    const data = await loadDeductions(NOW);

    expect(data.currentYear).toBe(2026);
    expect(data.years.map((item) => [item.year, item.stage])).toEqual([
      [2026, 'current'],
      [2025, 'open'],
      [2024, 'open'],
      [2023, 'open'],
    ]);
  });

  it('keeps a year someone wrote for after its time is up, and says it is past', async () => {
    await saveDeductionYear(year(2022));

    const data = await loadDeductions(NOW);
    const old = data.years.find((item) => item.year === 2022);

    expect(old?.stage).toBe('expired');
    // there are no rules for 2022, so nothing is counted rather than counted wrong
    expect(old?.rules).toBeUndefined();
    expect(old?.summary).toBeUndefined();
  });

  it('counts a saved year by its own rules', async () => {
    await saveDeductionYear(year(2025));
    await saveDeductionYear(year(2023));

    const data = await loadDeductions(NOW);

    // tax service: 150 000 of the pot on 1,2 million is 19 500; in 2023 the pot was 120 000
    expect(data.years.find((item) => item.year === 2025)?.summary?.refundMinor).toBe(19_500 * RUB);
    expect(data.years.find((item) => item.year === 2023)?.summary?.refundMinor).toBe(15_600 * RUB);
  });

  it('gives each year its own documents and adds up the room they all take', async () => {
    await addDocument({
      year: 2025,
      category: 'schooling',
      fileName: 'договор.pdf',
      mimeType: 'application/pdf',
      content: new Uint8Array([1, 2, 3]).buffer,
    });
    await addDocument({
      year: 2024,
      category: 'treatment',
      fileName: 'справка.pdf',
      mimeType: 'application/pdf',
      content: new Uint8Array([1, 2]).buffer,
    });

    const data = await loadDeductions(NOW);

    expect(data.years.find((item) => item.year === 2025)?.documents.map((paper) => paper.fileName)).toEqual([
      'договор.pdf',
    ]);
    expect(data.documentsSizeBytes).toBe(5);
  });
});
