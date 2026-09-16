/**
 * Goals and envelopes.
 *
 * The reserve is a goal with priority 0 and no target month: its cost is derived from
 * the average expenses (formula 9), so it is not stored. Every other goal is more
 * important the smaller its priority is.
 */

import { currentMonth, todayIso, type IsoMonth } from '@/core/time';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { envelopeSchema, goalSchema, type Envelope, type Goal } from '@/db/models';
import { assertEnvelopesFit } from '@/db/repositories/accounts';
import { createTransaction, deleteTransaction } from '@/db/repositories/transactions';
import { getSettings } from '@/db/repositories/settings';
import { ru } from '@/i18n/ru';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export const RESERVE_GOAL_ID = 'reserve';

export interface GoalInput {
  name: string;
  kind: Goal['kind'];
  costMinor: number;
  costAsOf?: IsoMonth;
  targetMonth?: IsoMonth;
  returnRate?: number;
  inflationRate?: number;
  priority?: number;
  note?: string;
}

export async function listGoals(options: { includeDone?: boolean } = {}): Promise<Goal[]> {
  const all = await db.goals.toArray();
  const visible = options.includeDone ? all : all.filter((goal) => goal.status !== 'done');
  return visible.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, 'ru'));
}

export async function getGoal(id: string): Promise<Goal | undefined> {
  return db.goals.get(id);
}

async function nextPriority(): Promise<number> {
  const goals = await db.goals.toArray();
  return goals.reduce((max, goal) => Math.max(max, goal.priority), 0) + 1;
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const settings = await getSettings();
  const now = Date.now();
  const isReserve = input.kind === 'reserve';

  const goal = parseOrThrow(
    goalSchema,
    {
      id: isReserve ? RESERVE_GOAL_ID : crypto.randomUUID(),
      name: input.name,
      kind: input.kind,
      priority: isReserve ? 0 : (input.priority ?? (await nextPriority())),
      costMinor: input.costMinor,
      costAsOf: input.costAsOf ?? currentMonth(),
      targetMonth: input.targetMonth,
      returnRate: input.returnRate ?? settings.defaultReturnRate,
      inflationRate: input.inflationRate ?? settings.inflationRate,
      status: 'active',
      note: input.note,
      createdAt: now,
      updatedAt: now,
    },
    'Цель',
  );

  await db.goals.put(goal);
  publishAppEvent({ type: 'data-changed' });
  return goal;
}

export async function updateGoal(
  id: string,
  patch: Partial<GoalInput & { status: Goal['status'] }>,
): Promise<Goal> {
  const current = await db.goals.get(id);
  if (!current) throw new RepositoryError('Цель не найдена');

  const next = parseOrThrow(
    goalSchema,
    { ...current, ...patch, id: current.id, kind: current.kind, updatedAt: Date.now() },
    'Цель',
  );

  await db.goals.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}

export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', [db.goals, db.envelopes], async () => {
    await db.envelopes.where('goalId').equals(id).delete();
    await db.goals.delete(id);
  });
  publishAppEvent({ type: 'data-changed' });
}

/** Reorders the goals: the first one in the list is the most important. */
export async function reorderGoals(orderedIds: readonly string[]): Promise<void> {
  await db.transaction('rw', db.goals, async () => {
    let priority = 1;
    for (const id of orderedIds) {
      const goal = await db.goals.get(id);
      if (!goal || goal.kind === 'reserve') continue;
      await db.goals.put({ ...goal, priority, updatedAt: Date.now() });
      priority += 1;
    }
  });
  publishAppEvent({ type: 'data-changed' });
}

export async function ensureReserveGoal(): Promise<Goal> {
  const existing = await db.goals.get(RESERVE_GOAL_ID);
  if (existing) return existing;

  return createGoal({ name: 'Финансовый резерв', kind: 'reserve', costMinor: 0 });
}

export async function listEnvelopes(): Promise<Envelope[]> {
  return db.envelopes.toArray();
}

/** Sum of the envelopes of a goal — the S of the contribution formulas. */
export async function getGoalSavingsMinor(goalId: string): Promise<number> {
  const envelopes = await db.envelopes.where('goalId').equals(goalId).toArray();
  return envelopes.reduce((total, envelope) => total + envelope.amountMinor, 0);
}

export async function getSavingsByGoal(): Promise<Map<string, number>> {
  const envelopes = await db.envelopes.toArray();
  const totals = new Map<string, number>();
  for (const envelope of envelopes) {
    totals.set(envelope.goalId, (totals.get(envelope.goalId) ?? 0) + envelope.amountMinor);
  }
  return totals;
}

/** Envelopes of every goal except the reserve — what formula 9 subtracts. */
export async function getOtherGoalsEnvelopesMinor(excludeGoalId: string = RESERVE_GOAL_ID): Promise<number> {
  const envelopes = await db.envelopes.toArray();
  return envelopes
    .filter((envelope) => envelope.goalId !== excludeGoalId)
    .reduce((total, envelope) => total + envelope.amountMinor, 0);
}

export async function setEnvelope(goalId: string, accountId: string, amountMinor: number): Promise<Envelope> {
  const existing = await db.envelopes.where('[goalId+accountId]').equals([goalId, accountId]).first();
  const envelope = parseOrThrow(
    envelopeSchema,
    { id: existing?.id ?? crypto.randomUUID(), goalId, accountId, amountMinor },
    'Конверт',
  );

  const previous = existing ? { ...existing } : null;
  await db.envelopes.put(envelope);

  try {
    await assertEnvelopesFit(accountId);
  } catch (error) {
    if (previous) await db.envelopes.put(previous);
    else await db.envelopes.delete(envelope.id);
    throw error;
  }

  publishAppEvent({ type: 'data-changed' });
  return envelope;
}

export async function deleteEnvelope(goalId: string, accountId: string): Promise<void> {
  const existing = await db.envelopes.where('[goalId+accountId]').equals([goalId, accountId]).first();
  if (!existing) return;

  await db.envelopes.delete(existing.id);
  publishAppEvent({ type: 'data-changed' });
}

export interface ContributionInput {
  goalId: string;
  /** The account the money will sit on, envelope and all. */
  accountId: string;
  amountMinor: number;
  /** Set when the money still has to travel: a transfer is recorded first. */
  fromAccountId?: string;
  date?: string;
  note?: string;
}

/**
 * Putting money into a goal, as section 4 of the plan defines it: a transfer between
 * own accounts plus a bigger envelope — never an expense. When the money is already
 * on the account, only the envelope grows.
 */
export async function contributeToGoal(input: ContributionInput): Promise<Envelope> {
  if (!(input.amountMinor > 0)) {
    throw new RepositoryError('Взнос должен быть больше нуля');
  }

  const goal = await db.goals.get(input.goalId);
  if (!goal) throw new RepositoryError('Цель не найдена');

  const moves = Boolean(input.fromAccountId && input.fromAccountId !== input.accountId);
  const transfer = moves
    ? await createTransaction({
        date: input.date ?? todayIso(),
        amountMinor: input.amountMinor,
        kind: 'transfer',
        accountId: input.fromAccountId as string,
        toAccountId: input.accountId,
        note: input.note ?? ru.goals.contributionNote.replace('{name}', goal.name),
      })
    : null;

  const current = await getEnvelopeMinor(input.goalId, input.accountId);

  try {
    return await setEnvelope(input.goalId, input.accountId, current + input.amountMinor);
  } catch (error) {
    // The envelope did not fit, so the transfer that was meant to feed it goes back.
    if (transfer) await deleteTransaction(transfer.id);
    throw error;
  }
}

export async function getEnvelopeMinor(goalId: string, accountId: string): Promise<number> {
  const existing = await db.envelopes.where('[goalId+accountId]').equals([goalId, accountId]).first();
  return existing?.amountMinor ?? 0;
}
