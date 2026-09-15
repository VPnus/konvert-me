import { beforeEach, describe, expect, it } from 'vitest';

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
    await createIncomeSource({ name: 'Аванс', dayOfMonth: 20 });
    await createIncomeSource({ name: 'Зарплата', dayOfMonth: 5, amountMinor: 90_000 * RUB });

    const sources = await listIncomeSources();
    expect(sources.map((source) => source.name)).toEqual(['Аванс', 'Зарплата']);
    expect(sources[1].amountMinor).toBe(90_000 * RUB);
  });

  it('refuses a day that is not a day of a month, and an empty name', async () => {
    await expect(createIncomeSource({ name: 'Аванс', dayOfMonth: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(createIncomeSource({ name: 'Аванс', dayOfMonth: 32 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(createIncomeSource({ name: '  ', dayOfMonth: 10 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('changes a source and hides an archived one', async () => {
    const source = await createIncomeSource({ name: 'Подработка', dayOfMonth: 15 });

    const renamed = await updateIncomeSource(source.id, { name: 'Аренда', dayOfMonth: 1 });
    expect(renamed.name).toBe('Аренда');
    expect(renamed.dayOfMonth).toBe(1);
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
    const source = await createIncomeSource({ name: 'Премия', dayOfMonth: 25 });
    await deleteIncomeSource(source.id);
    expect(await db.incomeSources.count()).toBe(0);
  });

  it('counts the days to the next payment of every source, nearest first', async () => {
    await createIncomeSource({ name: 'Зарплата', dayOfMonth: 5 });
    await createIncomeSource({ name: 'Аванс', dayOfMonth: 20 });

    const paydays = await listNextPaydays('2026-09-21');
    expect(paydays.map((payday) => [payday.source.name, payday.date, payday.inDays])).toEqual([
      ['Зарплата', '2026-10-05', 14],
      ['Аванс', '2026-10-20', 29],
    ]);
  });

  it('leaves an archived source out of the countdown', async () => {
    const source = await createIncomeSource({ name: 'Старая работа', dayOfMonth: 10 });
    await updateIncomeSource(source.id, { archived: true });

    expect(await listNextPaydays('2026-09-21')).toEqual([]);
  });
});
