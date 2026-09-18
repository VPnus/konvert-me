import { beforeEach, describe, expect, it } from 'vitest';

import { pensionCapitalMinor } from '@/core/pension';
import { US_RULES_2026 } from '@/core/rules/us/2026';
import { limitsOfYear } from '@/core/tax-accounts';
import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import type { CardGrace } from '@/core/credit-card';
import type { Account, EducationPlan, FinancialPlan, PensionPlan, TaxAccount } from '@/db/models';
import { createAccount } from '@/db/repositories/accounts';
import {
  emptyFinancialPlan,
  saveEducationPlan,
  savePensionPlan,
  setPlanActionDone,
} from '@/db/repositories/financial-plan';
import { seedDefaultCategories } from '@/db/repositories/categories';
import { createGoal, ensureReserveGoal, RESERVE_GOAL_ID } from '@/db/repositories/goals';
import { planActions } from '@/features/plan/actions';
import { debtQueue, savingsBenchmark } from '@/features/plan/debts';
import { actionText } from '@/features/plan/plan-format';
import { educationView, pensionView, retirementMonthOf } from '@/features/plan/calculations';
import { loadPlan } from '@/features/plan/plan-data';
import { planReviewReminder } from '@/features/plan/review';

const RUB = 100;
// The middle of September 2026: no month or year boundary is near.
const NOW = new Date(2026, 8, 16, 12);

// Lesson 7.4: 70 % of 116 149 less 26 000 of state pension, prices of January 2021, retiring at 60 in 2043.
const PENSION: PensionPlan = {
  birthMonth: '1983-01',
  retirementAge: 60,
  lifeAge: 80,
  monthlyExpensesMinor: 116_149 * RUB,
  replacementRate: 0.7,
  statePensionMinor: 26_000 * RUB,
  costAsOf: '2021-01',
  returnRate: 0.0873,
  inflationRate: 0.069,
  strategy: 'spend-capital',
  goalId: null,
};

const CHILD: EducationPlan = {
  id: 'masha',
  name: 'Маша',
  yearlyCostMinor: 600_000 * RUB,
  years: 6,
  costAsOf: '2021-09',
  startMonth: '2029-09',
  returnRate: 0.0883,
  inflationRate: 0.069,
  goalId: null,
};

beforeEach(async () => {
  await clearAllData();
});

describe('plan: the pension calculator', () => {
  it('retires in the month of the birthday', () => {
    expect(retirementMonthOf(PENSION)).toBe('2043-01');
  });

  it('counts the need in the prices of the year of retiring and both strategies from it', () => {
    const view = pensionView(PENSION, '2026-09', 0);

    expect(view.years).toBe(20);
    expect(view.months).toBe(196);
    expect(Math.round(view.need.gapAtRetirementMinor / RUB)).toBe(240_032);
    expect(view.spendCapitalMinor).toBe(
      pensionCapitalMinor({
        annualSpendingMinor: view.need.annualSpendingMinor,
        returnRate: 0.0873,
        inflationRate: 0.069,
        strategy: { kind: 'spend-capital', years: 20 },
      }),
    );
    expect(view.capitalMinor).toBe(view.spendCapitalMinor);
    expect(view.keepCapitalMinor).toBeGreaterThan(view.spendCapitalMinor);
    expect(view.drawdown).toHaveLength(20);
  });

  it('shows how soon the capital of the course would run out', () => {
    const view = pensionView(PENSION, '2026-09', 0);

    expect(view.courseRunsOutAge).not.toBeNull();
    expect(view.courseRunsOutAge ?? 0).toBeGreaterThan(60);
    expect(view.courseRunsOutAge ?? 0).toBeLessThan(80);
  });

  it('puts aside less when part of the capital is already saved, and nothing after retiring', () => {
    const fromScratch = pensionView(PENSION, '2026-09', 0).contributionMinor ?? 0;
    const withSavings = pensionView(PENSION, '2026-09', 5_000_000 * RUB).contributionMinor ?? 0;

    expect(withSavings).toBeLessThan(fromScratch);
    expect(pensionView(PENSION, '2043-01', 0).contributionMinor).toBeNull();
  });

  it('has no capital to live off when the return does not beat inflation', () => {
    const view = pensionView({ ...PENSION, strategy: 'keep-capital', returnRate: 0.05 }, '2026-09', 0);

    expect(view.keepCapitalMinor).toBeNull();
    expect(view.capitalMinor).toBeNull();
    expect(view.contributionMinor).toBeNull();
    expect(view.drawdown).toEqual([]);
  });
});

describe('plan: the education calculator', () => {
  it('shows the year-by-year capital next to the course sum, and the months until the start', () => {
    const view = educationView(CHILD, '2021-09', 0);

    expect(view.months).toBe(96);
    expect(Math.round(view.capitalMinor)).toBe(Math.round(5_825_523.25 * RUB));
    expect(Math.round(view.courseSumMinor)).toBe(Math.round(6_139_374.73 * RUB));
    expect(Math.round(view.contributionMinor ?? 0)).toBe(Math.round(41_966.08 * RUB));
    expect(Math.round(view.courseContributionMinor ?? 0)).toBe(Math.round(44_227.02 * RUB));
  });

  it('asks for nothing once the studies have begun', () => {
    const view = educationView(CHILD, '2029-09', 0);
    expect(view.contributionMinor).toBeNull();
    expect(view.courseContributionMinor).toBeNull();
  });
});

describe('plan: when to look at it again', () => {
  const plan: FinancialPlan = emptyFinancialPlan('2026-09-16');

  it('says nothing before the quarter is over', () => {
    expect(planReviewReminder(plan, '2026-12-15')).toBeNull();
    expect(planReviewReminder(undefined, '2030-01-01')).toBeNull();
  });

  it('reminds of the quarterly look, and hiding it hides only that one', () => {
    const reminder = planReviewReminder(plan, '2026-12-20');
    expect(reminder).toEqual({ kind: 'quarterly', dueOn: '2026-12-16', key: 'quarterly:2026-12-16' });

    const hidden = { ...plan, reviewReminderDismissed: reminder?.key ?? null };
    expect(planReviewReminder(hidden, '2027-01-10')).toBeNull();

    // After a look in December, the next quarter brings the reminder back.
    const looked = { ...hidden, quarterlyReviewedOn: '2026-12-20' };
    expect(planReviewReminder(looked, '2027-03-20')?.key).toBe('quarterly:2027-03-20');
  });
});

describe('plan: what there is to do', () => {
  it('an empty app still has the deductions to check and the insurance to think about', async () => {
    const data = await loadPlan(NOW);

    expect(data.started).toBe(false);
    expect(data.actions.map((action) => action.key)).toEqual(['insurance', 'deductions']);
  });

  it('names the reserve short of its norm, the goals and a debt dearer than the savings earn', async () => {
    const card = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 50_000 * RUB,
      openingDate: '2026-01-01',
    });
    await createAccount({
      name: 'Кредитка',
      side: 'liability',
      type: 'credit_card',
      openingBalanceMinor: 30_000 * RUB,
      openingDate: '2026-01-01',
      rate: 0.29,
    });
    await createAccount({
      name: 'Ипотека',
      side: 'liability',
      type: 'mortgage',
      openingBalanceMinor: 3_000_000 * RUB,
      openingDate: '2026-01-01',
      rate: 0.06,
    });
    await db.categories.add({
      id: 'food',
      name: 'Еда',
      kind: 'expense',
      group: 'variable',
      sortOrder: 0,
      archived: false,
    });
    await db.transactions.add({
      id: 't1',
      date: '2026-08-10',
      amountMinor: 90_000 * RUB,
      kind: 'expense',
      accountId: card.id,
      categoryId: 'food',
      createdAt: 1,
    });
    await ensureReserveGoal();
    const flat = await createGoal({
      name: 'Квартира',
      kind: 'purchase',
      costMinor: 3_000_000 * RUB,
      targetMonth: '2031-09',
    });

    const data = await loadPlan(NOW);
    const keys = data.actions.map((action) => action.key);

    // the card at 29 % is dearer than savings: repaid before a goal is saved for, so no contribution yet
    expect(keys).toEqual([
      'reserve',
      'insurance',
      expect.stringMatching(/^debt:/),
      `account:${flat.id}`,
      'deductions',
    ]);
    const debt = data.actions.find((action) => action.kind === 'debt');
    expect(debt?.kind === 'debt' ? debt.name : null).toBe('Кредитка');
  });

  it('still asks to choose an account for a goal whose only envelope lies on a home', async () => {
    const flat = await createAccount({
      name: 'Квартира',
      side: 'asset',
      type: 'realty',
      openingBalanceMinor: 9_000_000 * RUB,
      openingDate: '2026-01-01',
    });
    const goal = await createGoal({
      name: 'Дача',
      kind: 'purchase',
      costMinor: 2_000_000 * RUB,
      targetMonth: '2031-09',
    });
    // written before envelopes were kept to money
    await db.envelopes.add({ id: 'old', goalId: goal.id, accountId: flat.id, amountMinor: 1_000_000 * RUB });

    const data = await loadPlan(NOW);

    expect(data.actions.map((action) => action.key)).toContain(`account:${goal.id}`);
  });

  it('builds the same list from its parts', () => {
    const actions = planActions({
      goals: [],
      reserve: { reserveMinor: 0, months: null, targetMinor: null, norm: null, status: 'unknown' },
      accounts: [],
      policies: [
        {
          id: 'p',
          name: 'Жизнь',
          type: 'life',
          endDate: '2027-01-01',
          archived: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      settings: { defaultReturnRate: 0.1 },
    });
    expect(actions.map((action) => action.key)).toEqual(['deductions']);
  });

  it('puts the match of an employer before the debts, and the tax accounts after them', () => {
    const plan: TaxAccount = {
      id: 'plan',
      name: '401(k) at work',
      kind: '401k',
      catchUp: 'none',
      familyCoverage: false,
      matchShare: 0.5,
      matchUpToShareOfPay: 0.06,
      years: [{ year: 2026, ownMinor: 2_000_00, employerMinor: 1_000_00 }],
      archived: false,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    const hsa: TaxAccount = {
      ...plan,
      id: 'hsa',
      name: 'HSA',
      kind: 'hsa',
      matchShare: undefined,
      matchUpToShareOfPay: undefined,
      years: [],
    };

    const params = {
      goals: [],
      reserve: { reserveMinor: 0, months: null, targetMinor: null, norm: null, status: 'unknown' as const },
      accounts: [],
      policies: [],
      settings: { defaultReturnRate: 0.1 },
      country: 'us' as const,
      taxAccounts: [plan, hsa],
      taxLimits: limitsOfYear(
        [plan, hsa],
        new Map([
          ['plan', { ownMinor: 2_000_00, employerMinor: 1_000_00 }],
          ['hsa', { ownMinor: 0, employerMinor: 0 }],
        ]),
        US_RULES_2026,
      ),
      taxYear: 2026,
      annualPayMinor: 100_000_00,
    };

    const actions = planActions(params);
    expect(actions.map((action) => action.key)).toEqual([
      'insurance',
      'match:plan:2026',
      'tax-room:hsa:2026',
    ]);
    // 6 % of 100 000 is 6 000, of which 2 000 is already in
    const match = actions.find((action) => action.kind === 'match');
    expect(match?.kind === 'match' ? match.amountMinor : null).toBe(4_000_00);
  });

  it('says nothing of a match already taken in full, and nothing of tax accounts in Russia', () => {
    const plan: TaxAccount = {
      id: 'plan',
      name: '401(k) at work',
      kind: '401k',
      catchUp: 'none',
      familyCoverage: false,
      matchShare: 0.5,
      matchUpToShareOfPay: 0.06,
      years: [{ year: 2026, ownMinor: 6_000_00, employerMinor: 3_000_00 }],
      archived: false,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    const params = {
      goals: [],
      reserve: { reserveMinor: 0, months: null, targetMinor: null, norm: null, status: 'unknown' as const },
      accounts: [],
      policies: [],
      settings: { defaultReturnRate: 0.1 },
      taxAccounts: [plan],
      taxLimits: limitsOfYear(
        [plan],
        new Map([['plan', { ownMinor: 6_000_00, employerMinor: 3_000_00 }]]),
        US_RULES_2026,
      ),
      taxYear: 2026,
      annualPayMinor: 100_000_00,
    };

    expect(planActions({ ...params, country: 'us' }).map((action) => action.key)).toEqual(['insurance']);
    expect(planActions({ ...params, country: 'ru' }).map((action) => action.key)).toEqual([
      'insurance',
      'deductions',
    ]);
  });

  it('asks to check the deductions only in Russia, where they exist', () => {
    const params = {
      goals: [],
      reserve: { reserveMinor: 0, months: null, targetMinor: null, norm: null, status: 'unknown' as const },
      accounts: [],
      policies: [],
      settings: { defaultReturnRate: 0.1 },
    };
    const keys = (country: 'ru' | 'us') => planActions({ ...params, country }).map((action) => action.key);
    expect(keys('ru')).toEqual(['insurance', 'deductions']);
    expect(keys('us')).toEqual(['insurance']);
  });
});

describe('plan: one queue of the debts', () => {
  const account = (patch: Partial<Account>): Account => ({
    id: 'a',
    name: 'Счёт',
    side: 'liability',
    type: 'consumer',
    currency: 'RUB',
    openingBalanceMinor: 0,
    openingDate: '2026-06-01',
    isLiquid: false,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  });
  const reserve = {
    reserveMinor: 0,
    months: null,
    targetMinor: null,
    norm: null,
    status: 'unknown' as const,
  };
  const life = {
    id: 'p',
    name: 'Жизнь',
    type: 'life' as const,
    endDate: '2027-01-01',
    archived: false,
    createdAt: 1,
    updatedAt: 1,
  };

  // The worker of 17.09.2026: a card with its statement due, two dear debts, a repaid card, a piggy bank at 15,5 %.
  const accounts = [
    account({ id: 'loan', name: 'Потребительский кредит', rate: 0.219 }),
    account({ id: 'old', name: 'Кредитная карта', type: 'credit_card', rate: 0.299 }),
    account({ id: 'closed', name: 'Старая карта', type: 'credit_card', rate: 0.35 }),
    account({
      id: 'platinum',
      name: 'Кредитка Платинум',
      type: 'credit_card',
      rate: 0.499,
      statementDay: 19,
      paymentDay: 14,
    }),
    account({ id: 'mortgage', name: 'Ипотека', type: 'mortgage', rate: 0.06 }),
    account({
      id: 'kopilka',
      name: 'Копилка на миллион',
      side: 'asset',
      type: 'savings',
      rate: 0.155,
      isLiquid: true,
    }),
  ];
  const balances = new Map([
    ['loan', 230_000 * RUB],
    ['old', 60_848 * RUB],
    ['closed', 0],
    ['platinum', 14_000 * RUB],
    ['mortgage', 3_000_000 * RUB],
    ['kopilka', 6_055 * RUB],
  ]);
  const cards = new Map<string, CardGrace>([
    [
      'platinum',
      {
        kind: 'due',
        statementDate: '2026-09-19',
        dueDate: '2026-10-14',
        statementMinor: 14_000 * RUB,
        paidMinor: 0,
        remainingMinor: 14_000 * RUB,
        minimumMinor: 1_120 * RUB,
      },
    ],
  ]);

  it('puts the statement first, then the dear debts by rate, and leaves out the repaid and the cheap', () => {
    const benchmark = savingsBenchmark(accounts, balances, 0.1);
    expect(benchmark).toEqual({ rate: 0.155, accountName: 'Копилка на миллион' });

    const queue = debtQueue({ accounts, balances, cards, benchmark });
    expect(queue.map((debt) => [debt.account.id, debt.dear, debt.free, Boolean(debt.statement)])).toEqual([
      ['platinum', false, true, true],
      ['old', true, false, false],
      ['loan', true, false, false],
      ['mortgage', false, false, false],
    ]);

    const actions = planActions({
      goals: [],
      reserve,
      accounts,
      policies: [life],
      settings: { defaultReturnRate: 0.1 },
      balances,
      cards,
      availableMinor: -3_083 * RUB,
    });
    expect(actions.map((action) => action.key)).toEqual([
      'statement:platinum:2026-10-14',
      'debt:old',
      'debt:loan',
      'deductions',
    ]);
    expect(actionText(actions[0]).replace(/\s/g, ' ')).toBe(
      'Внести на «Кредитка Платинум» всю выписку, 14 000 ₽, до 14 октября 2026 года: тогда проценты не начислят',
    );
  });

  it('asks to save for a goal only when the debts leave money and none is dearer than savings', async () => {
    await ensureReserveGoal();
    const goal = await createGoal({
      name: 'Дача',
      kind: 'purchase',
      costMinor: 1_000_000 * RUB,
      targetMonth: '2031-09',
    });
    const view = (await loadPlan(NOW)).goals.goals.find((item) => item.goal.id === goal.id);
    if (!view) throw new Error('no goal');
    const cheap = [accounts[4], accounts[5]];
    const params = {
      goals: [view],
      reserve,
      policies: [life],
      settings: { defaultReturnRate: 0.1 },
      balances,
      cards: new Map<string, CardGrace>(),
    };

    const keys = (patch: object) =>
      planActions({ ...params, accounts: cheap, ...patch }).map((action) => action.key);
    expect(keys({ availableMinor: 5_000 * RUB })).toContain(`contribution:${goal.id}`);
    expect(keys({ availableMinor: -1 })).not.toContain(`contribution:${goal.id}`);
    expect(keys({ availableMinor: 5_000 * RUB, accounts })).not.toContain(`contribution:${goal.id}`);
  });
});

describe('plan: the whole screen', () => {
  it('reads what the plan saved and keeps the ticks of the actions', async () => {
    await saveEducationPlan({ ...CHILD, startMonth: '2034-09' }, '2026-09-16');
    await savePensionPlan(PENSION, '2026-09-16');
    await setPlanActionDone('deductions', true, '2026-09-16');

    const data = await loadPlan(NOW);

    expect(data.started).toBe(true);
    expect(data.plan.startedOn).toBe('2026-09-16');
    expect(data.education).toHaveLength(1);
    expect(data.education[0].months).toBe(96);
    expect(data.pension?.retirementMonth).toBe('2043-01');
    expect(data.plan.doneActions).toEqual(['deductions']);
    expect(data.review.nextQuarterly).toBe('2026-12-16');
  });

  it('calls a budget with no money left over balanced, and says where the numbers came from', async () => {
    const data = await loadPlan(NOW);

    expect(data.budget.balance).toBe('balanced');
    expect(data.budget.source).toBe('month');
  });
});

describe('plan: a usual month, whatever the day', () => {
  /** The worker of the scenario audit: 65 000 a month in two parts, three debts, rent. */
  async function worker() {
    await seedDefaultCategories();
    await ensureReserveGoal();
    const card = await createAccount({
      name: 'Зарплатная карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 22_000 * RUB,
      openingDate: '2026-06-01',
    });
    for (const debt of [
      { name: 'Кредит', type: 'consumer' as const, balance: 230_000, payment: 9_800, rate: 0.219 },
      { name: 'Кредитка', type: 'credit_card' as const, balance: 60_000, payment: 3_000, rate: 0.299 },
      { name: 'Рассрочка', type: 'other_debt' as const, balance: 8_000, payment: 4_000, rate: 0 },
    ]) {
      await createAccount({
        name: debt.name,
        side: 'liability',
        type: debt.type,
        openingBalanceMinor: debt.balance * RUB,
        openingDate: '2026-06-01',
        monthlyPaymentMinor: debt.payment * RUB,
        rate: debt.rate,
      });
    }
    let id = 0;
    const add = (date: string, kind: 'income' | 'expense', rubles: number, categoryId: string) =>
      db.transactions.add({
        id: `t${(id += 1)}`,
        date,
        amountMinor: rubles * RUB,
        kind,
        accountId: card.id,
        categoryId,
        createdAt: 1,
      });
    for (const month of ['2026-06', '2026-07', '2026-08']) {
      await add(`${month}-10`, 'income', 39_000, 'salary');
      await add(`${month}-25`, 'income', 26_000, 'advance');
      await add(`${month}-05`, 'expense', 4_949, 'loan-interest');
      await add(`${month}-12`, 'expense', 51_051, 'groceries');
    }
    // The 16th of September: the salary has come, the advance has not.
    await add('2026-09-10', 'income', 39_000, 'salary');
    await add('2026-09-05', 'expense', 4_777, 'loan-interest');
    await add('2026-09-12', 'expense', 40_000, 'groceries');
    return createGoal({
      name: 'Первый миллион',
      kind: 'other',
      costMinor: 1_000_000 * RUB,
      targetMonth: '2031-09',
    });
  }

  it('judges the budget and the debt burden by the complete months, not by the 16th', async () => {
    await worker();
    const data = await loadPlan(NOW);

    expect(data.budget.source).toBe('fact');
    expect(data.budget.months).toBe(3);
    expect(data.budget.incomeMinor).toBe(65_000 * RUB);
    expect(data.budget.freeCashMinor).toBe(9_000 * RUB);
    expect(data.budget.balance).toBe('surplus');
    // 16 800 of payments against 65 000, not against the 39 000 that has come so far
    expect(data.overview.debtBurden.ratio).toBeCloseTo(16_800 / 65_000, 10);
    expect(data.overview.warnings.map((warning) => warning.id)).not.toContain('free-cash');
  });

  it('takes the principal due out of the free money before anything is handed out', async () => {
    await worker();
    const { goals } = await loadPlan(NOW);

    // 16 800 of payments, 4 949 of them interest already among the expenses
    expect(goals.principalDueMinor).toBe(11_851 * RUB);
    expect(goals.availableMinor).toBe(-2_851 * RUB);
    expect(goals.allocations.every((allocation) => allocation.allocatedMinor === 0)).toBe(true);
  });

  it('asks for the reserve first, and only then for the goals', async () => {
    const goal = await worker();
    const { goals } = await loadPlan(NOW);

    expect(goals.allocations.map((allocation) => allocation.goalId)).toEqual([RESERVE_GOAL_ID, goal.id]);
    // 10 % of the income of a usual month
    expect(goals.allocations[0].requiredMinor).toBe(6_500 * RUB);
  });

  it('gives the reserve its share before a goal that is more important than all the others', async () => {
    await seedDefaultCategories();
    await ensureReserveGoal();
    const card = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 0,
      openingDate: '2026-06-01',
    });
    for (const [index, month] of ['2026-06', '2026-07', '2026-08'].entries()) {
      await db.transactions.bulkAdd([
        {
          id: `in${index}`,
          date: `${month}-10`,
          amountMinor: 100_000 * RUB,
          kind: 'income',
          accountId: card.id,
          categoryId: 'salary',
          createdAt: 1,
        },
        {
          id: `out${index}`,
          date: `${month}-11`,
          amountMinor: 80_000 * RUB,
          kind: 'expense',
          accountId: card.id,
          categoryId: 'groceries',
          createdAt: 1,
        },
      ]);
    }
    const car = await createGoal({
      name: 'Машина',
      kind: 'purchase',
      costMinor: 600_000 * RUB,
      targetMonth: '2027-09',
    });

    const { goals } = await loadPlan(NOW);
    const [reserve, carAllocation] = goals.allocations;

    expect(reserve.goalId).toBe(RESERVE_GOAL_ID);
    expect(reserve.allocatedMinor).toBe(10_000 * RUB);
    expect(carAllocation.goalId).toBe(car.id);
    expect(carAllocation.allocatedMinor).toBe(10_000 * RUB);
  });
});
