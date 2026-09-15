/**
 * Dexie database. The UI never touches it directly — only through the repositories.
 */

import Dexie, { type Table } from 'dexie';

import type {
  Account,
  AppSettings,
  BudgetPlan,
  Category,
  DashboardLayout,
  Envelope,
  Feed,
  FeedItem,
  Goal,
  Link,
  Transaction,
} from '@/db/models';

export const DATABASE_NAME = 'konvert-me';

export class KonvertDatabase extends Dexie {
  declare settings: Table<AppSettings, string>;
  declare accounts: Table<Account, string>;
  declare categories: Table<Category, string>;
  declare transactions: Table<Transaction, string>;
  declare budgetPlans: Table<BudgetPlan, string>;
  declare goals: Table<Goal, string>;
  declare envelopes: Table<Envelope, string>;
  declare dashboardLayouts: Table<DashboardLayout, string>;
  declare links: Table<Link, string>;
  declare feeds: Table<Feed, string>;
  declare feedItems: Table<FeedItem, string>;

  constructor(name: string = DATABASE_NAME) {
    super(name);

    this.version(1).stores({
      settings: 'id',
      accounts: 'id, side, type, archived, isLiquid',
      categories: 'id, kind, archived, sortOrder',
      transactions: 'id, date, kind, accountId, toAccountId, categoryId, importBatchId, importRowHash',
      budgetPlans: 'id, month, categoryId, [month+categoryId]',
      goals: 'id, priority, status, kind',
      envelopes: 'id, goalId, accountId, [goalId+accountId]',
      dashboardLayouts: 'id',
    });

    // v2 adds the pinned sources and the optional news feeds. Nothing is transformed:
    // the new tables simply start empty for everyone who already has data.
    this.version(2).stores({
      links: 'id, sortOrder',
      feeds: 'id, enabled',
      feedItems: 'id, feedId, publishedAt',
    });
  }
}

export const db = new KonvertDatabase();

export type VersionChangeHandler = () => void;

/**
 * Another tab is upgrading the schema. Until this connection is closed the upgrade
 * is blocked, so the old tab closes its connection and asks for a reload.
 */
export function handleVersionChange(database: Dexie, onBlocked: VersionChangeHandler): () => void {
  const listener = () => {
    database.close();
    onBlocked();
  };

  database.on('versionchange', listener);
  return () => database.on('versionchange').unsubscribe(listener);
}
