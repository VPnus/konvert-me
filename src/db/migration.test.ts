import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { handleVersionChange, KonvertDatabase } from '@/db/db';

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

  it('keeps the data of schema 4 when schema 5 adds the deductions', async () => {
    const name = `konvert-me-v5-${crypto.randomUUID()}`;

    // schema 4 exactly as the app declared it before stage 7
    const v4 = open(name, (database) => {
      database.version(1).stores(V1_STORES);
      database
        .version(2)
        .stores({ links: 'id, sortOrder', feeds: 'id, enabled', feedItems: 'id, feedId, publishedAt' });
      database.version(3).stores({ incomeSources: 'id, sortOrder, archived' });
      database.version(4).stores({ policies: 'id, endDate, archived' });
    });
    await v4.table('policies').add({
      id: 'p1',
      name: 'ОСАГО',
      type: 'vehicle',
      endDate: '2026-11-20',
      archived: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await v4
      .table('incomeSources')
      .add({ id: 's1', name: 'Зарплата', day: 10, sortOrder: 0, archived: false });
    v4.close();

    const v5 = new KonvertDatabase(name);
    opened.push(v5);
    await v5.open();

    // The app is past schema 5 by now; what matters is that it went through it.
    expect(v5.verno).toBeGreaterThanOrEqual(5);
    expect(await v5.policies.count()).toBe(1);
    expect(await v5.incomeSources.count()).toBe(1);
    expect(await v5.deductionYears.count()).toBe(0);
    expect(await v5.documents.count()).toBe(0);
    expect(await v5.documentFiles.count()).toBe(0);
  });

  it('keeps the data of schema 5 when schema 6 adds the financial plan', async () => {
    const name = `konvert-me-v6-${crypto.randomUUID()}`;

    // schema 5 exactly as the app declared it before stage 8
    const v5 = open(name, (database) => {
      database.version(1).stores(V1_STORES);
      database
        .version(2)
        .stores({ links: 'id, sortOrder', feeds: 'id, enabled', feedItems: 'id, feedId, publishedAt' });
      database.version(3).stores({ incomeSources: 'id, sortOrder, archived' });
      database.version(4).stores({ policies: 'id, endDate, archived' });
      database
        .version(5)
        .stores({ deductionYears: 'year, status', documents: 'id, year, category', documentFiles: 'id' });
    });
    await v5.table('deductionYears').add({ year: 2025, status: 'draft' });
    await v5.table('documentFiles').add({ id: 'd1', content: new Uint8Array([1, 2, 3]).buffer });
    v5.close();

    const v6 = new KonvertDatabase(name);
    opened.push(v6);
    await v6.open();

    expect(v6.verno).toBe(6);
    expect(await v6.deductionYears.count()).toBe(1);
    expect(await v6.documentFiles.count()).toBe(1);
    expect(await v6.financialPlans.count()).toBe(0);
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
