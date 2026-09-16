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
  DeductionYear,
  DocumentFile,
  Envelope,
  Feed,
  FeedItem,
  FinancialPlan,
  Goal,
  IncomeSource,
  InsurancePolicy,
  Link,
  TaxDocument,
  Transaction,
} from '@/db/models';

export const DATABASE_NAME = 'konvert-me';

export class KonvertDatabase extends Dexie {
  declare settings: Table<AppSettings, string>;
  declare accounts: Table<Account, string>;
  declare categories: Table<Category, string>;
  declare transactions: Table<Transaction, string>;
  declare budgetPlans: Table<BudgetPlan, string>;
  declare incomeSources: Table<IncomeSource, string>;
  declare policies: Table<InsurancePolicy, string>;
  declare deductionYears: Table<DeductionYear, number>;
  declare documents: Table<TaxDocument, string>;
  declare documentFiles: Table<DocumentFile, string>;
  declare financialPlans: Table<FinancialPlan, string>;
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

    // v3 adds the sources of income the balance screen counts the days to. Again
    // nothing is transformed: the table simply starts empty.
    this.version(3).stores({
      incomeSources: 'id, sortOrder, archived',
    });

    // v4 adds the insurance policies of stage 6. Nothing is transformed again.
    this.version(4).stores({
      policies: 'id, endDate, archived',
    });

    // v5 adds the deductions of stage 7: a year of claims keyed by the year, the papers
    // behind them, and the bytes of those papers apart, so a list never loads a scan.
    this.version(5).stores({
      deductionYears: 'year, status',
      documents: 'id, year, category',
      documentFiles: 'id',
    });

    // v6 adds the financial plan of stage 8: one row with what the plan adds to the rest of
    // the data. Nothing is transformed: the table simply starts empty.
    this.version(6).stores({
      financialPlans: 'id',
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
