import { addMonths, monthsOfYear, type IsoMonth } from '@/core/time';
import { db } from '@/db/db';
import { budgetPlanSchema, type BudgetPlan } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export async function listPlansOfMonth(month: IsoMonth): Promise<BudgetPlan[]> {
  return db.budgetPlans.where('month').equals(month).toArray();
}

export async function listPlansOfYear(year: number): Promise<BudgetPlan[]> {
  return db.budgetPlans.where('month').anyOf(monthsOfYear(year)).toArray();
}

/**
 * One line per category and month: writing the same pair twice replaces the line, and
 * a plan of zero removes it — an empty cell and a zero mean the same thing.
 */
export async function setPlan(
  month: IsoMonth,
  categoryId: string,
  amountMinor: number,
): Promise<BudgetPlan | null> {
  const existing = await db.budgetPlans.where('[month+categoryId]').equals([month, categoryId]).first();

  if (amountMinor === 0) {
    if (existing) {
      await db.budgetPlans.delete(existing.id);
      publishAppEvent({ type: 'data-changed' });
    }
    return null;
  }

  const line = parseOrThrow(
    budgetPlanSchema,
    { id: existing?.id ?? crypto.randomUUID(), month, categoryId, amountMinor },
    'План бюджета',
  );

  await db.budgetPlans.put(line);
  publishAppEvent({ type: 'data-changed' });
  return line;
}

export async function copyPlanFromPreviousMonth(month: IsoMonth): Promise<number> {
  const source = await listPlansOfMonth(addMonths(month, -1));
  if (source.length === 0) return 0;

  const copies = source.map((line) => ({
    id: crypto.randomUUID(),
    month,
    categoryId: line.categoryId,
    amountMinor: line.amountMinor,
  }));

  await db.transaction('rw', db.budgetPlans, async () => {
    await db.budgetPlans.where('month').equals(month).delete();
    await db.budgetPlans.bulkAdd(copies);
  });

  publishAppEvent({ type: 'data-changed' });
  return copies.length;
}
