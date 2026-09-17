import { describe, expect, it } from 'vitest';

import {
  cardGrace,
  graceHolds,
  lastStatementDate,
  minimumPaymentMinor,
  repaidMinor,
  statementDueDate,
  type CardAccount,
} from './credit-card';
import type { CoreTransaction } from './types';

const r = (rubles: number) => Math.round(rubles * 100);

/**
 * «Платинум» of the worker of the scenario report of 17.09.2026, by the terms he typed from his
 * contract: statement on the 19th, the whole of it due by the 14th, 8 % but not less than 600 ₽ a
 * month, 49,9 % once the grace period is lost. Groceries of 3 500 ₽ on it every week.
 */
const platinum: CardAccount = {
  id: 'platinum',
  side: 'liability',
  isLiquid: false,
  openingBalanceMinor: 0,
  openingDate: '2026-08-20',
  statementDay: 19,
  paymentDay: 14,
  minPaymentRate: 0.08,
  monthlyPaymentMinor: r(600),
  rate: 0.499,
};

let made = 0;
const purchase = (date: string, rubles = 3_500): CoreTransaction => ({
  id: `p${(made += 1)}`,
  date,
  amountMinor: r(rubles),
  kind: 'expense',
  accountId: 'platinum',
  categoryId: 'groceries',
});
const payment = (date: string, rubles: number): CoreTransaction => ({
  id: `pay${(made += 1)}`,
  date,
  amountMinor: r(rubles),
  kind: 'transfer',
  accountId: 'debit',
  toAccountId: 'platinum',
});

const groceries = ['2026-08-20', '2026-08-27', '2026-09-06', '2026-09-13'].map((date) => purchase(date));
// Variant A: 50 000 moved to the old card on the 20th, groceries go on.
const variantA = [
  ...groceries,
  {
    ...purchase('2026-09-20', 50_000),
    kind: 'transfer' as const,
    toAccountId: 'old-card',
    categoryId: undefined,
  },
  ...['2026-09-20', '2026-09-27', '2026-10-06', '2026-10-13'].map((date) => purchase(date)),
];

describe('credit card: the minimum payment', () => {
  it('is the share of the debt, not less than the floor and not more than the debt', () => {
    expect(minimumPaymentMinor(r(14_000), platinum)).toBe(r(1_120));
    expect(minimumPaymentMinor(r(71_000), platinum)).toBe(r(5_680));
    expect(minimumPaymentMinor(r(5_000), platinum)).toBe(r(600));
    expect(minimumPaymentMinor(r(300), platinum)).toBe(r(300));
    expect(minimumPaymentMinor(0, platinum)).toBe(0);
    expect(minimumPaymentMinor(-r(10), platinum)).toBe(0);
  });

  it('is the payment of a month for a debt without a share', () => {
    expect(minimumPaymentMinor(r(60_848.34), { monthlyPaymentMinor: r(3_000) })).toBe(r(3_000));
    expect(minimumPaymentMinor(r(60_848.34), {})).toBe(0);
  });
});

describe('credit card: the dates of a statement', () => {
  it('is due on the first payment day after the statement day', () => {
    expect(statementDueDate('2026-09-19', 14)).toBe('2026-10-14');
    expect(statementDueDate('2026-09-05', 25)).toBe('2026-09-25');
    // a day the month lacks becomes its last day
    expect(statementDueDate('2026-01-31', 30)).toBe('2026-02-28');
  });

  it('finds the last statement made on or before a day', () => {
    expect(lastStatementDate('2026-10-13', 19)).toBe('2026-09-19');
    expect(lastStatementDate('2026-10-19', 19)).toBe('2026-10-19');
    expect(lastStatementDate('2026-03-01', 31)).toBe('2026-02-28');
  });

  it('counts what paid the debt down: payments and refunds, not purchases', () => {
    const refund: CoreTransaction = { ...purchase('2026-09-25', 500), kind: 'refund' };
    const txs = [...variantA, payment('2026-09-25', 1_000), refund];
    expect(repaidMinor(platinum, txs, '2026-09-19', '2026-10-14')).toBe(r(1_500));
    expect(repaidMinor(platinum, txs, '2026-09-25', '2026-10-14')).toBe(0);
  });
});

describe('credit card: where the grace period stands', () => {
  it('asks for nothing before the first statement', () => {
    expect(cardGrace(platinum, groceries, '2026-09-17')).toEqual({ kind: 'none' });
  });

  it('asks for the whole statement, not the minimum, until the due day', () => {
    expect(cardGrace(platinum, variantA, '2026-09-20')).toEqual({
      kind: 'due',
      statementDate: '2026-09-19',
      dueDate: '2026-10-14',
      statementMinor: r(14_000),
      paidMinor: 0,
      remainingMinor: r(14_000),
      minimumMinor: r(1_120),
    });

    // the minimum payment the bank app showed, 5 680, does not keep the grace period
    const grace = cardGrace(platinum, [...variantA, payment('2026-10-10', 5_680)], '2026-10-13');
    expect(grace).toMatchObject({ kind: 'due', paidMinor: r(5_680), remainingMinor: r(8_320) });
    expect(cardGrace(platinum, [...variantA, payment('2026-10-10', 5_680)], '2026-10-14').kind).toBe('due');
  });

  it('knows the grace period is lost once the due day passed with the statement not paid in full', () => {
    const txs = [...variantA, payment('2026-10-10', 5_680)];
    expect(cardGrace(platinum, txs, '2026-10-15')).toEqual({
      kind: 'missed',
      statementDate: '2026-09-19',
      dueDate: '2026-10-14',
      statementMinor: r(14_000),
      paidMinor: r(5_680),
      debtMinor: r(72_320),
      // 72 320 × 49,9 % / 12
      monthlyInterestMinor: 300_731,
    });
    // a month on it is still lost: the next statement is not what matters any more
    expect(cardGrace(platinum, txs, '2026-10-20').kind).toBe('missed');
  });

  it('moves to the next statement when the last one was paid in full', () => {
    const txs = [...variantA, payment('2026-10-10', 14_000)];
    expect(cardGrace(platinum, txs, '2026-10-12')).toEqual({
      kind: 'paid',
      statementDate: '2026-09-19',
      dueDate: '2026-10-14',
    });
    expect(cardGrace(platinum, txs, '2026-10-15')).toEqual({ kind: 'none' });
    // the transfer of 50 000 is in the statement of 19 October and due whole by 14 November
    expect(cardGrace(platinum, txs, '2026-10-20')).toMatchObject({
      kind: 'due',
      statementDate: '2026-10-19',
      dueDate: '2026-11-14',
      remainingMinor: r(64_000),
      minimumMinor: r(5_120),
    });
  });

  it('starts afresh once the whole debt is repaid after a missed statement', () => {
    const txs = [...variantA, payment('2026-10-16', 78_000), purchase('2026-10-17')];
    expect(cardGrace(platinum, txs, '2026-10-18')).toEqual({ kind: 'none' });
  });

  it('reads one long grace period by its date', () => {
    const card: CardAccount = {
      ...platinum,
      statementDay: undefined,
      gracePeriodEnd: '2026-10-14',
    };
    expect(cardGrace(card, groceries, '2026-10-01')).toEqual({
      kind: 'grace-ends',
      date: '2026-10-14',
      debtMinor: r(14_000),
    });
    expect(cardGrace(card, groceries, '2026-10-15')).toEqual({
      kind: 'grace-ended',
      date: '2026-10-14',
      debtMinor: r(14_000),
      monthlyInterestMinor: Math.round((r(14_000) * 0.499) / 12),
    });
    expect(cardGrace({ ...card, rate: undefined }, groceries, '2026-10-15')).toMatchObject({
      monthlyInterestMinor: null,
    });
    expect(cardGrace(card, [...groceries, payment('2026-10-01', 14_000)], '2026-10-15')).toEqual({
      kind: 'none',
    });
  });

  it('has nothing to say of an asset, an archived card or a card without terms', () => {
    expect(cardGrace({ ...platinum, side: 'asset' }, groceries, '2026-09-20')).toEqual({ kind: 'none' });
    expect(cardGrace({ ...platinum, archived: true }, groceries, '2026-09-20')).toEqual({ kind: 'none' });
    const plain: CardAccount = { ...platinum, statementDay: undefined, paymentDay: undefined };
    expect(cardGrace(plain, groceries, '2026-09-20')).toEqual({ kind: 'none' });
  });

  it('says whose debt costs nothing today', () => {
    const txs = [...variantA, payment('2026-10-10', 5_680)];
    expect(graceHolds(platinum, cardGrace(platinum, txs, '2026-10-13'))).toBe(true);
    expect(graceHolds(platinum, cardGrace(platinum, txs, '2026-10-15'))).toBe(false);
    // between the due day and the next statement a card with statements still costs nothing
    expect(graceHolds(platinum, { kind: 'none' })).toBe(true);
    expect(
      graceHolds({ gracePeriodEnd: '2026-10-14' }, { kind: 'grace-ends', date: '2026-10-14', debtMinor: 1 }),
    ).toBe(true);
    expect(graceHolds({}, { kind: 'none' })).toBe(false);
  });
});
