import { beforeEach, describe, expect, it } from 'vitest';

import { monthlyOn } from '@/core/payday';
import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import {
  createIncomeSource,
  deleteIncomeSource,
  listIncomeSources,
  listNextPaydays,
  updateIncomeSource,
} from '@/db/repositories/income-sources';

const RUB = 100;

beforeEach(async () => {
  await clearAllData();
});

describe('income sources', () => {
  it('keeps the order in which they were added', async () => {
    await createIncomeSource({ name: 'Аванс', schedule: monthlyOn(20) });
    await createIncomeSource({ name: 'Зарплата', schedule: monthlyOn(5), amountMinor: 90_000 * RUB });

    const sources = await listIncomeSources();
    expect(sources.map((source) => source.name)).toEqual(['Аванс', 'Зарплата']);
    expect(sources[1].amountMinor).toBe(90_000 * RUB);
  });

  it('keeps a pay that comes twice a month and one that comes every fortnight', async () => {
    const twice = await createIncomeSource({
      name: 'Paycheck',
      schedule: { kind: 'semimonthly', dayOfMonth: 15, secondDayOfMonth: 31 },
      amountMinor: 2_000_00,
    });
    const fortnight = await createIncomeSource({
      name: 'Paycheck',
      schedule: { kind: 'biweekly', firstDate: '2026-09-04' },
    });

    expect(twice.schedule).toEqual({ kind: 'semimonthly', dayOfMonth: 15, secondDayOfMonth: 31 });
    expect(fortnight.schedule).toEqual({ kind: 'biweekly', firstDate: '2026-09-04' });
    expect(await listNextPaydays('2026-09-05')).toMatchObject([
      { date: '2026-09-15' },
      { date: '2026-09-18' },
    ]);
  });

  it('refuses a schedule that does not hold together, and an empty name', async () => {
    await expect(createIncomeSource({ name: 'Аванс', schedule: monthlyOn(0) })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(createIncomeSource({ name: 'Аванс', schedule: monthlyOn(32) })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      createIncomeSource({
        name: 'Paycheck',
        schedule: { kind: 'semimonthly', dayOfMonth: 15, secondDayOfMonth: 40 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createIncomeSource({ name: 'Paycheck', schedule: { kind: 'biweekly', firstDate: '04.09.2026' } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(createIncomeSource({ name: '  ', schedule: monthlyOn(10) })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('changes a source and hides an archived one', async () => {
    const source = await createIncomeSource({ name: 'Подработка', schedule: monthlyOn(15) });

    const renamed = await updateIncomeSource(source.id, { name: 'Аренда', schedule: monthlyOn(1) });
    expect(renamed.name).toBe('Аренда');
    expect(renamed.schedule).toEqual({ kind: 'monthly', dayOfMonth: 1 });
    expect(renamed.createdAt).toBe(source.createdAt);

    await updateIncomeSource(source.id, { archived: true });
    expect(await listIncomeSources()).toHaveLength(0);
    expect(await listIncomeSources({ includeArchived: true })).toHaveLength(1);
  });

  it('reports a source that is not there instead of creating one', async () => {
    await expect(updateIncomeSource('нет-такого', { name: 'Что-то' })).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });

  it('deletes a source', async () => {
    const source = await createIncomeSource({ name: 'Премия', schedule: monthlyOn(25) });
    await deleteIncomeSource(source.id);
    expect(await db.incomeSources.count()).toBe(0);
  });

  it('counts the days to the next payment of every source, nearest first', async () => {
    await createIncomeSource({ name: 'Зарплата', schedule: monthlyOn(5) });
    await createIncomeSource({ name: 'Аванс', schedule: monthlyOn(20) });

    const paydays = await listNextPaydays('2026-09-21');
    expect(paydays.map((payday) => [payday.source.name, payday.date, payday.inDays])).toEqual([
      ['Зарплата', '2026-10-05', 14],
      ['Аванс', '2026-10-20', 29],
    ]);
  });

  it('leaves an archived source out of the countdown', async () => {
    const source = await createIncomeSource({ name: 'Старая работа', schedule: monthlyOn(10) });
    await updateIncomeSource(source.id, { archived: true });

    expect(await listNextPaydays('2026-09-21')).toEqual([]);
  });
});
