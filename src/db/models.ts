/**
 * Stored entities of docs/PLAN.md section 4, described with Zod.
 *
 * The schemas are the gate of the storage layer: every write goes through them,
 * and the import of a backup file is validated with exactly the same rules.
 */

import { z } from 'zod';

import { isIsoDate, isIsoMonth } from '@/core/time';

export const SCHEMA_VERSION = 4;

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
    paymentDay: z
      .number()
      .int('Число месяца — целое число')
      .min(1, 'Число месяца — от 1 до 31')
      .max(31, 'Число месяца — от 1 до 31')
      .optional(),
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

/**
 * A source of income that repeats on the same day of every month: a salary, an
 * advance, rent from a flat. The balance screen counts the days to the next one.
 */
export const incomeSourceSchema = z.object({
  id,
  name,
  dayOfMonth: z
    .number()
    .int('Число месяца — целое число')
    .min(1, 'Число месяца — от 1 до 31')
    .max(31, 'Число месяца — от 1 до 31'),
  /** Optional: not every income is known in advance to the kopeck. */
  amountMinor: nonNegativeMinor.optional(),
  archived: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  note,
  createdAt: timestamp,
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

export const POLICY_TYPES = ['life', 'health', 'property', 'vehicle', 'travel', 'other'] as const;

/**
 * An insurance policy (lesson 2.6). It holds no money of its own: the balance screen
 * keeps it to show what is covered and when it runs out.
 */
export const insurancePolicySchema = z.object({
  id,
  name,
  type: z.enum(POLICY_TYPES),
  insurer: z.string().trim().max(120).optional(),
  /** What the insurer pays at most. */
  sumInsuredMinor: nonNegativeMinor.optional(),
  /** What the policy costs for its whole term. */
  premiumMinor: nonNegativeMinor.optional(),
  startDate: isoDate.optional(),
  endDate: isoDate,
  archived: z.boolean(),
  note,
  createdAt: timestamp,
  updatedAt: timestamp,
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

const url = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((value) => /^https:\/\//i.test(value), { message: 'Адрес должен начинаться с https://' })
  .refine(
    (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Это не похоже на адрес страницы' },
  );

/** A useful source the user pins by hand. Nothing is ever requested from it. */
export const linkSchema = z.object({
  id,
  title: name,
  url,
  note,
  sortOrder: z.number().int().nonnegative(),
  createdAt: timestamp,
});

const secret = z.string().min(1).max(512);
/** A key that travels in a header must be plain ASCII: browsers refuse anything else. */
const headerSafeSecret = secret.regex(/^[\x20-\x7e]+$/, {
  message: 'Ключ в заголовке может состоять только из латиницы, цифр и знаков препинания',
});
const headerName = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/, { message: 'В имени заголовка допустимы латиница, цифры и дефис' });

/**
 * How the source is authorised. The key is typed by the user and stays on the device;
 * it is only ever sent to the host of the feed itself.
 */
export const feedAuthSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('query'),
    paramName: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_.-]+$/, { message: 'В имени параметра допустимы латиница, цифры, _ . -' }),
    key: secret,
  }),
  z.object({ kind: z.literal('header'), headerName, key: headerSafeSecret }),
  z.object({ kind: z.literal('bearer'), key: headerSafeSecret }),
]);

/** A news feed the user adds on purpose; it is only read when they allow it. */
export const feedSchema = z.object({
  id,
  title: name,
  url,
  enabled: z.boolean(),
  auth: feedAuthSchema.default({ kind: 'none' }),
  /** Where the records live in a JSON answer, e.g. "data.articles". Guessed when empty. */
  itemsPath: z.string().trim().max(200).optional(),
  lastFetchedAt: timestamp.nullable(),
  lastError: z.string().max(500).nullable(),
  createdAt: timestamp,
});

export const feedItemSchema = z.object({
  id,
  feedId: id,
  title: z.string().min(1).max(500),
  url,
  publishedAt: timestamp.nullable(),
  fetchedAt: timestamp,
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
  /** Off by default: nothing leaves the device until the user turns this on. */
  externalFeedsEnabled: z.boolean().default(false),
  schemaVersion: z.number().int().positive(),
});

export type Account = z.infer<typeof accountSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type BudgetPlan = z.infer<typeof budgetPlanSchema>;
export type IncomeSource = z.infer<typeof incomeSourceSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export type InsurancePolicy = z.infer<typeof insurancePolicySchema>;
export type PolicyType = InsurancePolicy['type'];
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;
export type Link = z.infer<typeof linkSchema>;
export type Feed = z.infer<typeof feedSchema>;
export type FeedAuth = z.infer<typeof feedAuthSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
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
  externalFeedsEnabled: false,
  schemaVersion: SCHEMA_VERSION,
};

/** Every table of the backup file, in the order they are restored. */
export const TABLE_SCHEMAS = {
  settings: settingsSchema,
  accounts: accountSchema,
  categories: categorySchema,
  transactions: transactionSchema,
  budgetPlans: budgetPlanSchema,
  incomeSources: incomeSourceSchema,
  goals: goalSchema,
  envelopes: envelopeSchema,
  policies: insurancePolicySchema,
  dashboardLayouts: dashboardLayoutSchema,
  links: linkSchema,
  feeds: feedSchema,
  feedItems: feedItemSchema,
} as const;

export type TableName = keyof typeof TABLE_SCHEMAS;
export const TABLE_NAMES = Object.keys(TABLE_SCHEMAS) as TableName[];
