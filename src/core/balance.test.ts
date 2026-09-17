import { describe, expect, it } from 'vitest';

import {
  accountBalanceMinor,
  monthlyDebtPaymentsMinor,
  totalAssetsMinor,
  averageMonthlyExpenses,
  debtBurden,
  envelopesFitAccount,
  liquidAssetsMinor,
  netWorthMinor,
  recommendedReserveContributionMinor,
  reserveNorm,
  reserveState,
  totalLiabilitiesMinor,
  netWorthSeries,
  depositsByBank,
  liquidEnvelopesMinor,
  principalDueMinor,
  reserveContributionMinor,
} from './balance';
import type { CoreAccount, CoreEnvelope, CoreTransaction } from './types';

const RUB = 100;
const r = (rubles: number): number => Math.round(rubles * RUB);

const debit: CoreAccount = {
  id: 'debit',
  side: 'asset',
  isLiquid: true,
  openingBalanceMinor: r(100_000),
  openingDate: '2026-01-01',
};

const savings: CoreAccount = {
  id: 'savings',
  side: 'asset',
  isLiquid: true,
  openingBalanceMinor: r(300_000),
  openingDate: '2026-01-01',
};

const flat: CoreAccount = {
  id: 'flat',
  side: 'asset',
  isLiquid: false,
  openingBalanceMinor: r(5_000_000),
  openingDate: '2026-01-01',
};

const card: CoreAccount = {
  id: 'card',
  side: 'liability',
  isLiquid: false,
  openingBalanceMinor: r(20_000),
  openingDate: '2026-01-01',
  monthlyPaymentMinor: r(5_000),
};

const mortgage: CoreAccount = {
  id: 'mortgage',
  side: 'liability',
  isLiquid: false,
  openingBalanceMinor: r(3_000_000),
  openingDate: '2026-01-01',
  monthlyPaymentMinor: r(35_000),
};

describe('balance: an account balance is derived, never stored', () => {
  it('adds income and subtracts expenses on an asset', () => {
    const txs: CoreTransaction[] = [
      {
        date: '2026-02-01',
        kind: 'income',
        amountMinor: r(50_000),
        accountId: 'debit',
        categoryId: 'salary',
      },
      { date: '2026-02-02', kind: 'expense', amountMinor: r(20_000), accountId: 'debit', categoryId: 'food' },
      { date: '2026-02-03', kind: 'refund', amountMinor: r(2_000), accountId: 'debit', categoryId: 'food' },
    ];
    expect(accountBalanceMinor(debit, txs)).toBe(r(132_000));
  });

  it('moves money between accounts on a transfer', () => {
    const txs: CoreTransaction[] = [
      {
        date: '2026-02-04',
        kind: 'transfer',
        amountMinor: r(30_000),
        accountId: 'debit',
        toAccountId: 'savings',
      },
    ];
    expect(accountBalanceMinor(debit, txs)).toBe(r(70_000));
    expect(accountBalanceMinor(savings, txs)).toBe(r(330_000));
  });

  it('grows a card debt on a purchase and shrinks it on repayment', () => {
    const txs: CoreTransaction[] = [
      { date: '2026-02-05', kind: 'expense', amountMinor: r(7_000), accountId: 'card', categoryId: 'food' },
      {
        date: '2026-02-20',
        kind: 'transfer',
        amountMinor: r(10_000),
        accountId: 'debit',
        toAccountId: 'card',
      },
    ];
    expect(accountBalanceMinor(card, txs)).toBe(r(17_000));
    expect(accountBalanceMinor(debit, txs)).toBe(r(90_000));
  });

  it('applies adjustments and revaluations in the stated direction', () => {
    const txs: CoreTransaction[] = [
      {
        date: '2026-03-01',
        kind: 'adjustment',
        amountMinor: r(500),
        accountId: 'debit',
        direction: 'decrease',
      },
      {
        date: '2026-03-02',
        kind: 'revaluation',
        amountMinor: r(400_000),
        accountId: 'flat',
        direction: 'increase',
      },
    ];
    expect(accountBalanceMinor(debit, txs)).toBe(r(99_500));
    expect(accountBalanceMinor(flat, txs)).toBe(r(5_400_000));
  });

  it('can be taken as of a date', () => {
    const txs: CoreTransaction[] = [
      {
        date: '2026-02-01',
        kind: 'income',
        amountMinor: r(50_000),
        accountId: 'debit',
        categoryId: 'salary',
      },
      {
        date: '2026-03-01',
        kind: 'income',
        amountMinor: r(50_000),
        accountId: 'debit',
        categoryId: 'salary',
      },
    ];
    expect(accountBalanceMinor(debit, txs, { asOf: '2026-02-15' })).toBe(r(150_000));
  });

  it('treats an adjustment without a direction as an increase', () => {
    const txs: CoreTransaction[] = [
      { date: '2026-03-01', kind: 'adjustment', amountMinor: r(500), accountId: 'debit' },
    ];
    expect(accountBalanceMinor(debit, txs)).toBe(r(100_500));
  });

  it('applies an adjustment to a debt in the stated direction', () => {
    const txs: CoreTransaction[] = [
      {
        date: '2026-03-01',
        kind: 'adjustment',
        amountMinor: r(1_000),
        accountId: 'card',
        direction: 'increase',
      },
    ];
    expect(accountBalanceMinor(card, txs)).toBe(r(21_000));
  });

  it('ignores an adjustment addressed to another account', () => {
    const txs: CoreTransaction[] = [
      {
        date: '2026-03-01',
        kind: 'adjustment',
        amountMinor: r(1_000),
        accountId: 'savings',
        direction: 'increase',
      },
    ];
    expect(accountBalanceMinor(debit, txs)).toBe(r(100_000));
  });

  it('ignores a transfer between two other accounts', () => {
    const txs: CoreTransaction[] = [
      {
        date: '2026-03-01',
        kind: 'transfer',
        amountMinor: r(1_000),
        accountId: 'savings',
        toAccountId: 'card',
      },
    ];
    expect(accountBalanceMinor(debit, txs)).toBe(r(100_000));
  });

  it('leaves out operations dated before the account was opened', () => {
    // The opening balance is stated on its date and already holds everything before it:
    // an old payment typed in later must not move today's balance a second time.
    const loan: CoreAccount = {
      id: 'loan',
      side: 'liability',
      isLiquid: false,
      openingBalanceMinor: r(230_000),
      openingDate: '2026-09-16',
    };
    const txs: CoreTransaction[] = [
      {
        date: '2026-08-05',
        kind: 'transfer',
        amountMinor: r(5_400),
        accountId: 'debit',
        toAccountId: 'loan',
      },
      {
        date: '2026-09-16',
        kind: 'transfer',
        amountMinor: r(1_000),
        accountId: 'debit',
        toAccountId: 'loan',
      },
    ];
    expect(accountBalanceMinor(loan, txs)).toBe(r(229_000));
    // The account the money left had been open all along, so it did move.
    expect(accountBalanceMinor(debit, txs)).toBe(r(93_600));
  });

  it('ignores transactions of other accounts', () => {
    const txs: CoreTransaction[] = [
      {
        date: '2026-02-01',
        kind: 'expense',
        amountMinor: r(1_000),
        accountId: 'savings',
        categoryId: 'food',
      },
    ];
    expect(accountBalanceMinor(debit, txs)).toBe(r(100_000));
  });
});

describe('balance: net worth (formula 11)', () => {
  const accounts = [debit, savings, flat, card, mortgage];

  it('subtracts liabilities from assets', () => {
    expect(netWorthMinor(accounts, [])).toBe(r(2_380_000));
    expect(totalLiabilitiesMinor(accounts, [])).toBe(r(3_020_000));
  });

  it('can be negative', () => {
    expect(netWorthMinor([debit, mortgage], [])).toBe(-r(2_900_000));
  });

  it('sums every asset, liquid or not', () => {
    expect(totalAssetsMinor(accounts, [])).toBe(r(5_400_000));
  });

  it('counts only liquid assets for the reserve', () => {
    expect(liquidAssetsMinor(accounts, [])).toBe(r(400_000));
  });

  it('skips archived accounts', () => {
    expect(liquidAssetsMinor([{ ...savings, archived: true }, debit], [])).toBe(r(100_000));
  });
});

describe('balance: scheduled debt payments', () => {
  it('sums the monthly payments of active debts only', () => {
    expect(monthlyDebtPaymentsMinor([debit, card, mortgage], [])).toBe(r(40_000));
    expect(monthlyDebtPaymentsMinor([{ ...card, archived: true }, mortgage], [])).toBe(r(35_000));
    expect(monthlyDebtPaymentsMinor([{ ...card, monthlyPaymentMinor: undefined }], [])).toBe(0);
    expect(monthlyDebtPaymentsMinor([], [])).toBe(0);
  });

  it('asks of a card its share of the debt of today, and nothing of a repaid debt', () => {
    // «Платинум» after a transfer: 8 % of 71 000, not the 600 typed when the debt was 14 000
    const platinum: CoreAccount = {
      id: 'platinum',
      side: 'liability',
      isLiquid: false,
      openingBalanceMinor: r(14_000),
      openingDate: '2026-09-01',
      monthlyPaymentMinor: r(600),
      minPaymentRate: 0.08,
    };
    const transfer: CoreTransaction = {
      date: '2026-09-20',
      amountMinor: r(57_000),
      kind: 'transfer',
      accountId: 'platinum',
      toAccountId: 'old-card',
    };
    expect(monthlyDebtPaymentsMinor([platinum], [])).toBe(r(1_120));
    expect(monthlyDebtPaymentsMinor([platinum], [transfer])).toBe(r(5_680));

    // the old card, repaid by that transfer, asks nothing; a loan near its end asks what is left
    const oldCard: CoreAccount = {
      ...card,
      id: 'old-card',
      openingBalanceMinor: r(57_000),
      openingDate: '2026-09-01',
    };
    expect(monthlyDebtPaymentsMinor([oldCard], [transfer])).toBe(0);
    expect(monthlyDebtPaymentsMinor([{ ...mortgage, openingBalanceMinor: r(20_000) }], [])).toBe(r(20_000));
  });
});

describe('balance: debt burden (formula 10)', () => {
  it('is fine up to 25 percent', () => {
    const result = debtBurden(r(25_000), r(100_000));
    expect(result.ratio).toBeCloseTo(0.25, 10);
    expect(result.status).toBe('normal');
  });

  it('asks for attention between 25 and 30 percent', () => {
    expect(debtBurden(r(28_000), r(100_000)).status).toBe('attention');
    expect(debtBurden(r(30_000), r(100_000)).status).toBe('attention');
  });

  it('is tense above 30 percent', () => {
    expect(debtBurden(r(31_000), r(100_000)).status).toBe('tense');
  });

  it('has no ratio without income', () => {
    expect(debtBurden(r(10_000), 0)).toEqual({ ratio: null, status: 'unknown' });
  });

  it('is normal with no debts at all', () => {
    expect(debtBurden(0, r(100_000))).toEqual({ ratio: 0, status: 'normal' });
  });
});

describe('balance: average monthly expenses', () => {
  const expenses: CoreTransaction[] = [
    { date: '2026-06-10', kind: 'expense', amountMinor: r(60_000), accountId: 'debit', categoryId: 'food' },
    { date: '2026-07-10', kind: 'expense', amountMinor: r(80_000), accountId: 'debit', categoryId: 'food' },
    { date: '2026-08-10', kind: 'expense', amountMinor: r(70_000), accountId: 'debit', categoryId: 'food' },
    {
      date: '2026-09-10',
      kind: 'expense',
      amountMinor: r(1_000_000),
      accountId: 'debit',
      categoryId: 'food',
    },
    {
      date: '2026-05-10',
      kind: 'expense',
      amountMinor: r(1_000_000),
      accountId: 'debit',
      categoryId: 'food',
    },
  ];

  it('averages the three last complete months and ignores the current one', () => {
    expect(averageMonthlyExpenses({ transactions: expenses, currentMonth: '2026-09' })).toEqual({
      source: 'fact',
      valueMinor: r(70_000),
      months: 3,
    });
  });

  it('falls back to the plan of the current month when there is no fact', () => {
    expect(
      averageMonthlyExpenses({
        transactions: [],
        currentMonth: '2026-09',
        planExpenseMinor: r(55_000),
      }),
    ).toEqual({ source: 'plan', valueMinor: r(55_000), months: 0 });
  });

  it('ignores a zero or negative plan when there is no fact', () => {
    expect(
      averageMonthlyExpenses({ transactions: [], currentMonth: '2026-09', planExpenseMinor: 0 }),
    ).toEqual({ source: 'none', valueMinor: 0, months: 0 });
  });

  it('ignores income when averaging expenses', () => {
    const withIncome: CoreTransaction[] = [
      {
        date: '2026-08-01',
        kind: 'income',
        amountMinor: r(300_000),
        accountId: 'debit',
        categoryId: 'salary',
      },
    ];
    expect(averageMonthlyExpenses({ transactions: withIncome, currentMonth: '2026-09' }).source).toBe('none');
  });

  it('ignores transfers when averaging expenses', () => {
    const withTransfer: CoreTransaction[] = [
      {
        date: '2026-08-01',
        kind: 'transfer',
        amountMinor: r(300_000),
        accountId: 'debit',
        toAccountId: 'savings',
      },
    ];
    expect(averageMonthlyExpenses({ transactions: withTransfer, currentMonth: '2026-09' }).source).toBe(
      'none',
    );
  });

  it('reports that there is no data instead of returning zero', () => {
    expect(averageMonthlyExpenses({ transactions: [], currentMonth: '2026-09' })).toEqual({
      source: 'none',
      valueMinor: 0,
      months: 0,
    });
  });

  it('divides by the months since the records began, not always by three', () => {
    // A first month of records is a month of spending, not a third of one: dividing
    // 90 000 by three made a new user's reserve look three times bigger.
    const single: CoreTransaction[] = [
      { date: '2026-08-10', kind: 'expense', amountMinor: r(90_000), accountId: 'debit', categoryId: 'food' },
    ];
    expect(averageMonthlyExpenses({ transactions: single, currentMonth: '2026-09' })).toEqual({
      source: 'fact',
      valueMinor: r(90_000),
      months: 1,
    });

    const two: CoreTransaction[] = [
      { date: '2026-07-10', kind: 'expense', amountMinor: r(50_000), accountId: 'debit', categoryId: 'food' },
      ...single,
    ];
    expect(averageMonthlyExpenses({ transactions: two, currentMonth: '2026-09' })).toEqual({
      source: 'fact',
      valueMinor: r(70_000),
      months: 2,
    });
  });

  it('counts a month without spending between two months with it', () => {
    const gap: CoreTransaction[] = [
      { date: '2026-06-10', kind: 'expense', amountMinor: r(60_000), accountId: 'debit', categoryId: 'food' },
      { date: '2026-08-10', kind: 'expense', amountMinor: r(30_000), accountId: 'debit', categoryId: 'food' },
    ];
    expect(averageMonthlyExpenses({ transactions: gap, currentMonth: '2026-09' })).toEqual({
      source: 'fact',
      valueMinor: r(30_000),
      months: 3,
    });
  });

  it('nets refunds out of the average', () => {
    const withRefund: CoreTransaction[] = [
      { date: '2026-08-10', kind: 'expense', amountMinor: r(90_000), accountId: 'debit', categoryId: 'food' },
      { date: '2026-08-11', kind: 'refund', amountMinor: r(30_000), accountId: 'debit', categoryId: 'food' },
    ];
    expect(averageMonthlyExpenses({ transactions: withRefund, currentMonth: '2026-09' }).valueMinor).toBe(
      r(60_000),
    );
  });
});

describe('balance: financial reserve (formula 9)', () => {
  it('lesson 2.5 — 70 000 of expenses means 210 000 to 420 000', () => {
    expect(reserveNorm(r(70_000))).toEqual({ minMinor: r(210_000), maxMinor: r(420_000) });
  });

  it('excludes envelopes of other goals from the reserve', () => {
    const state = reserveState({
      liquidMinor: r(400_000),
      otherGoalsEnvelopesMinor: r(150_000),
      averageExpenses: { source: 'fact', valueMinor: r(70_000), months: 3 },
      targetMonths: 6,
    });
    expect(state.reserveMinor).toBe(r(250_000));
    expect(state.months).toBeCloseTo(250_000 / 70_000, 10);
    expect(state.targetMinor).toBe(r(420_000));
    expect(state.status).toBe('partial');
  });

  it('never reports a negative reserve', () => {
    const state = reserveState({
      liquidMinor: r(100_000),
      otherGoalsEnvelopesMinor: r(150_000),
      averageExpenses: { source: 'fact', valueMinor: r(70_000), months: 3 },
      targetMonths: 6,
    });
    expect(state.reserveMinor).toBe(0);
    expect(state.status).toBe('empty');
  });

  it('is done once it reaches the target months', () => {
    const state = reserveState({
      liquidMinor: r(500_000),
      otherGoalsEnvelopesMinor: 0,
      averageExpenses: { source: 'fact', valueMinor: r(70_000), months: 3 },
      targetMonths: 6,
    });
    expect(state.status).toBe('done');
  });

  it('cannot say how many months it covers when the average expense is zero', () => {
    const state = reserveState({
      liquidMinor: r(400_000),
      otherGoalsEnvelopesMinor: 0,
      averageExpenses: { source: 'fact', valueMinor: 0, months: 3 },
      targetMonths: 6,
    });
    expect(state.status).toBe('unknown');
    expect(state.norm).toBeNull();
  });

  it('cannot say how many months it covers without expense data', () => {
    const state = reserveState({
      liquidMinor: r(400_000),
      otherGoalsEnvelopesMinor: 0,
      averageExpenses: { source: 'none', valueMinor: 0, months: 0 },
      targetMonths: 6,
    });
    expect(state.months).toBeNull();
    expect(state.targetMinor).toBeNull();
    expect(state.status).toBe('unknown');
  });

  it('suggests 10 percent of income while the reserve is being built', () => {
    expect(recommendedReserveContributionMinor(r(150_000))).toBe(r(15_000));
    expect(recommendedReserveContributionMinor(r(150_000), 0.2)).toBe(r(30_000));
    expect(recommendedReserveContributionMinor(0)).toBe(0);
  });
});

describe('balance: envelopes never exceed the account balance', () => {
  it('accepts envelopes within the balance', () => {
    expect(envelopesFitAccount(r(100_000), r(100_000))).toBe(true);
    expect(envelopesFitAccount(r(100_000), r(40_000))).toBe(true);
  });

  it('rejects envelopes above the balance', () => {
    expect(envelopesFitAccount(r(100_000), r(100_001))).toBe(false);
  });
});

describe('balance: capital month by month', () => {
  const accounts: CoreAccount[] = [
    {
      id: 'card',
      side: 'asset',
      isLiquid: true,
      openingBalanceMinor: 100_000 * RUB,
      openingDate: '2026-07-01',
    },
    {
      id: 'loan',
      side: 'liability',
      isLiquid: false,
      openingBalanceMinor: 60_000 * RUB,
      openingDate: '2026-08-01',
    },
  ];

  const transactions: CoreTransaction[] = [
    { date: '2026-08-10', kind: 'income', amountMinor: 20_000 * RUB, accountId: 'card', categoryId: 'pay' },
    {
      date: '2026-09-05',
      kind: 'transfer',
      amountMinor: 10_000 * RUB,
      accountId: 'card',
      toAccountId: 'loan',
    },
  ];

  it('counts every month with the operations up to its last day', () => {
    const series = netWorthSeries(accounts, transactions, '2026-07', '2026-09');

    expect(series.map((point) => [point.month, point.assetsMinor, point.liabilitiesMinor])).toEqual([
      // july: only the card exists yet
      ['2026-07', 100_000 * RUB, 0],
      // august: the loan appears, the salary lands
      ['2026-08', 120_000 * RUB, 60_000 * RUB],
      // september: 10 000 moved from the card to the loan
      ['2026-09', 110_000 * RUB, 50_000 * RUB],
    ]);
    expect(series[2].netWorthMinor).toBe(60_000 * RUB);
  });

  it('agrees with the plain net worth on the last month', () => {
    const series = netWorthSeries(accounts, transactions, '2026-07', '2026-09');
    expect(series[series.length - 1].netWorthMinor).toBe(netWorthMinor(accounts, transactions));
  });
});

describe('balance: money in one bank against the insurance limit', () => {
  const LIMIT = 1_400_000 * RUB;

  const deposits = [
    {
      id: 'd1',
      side: 'asset' as const,
      isLiquid: true,
      openingBalanceMinor: 900_000 * RUB,
      openingDate: '2026-01-01',
      bankName: 'Банк А',
      insurable: true,
    },
    {
      id: 'd2',
      side: 'asset' as const,
      isLiquid: true,
      openingBalanceMinor: 700_000 * RUB,
      openingDate: '2026-01-01',
      bankName: 'Банк А',
      insurable: true,
    },
    {
      id: 'd3',
      side: 'asset' as const,
      isLiquid: true,
      openingBalanceMinor: 500_000 * RUB,
      openingDate: '2026-01-01',
      bankName: 'Банк Б',
      insurable: true,
    },
  ];

  it('adds up the deposits of one bank and says how much is not insured', () => {
    const groups = depositsByBank(deposits, [], LIMIT);

    expect(groups[0]).toMatchObject({
      bankName: 'Банк А',
      amountMinor: 1_600_000 * RUB,
      overLimit: true,
      excessMinor: 200_000 * RUB,
    });
    expect(groups[0].accountIds).toEqual(['d1', 'd2']);
    expect(groups[1]).toMatchObject({ bankName: 'Банк Б', overLimit: false, excessMinor: 0 });
  });

  it('leaves out what is not a deposit, has no bank, or is empty', () => {
    const groups = depositsByBank(
      [
        { ...deposits[0], id: 'shares', insurable: false },
        { ...deposits[0], id: 'nobank', bankName: '  ' },
        { ...deposits[0], id: 'empty', openingBalanceMinor: 0 },
        { ...deposits[0], id: 'archived', archived: true },
      ],
      [],
      LIMIT,
    );

    expect(groups).toEqual([]);
  });
});

describe('balance: the reserve subtracts only what other goals keep on liquid accounts', () => {
  const accounts: CoreAccount[] = [
    debit,
    savings,
    {
      id: 'broker',
      side: 'asset',
      isLiquid: false,
      openingBalanceMinor: r(1_000_000),
      openingDate: '2026-01-01',
    },
    {
      id: 'old-card',
      side: 'asset',
      isLiquid: true,
      openingBalanceMinor: r(10_000),
      openingDate: '2026-01-01',
      archived: true,
    },
  ];

  it('leaves out envelopes on a brokerage account, archived accounts and the reserve itself', () => {
    const envelopes: CoreEnvelope[] = [
      { goalId: 'flat', accountId: 'broker', amountMinor: r(1_000_000) },
      { goalId: 'flat', accountId: 'savings', amountMinor: r(120_000) },
      { goalId: 'car', accountId: 'debit', amountMinor: r(30_000) },
      { goalId: 'car', accountId: 'old-card', amountMinor: r(10_000) },
      { goalId: 'reserve', accountId: 'savings', amountMinor: r(50_000) },
    ];
    expect(liquidEnvelopesMinor(envelopes, accounts, 'reserve')).toBe(r(150_000));
  });

  it('is zero without envelopes', () => {
    expect(liquidEnvelopesMinor([], accounts, 'reserve')).toBe(0);
  });
});

describe('balance: the principal due is not free money', () => {
  const debts: CoreAccount[] = [
    {
      id: 'loan',
      side: 'liability',
      isLiquid: false,
      openingBalanceMinor: r(230_000),
      openingDate: '2026-01-01',
      monthlyPaymentMinor: r(9_800),
    },
    {
      id: 'card',
      side: 'liability',
      isLiquid: false,
      openingBalanceMinor: r(60_000),
      openingDate: '2026-01-01',
      monthlyPaymentMinor: r(3_000),
    },
    {
      id: 'phone',
      side: 'liability',
      isLiquid: false,
      openingBalanceMinor: r(8_000),
      openingDate: '2026-01-01',
      monthlyPaymentMinor: r(4_000),
    },
  ];

  it('is the scheduled payments less the interest already counted as an expense', () => {
    // The worker of the scenario audit: 16 800 a month, of which 5 949 is interest.
    expect(principalDueMinor(debts, [], r(5_949))).toBe(r(10_851));
  });

  it('is the whole payment when the interest is not written down separately', () => {
    expect(principalDueMinor(debts, [], 0)).toBe(r(16_800));
  });

  it('never goes below zero and skips archived debts', () => {
    expect(principalDueMinor(debts, [], r(20_000))).toBe(0);
    expect(principalDueMinor([{ ...debts[0], archived: true }], [], 0)).toBe(0);
  });
});

describe('balance: what the reserve asks of a month', () => {
  const partial = reserveState({
    liquidMinor: r(37_200),
    otherGoalsEnvelopesMinor: 0,
    averageExpenses: { source: 'fact', valueMinor: r(56_849), months: 3 },
    targetMonths: 6,
  });

  it('asks for 10 percent of income while the reserve is below its target', () => {
    expect(reserveContributionMinor(partial, r(65_000))).toBe(r(6_500));
  });

  it('never asks for more than what is missing', () => {
    const almost = reserveState({
      liquidMinor: r(339_000),
      otherGoalsEnvelopesMinor: 0,
      averageExpenses: { source: 'fact', valueMinor: r(56_849), months: 3 },
      targetMonths: 6,
    });
    expect(reserveContributionMinor(almost, r(65_000))).toBe(r(56_849) * 6 - r(339_000));
  });

  it('asks for nothing once the reserve is done or cannot be counted', () => {
    const done = reserveState({
      liquidMinor: r(500_000),
      otherGoalsEnvelopesMinor: 0,
      averageExpenses: { source: 'fact', valueMinor: r(50_000), months: 3 },
      targetMonths: 6,
    });
    const unknown = reserveState({
      liquidMinor: r(10_000),
      otherGoalsEnvelopesMinor: 0,
      averageExpenses: { source: 'none', valueMinor: 0, months: 0 },
      targetMonths: 6,
    });
    expect(reserveContributionMinor(done, r(65_000))).toBe(0);
    expect(reserveContributionMinor(unknown, r(65_000))).toBe(0);
  });
});
