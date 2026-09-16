/**
 * Deduction years (stage 7): what a person claims for one tax year. There is one
 * return per year, so the year is the key and saving it again replaces it.
 */

import type { DeductionClaim } from '@/core/deductions';
import { db } from '@/db/db';
import { deductionYearSchema, type DeductionYear } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export type DeductionYearInput = Omit<DeductionYear, 'createdAt' | 'updatedAt'>;

/** The newest year first: that is the one a return is being made for. */
export async function listDeductionYears(): Promise<DeductionYear[]> {
  return (await db.deductionYears.toArray()).sort((a, b) => b.year - a.year);
}

export async function getDeductionYear(year: number): Promise<DeductionYear | undefined> {
  return db.deductionYears.get(year);
}

export async function saveDeductionYear(input: DeductionYearInput): Promise<DeductionYear> {
  const now = Date.now();
  // Checked before the database is asked anything: a key that is not a year must not reach it.
  const next = parseOrThrow(deductionYearSchema, { ...input, createdAt: now, updatedAt: now }, 'Год вычетов');

  const current = await db.deductionYears.get(next.year);
  const saved = current ? { ...next, createdAt: current.createdAt } : next;

  await db.deductionYears.put(saved);
  publishAppEvent({ type: 'data-changed' });
  return saved;
}

/** A year goes with its papers: a receipt for a year nobody claims is only taking room. */
export async function deleteDeductionYear(year: number): Promise<void> {
  await db.transaction('rw', db.deductionYears, db.documents, db.documentFiles, async () => {
    const ids = await db.documents.where('year').equals(year).primaryKeys();
    await db.documentFiles.bulkDelete(ids);
    await db.documents.bulkDelete(ids);
    await db.deductionYears.delete(year);
  });
  publishAppEvent({ type: 'data-changed' });
}

/** A stored year in the terms of the law: the four pooled kinds of spending become one pot. */
export function toDeductionClaim(year: DeductionYear): DeductionClaim {
  const {
    treatmentMinor,
    educationMinor,
    sportMinor,
    insuranceMinor,
    childEducationMinor,
    expensiveTreatmentMinor,
  } = year.spending;

  return {
    incomeMinor: year.incomeMinor,
    social: {
      commonMinor: treatmentMinor + educationMinor + sportMinor + insuranceMinor,
      childEducationMinor,
      expensiveTreatmentMinor,
    },
    longTermSavingsMinor: year.longTermSavingsMinor,
    property: year.property,
  };
}
