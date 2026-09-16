/**
 * Stored entities of docs/PLAN.md section 4, described with Zod.
 *
 * The schemas are the gate of the storage layer: every write goes through them,
 * and the import of a backup file is validated with exactly the same rules.
 */

import { z } from 'zod';

import { RISK_PROFILES } from '@/core/portfolio';
import { isIsoDate, isIsoMonth } from '@/core/time';

export const SCHEMA_VERSION = 7;

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
  'business',
  'other_asset',
] as const;

export const LIABILITY_TYPES = ['credit_card', 'mortgage', 'consumer', 'car', 'other_debt'] as const;

/** Liquid by default, per section 4 of the plan. */
export const LIQUID_BY_DEFAULT: readonly string[] = ['cash', 'debit', 'savings'];

/**
 * Assets that are things rather than money: a home, a car, a share in a business. They are worth
 * money, but none of it is put aside for a goal, so no envelope lies on them.
 */
export const THING_ASSET_TYPES: readonly string[] = ['realty', 'vehicle', 'business'];

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

const taxYear = z
  .number()
  .int('Год должен быть целым числом')
  .min(2000, 'Год должен быть четырёхзначным')
  .max(2100, 'Год должен быть четырёхзначным');

export const DEDUCTION_STATUSES = ['draft', 'filed', 'refunded'] as const;

const monthOfYear = z
  .number()
  .int('Месяц должен быть целым числом')
  .min(1, 'Месяц должен быть от 1 до 12')
  .max(12, 'Месяц должен быть от 1 до 12');

/** A child the standard deduction is given for, and the months of the year it lasted. */
const childRightSchema = z
  .object({
    /** Place by birth among all the children, grown ones included; 3 stands for the third and on. */
    order: z.number().int().min(1, 'Очерёдность ребёнка — от первого').max(3),
    disabled: z.boolean(),
    fromMonth: monthOfYear,
    toMonth: monthOfYear,
  })
  .refine((child) => child.fromMonth <= child.toMonth, {
    message: 'Месяц начала не может быть позже месяца окончания',
  });

/**
 * What a person claims for one tax year (stage 7). The year itself is the key: there
 * is one return per year, so saving a year again replaces it.
 */
export const deductionYearSchema = z.object({
  year: taxYear,
  /** Income before tax, from the income statement — not what reached the card. */
  incomeMinor: nonNegativeMinor,
  /**
   * Spending by kind, not as one sum: the law pools the first four, but each needs its own
   * papers, and the checklist has to know which of them there were.
   */
  spending: z.object({
    /** Treatment and medicine. */
    treatmentMinor: nonNegativeMinor,
    /** One's own schooling, or a brother's or a sister's. */
    educationMinor: nonNegativeMinor,
    sportMinor: nonNegativeMinor,
    /** Voluntary medical insurance and life insurance. */
    insuranceMinor: nonNegativeMinor,
    /** Schooling paid for each child, one entry per child. */
    childEducationMinor: z.array(nonNegativeMinor).max(20),
    /** Treatment from the government's list of expensive ones. */
    expensiveTreatmentMinor: nonNegativeMinor,
  }),
  /** Contributions to an investment account and other long-term savings. */
  longTermSavingsMinor: nonNegativeMinor,
  /**
   * A home, as the return of this year states it: its cost, the interest paid, and what
   * the returns of earlier years already took — the rest of the deduction lives on.
   */
  property: z
    .object({
      purchaseMinor: nonNegativeMinor,
      mortgageInterestMinor: nonNegativeMinor,
      loanBefore2014: z.boolean(),
      /** Taken before for the home itself. Schema 7 keeps it apart from the interest, as the return does. */
      usedBeforePurchaseMinor: nonNegativeMinor,
      usedBeforeInterestMinor: nonNegativeMinor,
    })
    .optional(),
  /** The standard deduction for children: who they are, and whether the employer already gave it. */
  children: z
    .object({
      items: z.array(childRightSchema).min(1, 'Добавьте хотя бы одного ребёнка').max(20),
      double: z.boolean(),
      guardian: z.boolean(),
      appliedByEmployer: z.boolean(),
    })
    .optional(),
  /** A home sold within the year: its price, and what the tax on it can be reduced by. */
  sale: z
    .object({
      priceMinor: nonNegativeMinor,
      /** On 1 January of the year the sale was registered; 0 when not known. */
      cadastralMinor: nonNegativeMinor,
      /** The cost of buying it, with papers; 0 when there are none. */
      expensesMinor: nonNegativeMinor,
      ownedLongEnough: z.boolean(),
    })
    .optional(),
  status: z.enum(DEDUCTION_STATUSES),
  /** The papers already gathered, as 'group.item' keys of the checklist. */
  checklist: z.array(z.string().min(1).max(64)).max(200).optional(),
  note,
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const DOCUMENT_CATEGORIES = [
  'income',
  'treatment',
  'medicine',
  'schooling',
  'child_schooling',
  'sport',
  'insurance',
  'long_term_savings',
  'property',
  'mortgage',
  'children',
  'property_sale',
  'other',
] as const;

/** A scan of a contract or a photo of a receipt fits; a film of the whole flat does not. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/**
 * A receipt, a contract or an income statement behind a deduction. Only the description
 * lives here; the bytes are in documentFiles, so a list of papers never loads the papers.
 */
export const documentSchema = z.object({
  id,
  year: taxYear,
  category: z.enum(DOCUMENT_CATEGORIES),
  fileName: z.string().trim().min(1, 'У файла должно быть имя').max(255),
  mimeType: z.string().trim().min(1).max(127),
  sizeBytes: z
    .number()
    .int()
    .min(1, 'Файл пустой')
    .max(MAX_DOCUMENT_BYTES, `Файл больше ${MAX_DOCUMENT_BYTES / 1024 / 1024} МБ`),
  note,
  createdAt: timestamp,
});

/**
 * The bytes of a document, under the same id. Kept as an ArrayBuffer rather than a
 * Blob: a Blob loses its contents in the test database, and the storage layer must be
 * testable. A Blob is made from these bytes when a file is shown or saved.
 */
export const documentFileSchema = z.object({
  id,
  // Checked by its tag, not instanceof: the buffer may come from another realm.
  content: z.custom<ArrayBuffer>(
    (value) => Object.prototype.toString.call(value) === '[object ArrayBuffer]',
    {
      message: 'Содержимое файла не прочитано',
    },
  ),
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
  /** Kept for the layouts written before widgets could be resized by hand. */
  size: z.enum(['S', 'M', 'L']),
  /** Columns on a wide screen, 1 to 4 — set by dragging the corner of the widget. */
  width: z.number().int().min(1).max(4).optional(),
  /** Rows, 1 to 3. */
  height: z.number().int().min(1).max(3).optional(),
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

/** The education of one child, counted year by year (stage 8, lesson 7.3). */
export const educationPlanSchema = z.object({
  id,
  name,
  /** A year of studies — the fee and, away from home, the living — in the prices of costAsOf. */
  yearlyCostMinor: nonNegativeMinor,
  years: z.number().int('Срок учёбы — целое число лет').min(1, 'Учёба длится хотя бы год').max(10),
  costAsOf: isoMonth,
  startMonth: isoMonth,
  returnRate: rate,
  inflationRate: rate,
  /** The goal the calculation was saved as, if it was. */
  goalId: id.nullable(),
});

/** Retirement (stage 8, lesson 7.4 and formula 12). */
export const pensionPlanSchema = z
  .object({
    birthMonth: isoMonth,
    /** When the person wants to stop working — not the legal age, a choice. */
    retirementAge: z.number().int('Возраст — целое число лет').min(18).max(100),
    /** Until what age the money has to last. */
    lifeAge: z.number().int('Возраст — целое число лет').min(19).max(120),
    /** What is spent in a month now, in the prices of costAsOf. */
    monthlyExpensesMinor: nonNegativeMinor,
    replacementRate: z.number().min(0).max(2),
    /** The state pension a month, in the prices of costAsOf. */
    statePensionMinor: nonNegativeMinor,
    costAsOf: isoMonth,
    returnRate: rate,
    inflationRate: rate,
    strategy: z.enum(['keep-capital', 'spend-capital']),
    goalId: id.nullable(),
  })
  .refine((pension) => pension.lifeAge > pension.retirementAge, {
    message: 'Возраст, до которого должно хватить денег, должен быть больше возраста выхода на пенсию',
    path: ['lifeAge'],
  });

const planNote = z.string().max(2000);

/**
 * The financial plan of lesson 2.7 (stage 8). One per person, so the key is fixed. Most of
 * the plan is read from the rest of the app; here lives only what the plan adds to it.
 */
export const financialPlanSchema = z.object({
  id: z.literal('plan'),
  /** When the plan was put together: the reviews are counted from it. */
  startedOn: isoDate,
  riskProfile: z.enum(RISK_PROFILES).nullable(),
  education: z.array(educationPlanSchema).max(10),
  pension: pensionPlanSchema.nullable(),
  notes: z.object({
    mechanisms: planNote,
    protection: planNote,
    optimization: planNote,
  }),
  /** The steps of carrying the plan out that are done, by their keys. */
  doneActions: z.array(z.string().min(1).max(64)).max(200),
  quarterlyReviewedOn: isoDate.nullable(),
  yearlyReviewedOn: isoDate.nullable(),
  /** The review reminder hidden last, as 'kind:due date'; the next review brings it back. */
  reviewReminderDismissed: z.string().max(32).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
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
  /** The deduction reminder hidden last, as 'year:kind'; it stays hidden until something else comes up. */
  deductionReminderDismissed: z.string().max(32).nullable().default(null),
  /** The data-loss warning hidden last, and when: it comes back after a while, the risk has not gone. */
  dataRiskDismissed: z
    .object({ kind: z.string().max(32), at: timestamp })
    .nullable()
    .default(null),
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
export type DeductionYear = z.infer<typeof deductionYearSchema>;
export type DeductionStatus = DeductionYear['status'];
export type TaxDocument = z.infer<typeof documentSchema>;
export type DocumentCategory = TaxDocument['category'];
export type DocumentFile = z.infer<typeof documentFileSchema>;
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;
export type Link = z.infer<typeof linkSchema>;
export type Feed = z.infer<typeof feedSchema>;
export type FeedAuth = z.infer<typeof feedAuthSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type EducationPlan = z.infer<typeof educationPlanSchema>;
export type PensionPlan = z.infer<typeof pensionPlanSchema>;
export type FinancialPlan = z.infer<typeof financialPlanSchema>;
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
  deductionReminderDismissed: null,
  dataRiskDismissed: null,
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
  deductionYears: deductionYearSchema,
  documents: documentSchema,
  documentFiles: documentFileSchema,
  financialPlans: financialPlanSchema,
  dashboardLayouts: dashboardLayoutSchema,
  links: linkSchema,
  feeds: feedSchema,
  feedItems: feedItemSchema,
} as const;

export type TableName = keyof typeof TABLE_SCHEMAS;
export const TABLE_NAMES = Object.keys(TABLE_SCHEMAS) as TableName[];
