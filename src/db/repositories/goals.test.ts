import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import { createAccount } from '@/db/repositories/accounts';
import {
  createGoal,
  deleteGoal,
  ensureReserveGoal,
  getGoalSavingsMinor,
  getOtherGoalsEnvelopesMinor,
  listGoals,
  reorderGoals,
  RESERVE_GOAL_ID,
  setEnvelope,
  updateGoal,
} from '@/db/repositories/goals';

const RUB = 100;

beforeEach(async () => {
  await Promise.all([db.goals.clear(), db.envelopes.clear(), db.accounts.clear(), db.settings.clear()]);
});

describe('goals', () => {
  it('creates the reserve with priority 0 and a fixed id', async () => {
    const reserve = await ensureReserveGoal();

    expect(reserve.id).toBe(RESERVE_GOAL_ID);
    expect(reserve.priority).toBe(0);
    expect(reserve.kind).toBe('reserve');
    expect(reserve.targetMonth).toBeUndefined();

    await ensureReserveGoal();
    expect(await db.goals.count()).toBe(1);
  });

  it('takes the default rates from the settings', async () => {
    const goal = await createGoal({
      name: 'Квартира',
      kind: 'purchase',
      costMinor: 4_000_000 * RUB,
      costAsOf: '2026-01',
      targetMonth: '2029-01',
    });

    expect(goal.inflationRate).toBe(0.08);
    expect(goal.returnRate).toBe(0.1);
    expect(goal.priority).toBeGreaterThan(0);
  });

  it('demands a target month for a normal goal', async () => {
    await expect(
      createGoal({ name: 'Машина', kind: 'purchase', costMinor: 1_000_000 * RUB }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('orders goals by priority and reorders them on demand', async () => {
    await ensureReserveGoal();
    const flat = await createGoal({
      name: 'Квартира',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-01',
      targetMonth: '2030-01',
    });
    const car = await createGoal({
      name: 'Машина',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-01',
      targetMonth: '2028-01',
    });

    expect((await listGoals()).map((goal) => goal.name)).toEqual(['Финансовый резерв', 'Квартира', 'Машина']);

    await reorderGoals([car.id, flat.id]);
    expect((await listGoals()).map((goal) => goal.name)).toEqual(['Финансовый резерв', 'Машина', 'Квартира']);
    expect((await db.goals.get(RESERVE_GOAL_ID))?.priority).toBe(0);
  });

  it('reports a missing goal', async () => {
    await expect(updateGoal('нет', { name: 'Ой' })).rejects.toBeInstanceOf(RepositoryError);
  });

  it('removes the envelopes of a deleted goal', async () => {
    const account = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 100_000 * RUB,
    });
    const goal = await createGoal({
      name: 'Машина',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-01',
      targetMonth: '2028-01',
    });
    await setEnvelope(goal.id, account.id, 50_000 * RUB);

    await deleteGoal(goal.id);

    expect(await db.envelopes.count()).toBe(0);
    expect(await db.goals.count()).toBe(0);
  });
});

describe('envelopes', () => {
  it('keeps the invariant: envelopes never exceed the account balance', async () => {
    const account = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 100_000 * RUB,
    });
    const goal = await createGoal({
      name: 'Машина',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-01',
      targetMonth: '2028-01',
    });

    await setEnvelope(goal.id, account.id, 100_000 * RUB);
    expect(await getGoalSavingsMinor(goal.id)).toBe(100_000 * RUB);

    await expect(setEnvelope(goal.id, account.id, 100_001 * RUB)).rejects.toThrow(/конверт/i);
    // the rejected value never lands in the database
    expect(await getGoalSavingsMinor(goal.id)).toBe(100_000 * RUB);
  });

  it('rolls a brand new envelope back when it does not fit', async () => {
    const account = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 1_000 * RUB,
    });
    const goal = await createGoal({
      name: 'Отпуск',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-01',
      targetMonth: '2027-01',
    });

    await expect(setEnvelope(goal.id, account.id, 5_000 * RUB)).rejects.toThrow();
    expect(await db.envelopes.count()).toBe(0);
  });

  it('counts the envelopes of the other goals for the reserve', async () => {
    const account = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 400_000 * RUB,
    });
    await ensureReserveGoal();
    const goal = await createGoal({
      name: 'Машина',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-01',
      targetMonth: '2028-01',
    });

    await setEnvelope(goal.id, account.id, 150_000 * RUB);
    await setEnvelope(RESERVE_GOAL_ID, account.id, 100_000 * RUB);

    expect(await getOtherGoalsEnvelopesMinor()).toBe(150_000 * RUB);
  });
});
