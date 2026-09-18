import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { createAccount, updateAccount } from '@/db/repositories/accounts';
import { seedDefaultCategories } from '@/db/repositories/categories';
import { retranslateDefaults } from '@/db/repositories/defaults';
import { ensureReserveGoal, RESERVE_GOAL_ID } from '@/db/repositories/goals';

beforeEach(async () => {
  await clearAllData();
});

/** The dictionary of the tests is Russian; another language is imitated by an older name. */
async function pretendWrittenInAnotherLanguage(): Promise<void> {
  await db.categories.update('salary', { name: 'Salary', defaultName: 'Salary' });
  await db.goals.update(RESERVE_GOAL_ID, { name: 'Emergency fund', defaultName: 'Emergency fund' });
}

describe('the names the app wrote itself', () => {
  it('follow the language of the page', async () => {
    await seedDefaultCategories();
    await ensureReserveGoal();
    await pretendWrittenInAnotherLanguage();

    expect(await retranslateDefaults()).toBe(2);
    expect((await db.categories.get('salary'))?.name).toBe('Зарплата');
    expect((await db.goals.get(RESERVE_GOAL_ID))?.name).toBe('Финансовый резерв');
  });

  it('are left alone once the person has renamed them', async () => {
    await seedDefaultCategories();
    await db.categories.update('salary', { name: 'Оклад мужа' });

    expect(await retranslateDefaults()).toBe(0);
    expect((await db.categories.get('salary'))?.name).toBe('Оклад мужа');
  });

  it('do not touch a category or an account the person added', async () => {
    const account = await createAccount({
      name: 'Накопления',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 0,
      openingDate: '2026-01-01',
    });

    // the same name, but written by the person: no mark, so nothing follows the language
    expect(await retranslateDefaults()).toBe(0);
    expect((await db.accounts.get(account.id))?.name).toBe('Накопления');
  });

  it('rename an account of the introduction, and stop once it is renamed by hand', async () => {
    const account = await createAccount({
      name: 'Savings',
      defaultKey: 'savingsAccount',
      defaultName: 'Savings',
      side: 'asset',
      type: 'savings',
      openingBalanceMinor: 0,
      openingDate: '2026-01-01',
    });

    expect(await retranslateDefaults()).toBe(1);
    expect((await db.accounts.get(account.id))?.name).toBe('Накопления');

    await updateAccount(account.id, { name: 'Вклад в банке' });
    expect(await retranslateDefaults()).toBe(0);
    expect((await db.accounts.get(account.id))?.name).toBe('Вклад в банке');
  });

  it('changes nothing when every name is already in the language of the page', async () => {
    await seedDefaultCategories();
    await ensureReserveGoal();
    expect(await retranslateDefaults()).toBe(0);
  });
});
