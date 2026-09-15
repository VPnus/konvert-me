/**
 * Stored entities of docs/PLAN.md section 4, described with Zod.
 *
 * The schemas are the gate of the storage layer: every write goes through them,
 * and the import of a backup file is validated with exactly the same rules.
 */

import { z } from 'zod';

import { isIsoDate, isIsoMonth } from '@/core/time';

export const SCHEMA_VERSION = 1;

const isoDate = z.string().refine(isIsoDate, { message: 'Дата должна быть в формате ГГГГ-ММ-ДД' });
const isoMonth = z.string().refine(isIsoMonth, { message: 'Месяц должен быть в формате ГГГГ-ММ' });
const id = z.string().min(1).max(64);
const minor = z.number().int('Сумма должна быть в целых копейках').safe();
const positiveMinor = minor.refine((value) => value > 0, { message: 'Сумма должна быть больше нуля' });
const nonNegativeMinor = minor.refine((value) => value >= 0, {
  message: 'Сумма не может быть отрицательной',
});
const rate = z.number().min(-1).max(10);
const name = z.string().trim().min(1, 'Название не может быть пустым').max(120);
const note = z.string().max(500).optional();
const timestamp = z.number().int().nonnegative();

export const ASSET_TYPES = [
  'cash',
  'debit',
  'savings',
  'deposit',
  'brokerage',
  'iis',
  'realty',
  'vehicle',
  'other_asset',
] as const;

export const LIABILITY_TYPES = ['credit_card', 'mortgage', 'consumer', 'car', 'other_debt'] as const;

/** Liquid by default, per section 4 of the plan. */
export const LIQUID_BY_DEFAULT: readonly string[] = ['cash', 'debit', 'savings'];

export const accountSchema = z
  .object({
    id,
    name,
    side: z.enum(['asset', 'liability']),
    type: z.enum([...ASSET_TYPES, ...LIABILITY_TYPES]),
    currency: z.literal('RUB'),
    openingBalanceMinor: minor,
    openingDate: isoDate,
    isLiquid: z.boolean(),
    archived: z.boolean(),
    bankName: z.string().max(120).optional(),
    rate: rate.optional(),
    maturityDate: isoDate.optional(),
    monthlyPaymentMinor: nonNegativeMinor.optional(),
    /** Day of the month the payment is due; the "soon" feed of stage 6 uses it. */
    paymentDay: z.number().int().min(1).max(31).optional(),
    endDate: isoDate.optional(),
    creditLimitMinor: nonNegativeMinor.optional(),
    gracePeriodEnd: isoDate.optional(),
    note,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine(
    (account) =>
      account.side === 'asset'
        ? (ASSET_TYPES as readonly string[]).includes(account.type)
        : (LIABILITY_TYPES as readonly string[]).includes(account.type),
    { message: 'Тип счёта не совпадает с его стороной (актив или долг)', path: ['type'] },
  )
  .refine((account) => account.side === 'asset' || account.openingBalanceMinor >= 0, {
    message: 'Остаток долга указывается положительным числом',
    path: ['openingBalanceMinor'],
  });

export const categorySchema = z.object({
  id,
  name,
  kind: z.enum(['income', 'expense']),
  group: z.enum(['mandatory', 'variable']).optional(),
  icon: z.string().max(40).optional(),
  sortOrder: z.number().int().nonnegative(),
  archived: z.boolean(),
});

export const transactionSchema = z
  .object({
    id,
    date: isoDate,
    amountMinor: positiveMinor,
    kind: z.enum(['income', 'expense', 'refund', 'transfer', 'adjustment', 'revaluation']),
    accountId: id,
    toAccountId: id.optional(),
    categoryId: id.optional(),
    direction: z.enum(['increase', 'decrease']).optional(),
    note,
    importBatchId: id.optional(),
    importRowHash: z.string().max(128).optional(),
    createdAt: timestamp,
  })
  .refine((tx) => tx.kind !== 'transfer' || Boolean(tx.toAccountId), {
    message: 'У перевода должен быть счёт назначения',
    path: ['toAccountId'],
  })
  .refine((tx) => tx.kind !== 'transfer' || tx.toAccountId !== tx.accountId, {
    message: 'Перевод на тот же счёт невозможен',
    path: ['toAccountId'],
  })
  .refine((tx) => !['income', 'expense', 'refund'].includes(tx.kind) || Boolean(tx.categoryId), {
    message: 'У дохода, расхода и возврата должна быть категория',
    path: ['categoryId'],
  });

export const budgetPlanSchema = z.object({
  id,
  month: isoMonth,
  categoryId: id,
  amountMinor: nonNegativeMinor,
});

export const goalSchema = z
  .object({
    id,
    name,
    priority: z.number().int().min(0),
    kind: z.enum(['reserve', 'purchase', 'education', 'pension', 'other']),
    costMinor: nonNegativeMinor,
    costAsOf: isoMonth,
    targetMonth: isoMonth.optional(),
    returnRate: rate,
    inflationRate: rate,
    status: z.enum(['active', 'paused', 'done']),
    note,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine((goal) => goal.kind !== 'reserve' || goal.priority === 0, {
    message: 'У цели «финансовый резерв» приоритет всегда 0',
    path: ['priority'],
  })
  .refine((goal) => goal.kind === 'reserve' || Boolean(goal.targetMonth), {
    message: 'У цели должен быть срок',
    path: ['targetMonth'],
  });

export const envelopeSchema = z.object({
  id,
  goalId: id,
  accountId: id,
  amountMinor: nonNegativeMinor,
});

export const dashboardWidgetSchema = z.object({
  instanceId: id,
  widgetType: z.string().min(1).max(60),
  size: z.enum(['S', 'M', 'L']),
  order: z.number().int().nonnegative(),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export const dashboardLayoutSchema = z.object({
  id,
  name,
  items: z.array(dashboardWidgetSchema),
});

export const settingsSchema = z.object({
  id: z.literal('app'),
  inflationRate: rate,
  defaultReturnRate: rate,
  reserveTargetMonths: z.number().int().min(1).max(24),
  onboardingDone: z.boolean(),
  lastBackupAt: timestamp.nullable(),
  backupReminderDays: z.number().int().min(0).max(365),
  storagePersisted: z.boolean(),
  schemaVersion: z.number().int().positive(),
});

export type Account = z.infer<typeof accountSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type BudgetPlan = z.infer<typeof budgetPlanSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;
export type AppSettings = z.infer<typeof settingsSchema>;
export type AccountSide = Account['side'];
export type AccountType = Account['type'];

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  inflationRate: 0.08,
  defaultReturnRate: 0.1,
  reserveTargetMonths: 6,
  onboardingDone: false,
  lastBackupAt: null,
  backupReminderDays: 30,
  storagePersisted: false,
  schemaVersion: SCHEMA_VERSION,
};

/** Every table of the backup file, in the order they are restored. */
export const TABLE_SCHEMAS = {
  settings: settingsSchema,
  accounts: accountSchema,
  categories: categorySchema,
  transactions: transactionSchema,
  budgetPlans: budgetPlanSchema,
  goals: goalSchema,
  envelopes: envelopeSchema,
  dashboardLayouts: dashboardLayoutSchema,
} as const;

export type TableName = keyof typeof TABLE_SCHEMAS;
export const TABLE_NAMES = Object.keys(TABLE_SCHEMAS) as TableName[];
