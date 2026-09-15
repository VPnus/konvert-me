import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { handleVersionChange } from '@/db/db';

const V1_STORES = {
  settings: 'id',
  accounts: 'id, side, type, archived, isLiquid',
  categories: 'id, kind, archived, sortOrder',
  transactions: 'id, date, kind, accountId, toAccountId, categoryId, importBatchId, importRowHash',
  budgetPlans: 'id, month, categoryId, [month+categoryId]',
  goals: 'id, priority, status, kind',
  envelopes: 'id, goalId, accountId, [goalId+accountId]',
  dashboardLayouts: 'id',
};

const opened: Dexie[] = [];

function open(name: string, configure: (database: Dexie) => void): Dexie {
  const database = new Dexie(name);
  configure(database);
  opened.push(database);
  return database;
}

afterEach(async () => {
  while (opened.length > 0) opened.pop()?.close();
});

describe('schema migration', () => {
  it('keeps the data of version 1 when version 2 arrives', async () => {
    const name = `konvert-me-migration-${crypto.randomUUID()}`;

    const v1 = open(name, (database) => database.version(1).stores(V1_STORES));
    await v1.table('accounts').bulkAdd([
      {
        id: 'a1',
        name: 'Карта',
        side: 'asset',
        type: 'debit',
        currency: 'RUB',
        openingBalanceMinor: 10_000_000,
        openingDate: '2026-01-01',
        isLiquid: true,
        archived: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    await v1.table('transactions').add({
      id: 't1',
      date: '2026-09-05',
      amountMinor: 150_000,
      kind: 'expense',
      accountId: 'a1',
      categoryId: 'food',
      createdAt: 1,
    });
    v1.close();

    // A fictional version 2: a new table plus a new field with a default value.
    const v2 = open(name, (database) => {
      database.version(1).stores(V1_STORES);
      database
        .version(2)
        .stores({ ...V1_STORES, insurancePolicies: 'id, type, endDate' })
        .upgrade(async (transaction) => {
          await transaction
            .table('accounts')
            .toCollection()
            .modify((account: { color?: string }) => {
              account.color = 'green';
            });
        });
    });

    await v2.open();

    expect(v2.verno).toBe(2);
    const accounts = await v2.table('accounts').toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Карта');
    expect(accounts[0].openingBalanceMinor).toBe(10_000_000);
    expect(accounts[0].color).toBe('green');
    expect(await v2.table('transactions').count()).toBe(1);
    expect(await v2.table('insurancePolicies').count()).toBe(0);
  });

  it('closes the old connection when another tab upgrades the schema', async () => {
    const name = `konvert-me-versionchange-${crypto.randomUUID()}`;

    const oldTab = open(name, (database) => database.version(1).stores(V1_STORES));
    await oldTab.open();

    let asked = false;
    const unsubscribe = handleVersionChange(oldTab, () => {
      asked = true;
    });

    const newTab = open(name, (database) => {
      database.version(1).stores(V1_STORES);
      database.version(2).stores({ ...V1_STORES, insurancePolicies: 'id' });
    });
    await newTab.open();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asked).toBe(true);
    expect(oldTab.isOpen()).toBe(false);
    unsubscribe();
  });
});
