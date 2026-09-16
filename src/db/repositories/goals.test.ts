import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import { createAccount, getAccountBalanceMinor } from '@/db/repositories/accounts';
import { seedDefaultCategories } from '@/db/repositories/categories';
import {
  contributeToGoal,
  createGoal,
  deleteEnvelope,
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
import { createTransaction } from '@/db/repositories/transactions';

const RUB = 100;

beforeEach(async () => {
  await Promise.all([
    db.goals.clear(),
    db.envelopes.clear(),
    db.accounts.clear(),
    db.settings.clear(),
    db.transactions.clear(),
    db.categories.clear(),
  ]);
  await seedDefaultCategories();
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

    const broker = await createAccount({
      name: 'Брокерский',
      side: 'asset',
      type: 'brokerage',
      openingBalanceMinor: 1_000_000 * RUB,
    });

    await setEnvelope(goal.id, account.id, 150_000 * RUB);
    await setEnvelope(RESERVE_GOAL_ID, account.id, 100_000 * RUB);
    // Money a goal keeps on a brokerage account was never liquid, so the reserve keeps its own.
    await setEnvelope(goal.id, broker.id, 1_000_000 * RUB);

    expect(await getOtherGoalsEnvelopesMinor()).toBe(150_000 * RUB);
  });
});

describe('goals: putting money in', () => {
  async function setUp() {
    const card = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 100_000 * RUB,
      openingDate: '2026-09-01',
    });
    const savings = await createAccount({
      name: 'Накопительный',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 0,
      openingDate: '2026-09-01',
    });
    const goal = await createGoal({
      name: 'Квартира',
      kind: 'purchase',
      costMinor: 3_000_000 * RUB,
      costAsOf: '2026-09',
      targetMonth: '2031-09',
    });
    return { card, savings, goal };
  }

  it('moves the money and grows the envelope in one go', async () => {
    const { card, savings, goal } = await setUp();

    await contributeToGoal({
      goalId: goal.id,
      accountId: savings.id,
      fromAccountId: card.id,
      amountMinor: 30_000 * RUB,
      date: '2026-09-10',
    });

    expect(await getAccountBalanceMinor(card.id)).toBe(70_000 * RUB);
    expect(await getAccountBalanceMinor(savings.id)).toBe(30_000 * RUB);
    expect(await getGoalSavingsMinor(goal.id)).toBe(30_000 * RUB);

    // a contribution is a transfer, so it never counts as an expense
    const [transfer] = await db.transactions.toArray();
    expect(transfer.kind).toBe('transfer');
    expect(transfer.note).toContain('Квартира');
  });

  it('only grows the envelope when the money is already there', async () => {
    const { savings, goal } = await setUp();
    await createTransaction({
      date: '2026-09-02',
      amountMinor: 50_000 * RUB,
      kind: 'income',
      accountId: savings.id,
      categoryId: 'salary',
    });

    await contributeToGoal({ goalId: goal.id, accountId: savings.id, amountMinor: 20_000 * RUB });

    expect(await getGoalSavingsMinor(goal.id)).toBe(20_000 * RUB);
    expect(await db.transactions.count()).toBe(1);
  });

  it('adds up to what is already in the envelope', async () => {
    const { savings, card, goal } = await setUp();

    await contributeToGoal({
      goalId: goal.id,
      accountId: savings.id,
      fromAccountId: card.id,
      amountMinor: 10_000 * RUB,
    });
    await contributeToGoal({
      goalId: goal.id,
      accountId: savings.id,
      fromAccountId: card.id,
      amountMinor: 5_000 * RUB,
    });

    expect(await getGoalSavingsMinor(goal.id)).toBe(15_000 * RUB);
  });

  it('takes the transfer back when the envelope would not fit', async () => {
    const { card, savings, goal } = await setUp();
    const other = await createGoal({
      name: 'Отпуск',
      kind: 'purchase',
      costMinor: 100,
      costAsOf: '2026-09',
      targetMonth: '2027-06',
    });
    await contributeToGoal({
      goalId: other.id,
      accountId: savings.id,
      fromAccountId: card.id,
      amountMinor: 40_000 * RUB,
    });

    // the savings account holds 40 000, so a 50 000 envelope cannot stand on it
    await expect(
      contributeToGoal({ goalId: goal.id, accountId: savings.id, amountMinor: 50_000 * RUB }),
    ).rejects.toThrow(/конверт/i);

    expect(await getGoalSavingsMinor(goal.id)).toBe(0);
    expect(await getAccountBalanceMinor(savings.id)).toBe(40_000 * RUB);
  });

  it('refuses a contribution that is not a sum of money', async () => {
    const { savings, goal } = await setUp();
    await expect(
      contributeToGoal({ goalId: goal.id, accountId: savings.id, amountMinor: 0 }),
    ).rejects.toBeInstanceOf(RepositoryError);
    await expect(
      contributeToGoal({ goalId: 'нет-такой', accountId: savings.id, amountMinor: 100 }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });

  it('frees an envelope when it is emptied', async () => {
    const { card, savings, goal } = await setUp();
    await contributeToGoal({
      goalId: goal.id,
      accountId: savings.id,
      fromAccountId: card.id,
      amountMinor: 10_000 * RUB,
    });

    await deleteEnvelope(goal.id, savings.id);
    expect(await getGoalSavingsMinor(goal.id)).toBe(0);
    // deleting what is not there is quietly fine
    await expect(deleteEnvelope(goal.id, savings.id)).resolves.toBeUndefined();
  });
});
