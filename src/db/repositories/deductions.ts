/**
 * Deduction years (stage 7): what a person claims for one tax year. There is one
 * return per year, so the year is the key and saving it again replaces it.
 */

import type { DeductionClaim } from '@/core/deductions';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { deductionYearSchema, type DeductionYear } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { fill, strings } from '@/i18n';
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
  const next = parseOrThrow(
    deductionYearSchema,
    { ...input, createdAt: now, updatedAt: now },
    strings.data.subjects.deductionYear,
  );

  const current = await db.deductionYears.get(next.year);
  // The answers are saved from the form, the papers gathered are ticked one by one: saving the
  // answers keeps the ticks.
  const saved = current
    ? { ...next, checklist: next.checklist ?? current.checklist, createdAt: current.createdAt }
    : next;

  await db.deductionYears.put(saved);
  publishAppEvent({ type: 'data-changed' });
  return saved;
}

/**
 * Ticks a paper of the checklist as gathered or not. Read and written in one transaction, so two
 * quick ticks never lose one another.
 */
export async function setChecklistItem(year: number, key: string, gathered: boolean): Promise<void> {
  await db.transaction('rw', db.deductionYears, async () => {
    const current = await db.deductionYears.get(year);
    if (!current) throw new RepositoryError(fill(strings.data.notFound.deductionYear, { year }));

    const keys = new Set(current.checklist ?? []);
    if (gathered) keys.add(key);
    else keys.delete(key);

    const next = parseOrThrow(
      deductionYearSchema,
      { ...current, checklist: [...keys].sort(), updatedAt: Date.now() },
      strings.data.subjects.deductionYear,
    );
    await db.deductionYears.put(next);
  });
  publishAppEvent({ type: 'data-changed' });
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
export function toDeductionClaim(
  year: Pick<
    DeductionYear,
    'incomeMinor' | 'spending' | 'longTermSavingsMinor' | 'property' | 'children' | 'sale'
  >,
): DeductionClaim {
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
    children: year.children,
    sale: year.sale,
  };
}
