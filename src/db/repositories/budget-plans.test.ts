import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import {
  copyPlanFromPreviousMonth,
  listPlansOfMonth,
  listPlansOfYear,
  setPlan,
} from '@/db/repositories/budget-plans';
import { seedDefaultCategories } from '@/db/repositories/categories';

const RUB = 100;

beforeEach(async () => {
  await clearAllData();
  await seedDefaultCategories();
});

describe('budget plans', () => {
  it('keeps one line per category and month', async () => {
    await setPlan('2026-09', 'groceries', 20_000 * RUB);
    await setPlan('2026-09', 'groceries', 22_000 * RUB);

    const lines = await listPlansOfMonth('2026-09');
    expect(lines).toHaveLength(1);
    expect(lines[0].amountMinor).toBe(22_000 * RUB);
  });

  it('treats a plan of zero as no plan at all', async () => {
    await setPlan('2026-09', 'cafe', 5_000 * RUB);
    expect(await setPlan('2026-09', 'cafe', 0)).toBeNull();
    expect(await listPlansOfMonth('2026-09')).toHaveLength(0);

    // removing a line that was never there is not an error either
    expect(await setPlan('2026-09', 'cafe', 0)).toBeNull();
  });

  it('collects the plan of a whole year', async () => {
    await setPlan('2026-01', 'groceries', 18_000 * RUB);
    await setPlan('2026-12', 'groceries', 25_000 * RUB);
    await setPlan('2027-01', 'groceries', 26_000 * RUB);

    const year = await listPlansOfYear(2026);
    expect(year).toHaveLength(2);
    expect(year.map((line) => line.month).sort()).toEqual(['2026-01', '2026-12']);
  });

  it('copies the plan of the previous month over the current one', async () => {
    await setPlan('2026-08', 'groceries', 20_000 * RUB);
    await setPlan('2026-08', 'transport', 4_000 * RUB);
    // the line of the current month is replaced, not doubled
    await setPlan('2026-09', 'groceries', 1 * RUB);

    expect(await copyPlanFromPreviousMonth('2026-09')).toBe(2);

    const lines = await listPlansOfMonth('2026-09');
    expect(lines).toHaveLength(2);
    expect(lines.find((line) => line.categoryId === 'groceries')?.amountMinor).toBe(20_000 * RUB);
    expect(await db.budgetPlans.count()).toBe(4);
  });

  it('says plainly that there was nothing to copy', async () => {
    expect(await copyPlanFromPreviousMonth('2026-09')).toBe(0);
    expect(await listPlansOfMonth('2026-09')).toHaveLength(0);
  });

  it('refuses a negative plan', async () => {
    await expect(setPlan('2026-09', 'groceries', -100)).rejects.toThrow();
  });
});
