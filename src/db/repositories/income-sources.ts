/**
 * Sources of income that repeat on a schedule: a salary, an advance, rent from a flat.
 * They hold no money of their own — the balance screen only counts the days to the
 * next payment, so nothing here touches accounts or operations.
 */

import { nextPaydays, type PaydayOf, type PaySchedule } from '@/core/payday';
import { todayIso, type IsoDate } from '@/core/time';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { incomeSourceSchema, type IncomeSource } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { strings } from '@/i18n';
import { publishAppEvent } from '@/lib/broadcast';

export interface IncomeSourceInput {
  name: string;
  schedule: PaySchedule;
  amountMinor?: number;
  note?: string;
}

export async function listIncomeSources(
  options: { includeArchived?: boolean } = {},
): Promise<IncomeSource[]> {
  const all = await db.incomeSources.toArray();
  const visible = options.includeArchived ? all : all.filter((source) => !source.archived);
  return visible.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export async function createIncomeSource(input: IncomeSourceInput): Promise<IncomeSource> {
  const count = await db.incomeSources.count();
  const source = parseOrThrow(
    incomeSourceSchema,
    {
      ...input,
      id: crypto.randomUUID(),
      archived: false,
      sortOrder: count,
      createdAt: Date.now(),
    },
    strings.data.subjects.incomeSource,
  );

  await db.incomeSources.add(source);
  publishAppEvent({ type: 'data-changed' });
  return source;
}

export async function updateIncomeSource(
  id: string,
  patch: Partial<IncomeSourceInput> & { archived?: boolean },
): Promise<IncomeSource> {
  const current = await db.incomeSources.get(id);
  if (!current) throw new RepositoryError(strings.data.notFound.incomeSource);

  const next = parseOrThrow(
    incomeSourceSchema,
    { ...current, ...patch, id: current.id, createdAt: current.createdAt },
    strings.data.subjects.incomeSource,
  );

  await db.incomeSources.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}

export async function deleteIncomeSource(id: string): Promise<void> {
  await db.incomeSources.delete(id);
  publishAppEvent({ type: 'data-changed' });
}

/** Every source with the date of its next payment, the nearest first. */
export async function listNextPaydays(today: IsoDate = todayIso()): Promise<PaydayOf<IncomeSource>[]> {
  return nextPaydays(today, await listIncomeSources());
}

