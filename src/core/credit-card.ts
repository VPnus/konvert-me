/**
 * A credit card with a grace period, by the terms the person typed from their contract. The app knows
 * no market rates: the statement day, the due day, the minimum payment and the rate are all theirs.
 *
 * Two kinds of grace period are read:
 * - a statement every month: the whole debt on the statement day is due by the payment day, and paid in
 *   full it costs nothing; otherwise the bank charges its rate from the day of every purchase;
 * - one long period for all purchases («120 дней»): the whole debt is due by one date.
 */

import { accountBalanceMinor, minimumPaymentMinor } from './balance';
import { addMonths, monthOfDate, withDayOfMonth, type IsoDate } from './time';
import type { CoreAccount, CoreTransaction } from './types';

export interface CardTerms {
  readonly statementDay?: number;
  readonly paymentDay?: number;
  /** The share of the debt the minimum payment takes, 0.08 for 8 %. */
  readonly minPaymentRate?: number;
  /** The floor of the minimum payment; for any other debt, simply its payment of a month. */
  readonly monthlyPaymentMinor?: number;
  /** The rate once the grace period is lost. */
  readonly rate?: number;
  /** One long grace period for all purchases: the day it ends. */
  readonly gracePeriodEnd?: IsoDate;
}

export type CardAccount = CoreAccount & CardTerms;

export { minimumPaymentMinor };

/** The day a statement is due: the first payment day after the statement day. */
export function statementDueDate(statementDate: IsoDate, paymentDay: number): IsoDate {
  const month = monthOfDate(statementDate);
  const sameMonth = withDayOfMonth(month, paymentDay);
  return sameMonth > statementDate ? sameMonth : withDayOfMonth(addMonths(month, 1), paymentDay);
}

/** The last statement made on or before a day. */
export function lastStatementDate(day: IsoDate, statementDay: number): IsoDate {
  const month = monthOfDate(day);
  const thisMonth = withDayOfMonth(month, statementDay);
  return thisMonth <= day ? thisMonth : withDayOfMonth(addMonths(month, -1), statementDay);
}

export type CardGrace =
  /** No grace terms, no debt, or nothing to pay by a date right now. */
  | { readonly kind: 'none' }
  /** A statement is made and not yet paid in full: this much more keeps the grace period. */
  | {
      readonly kind: 'due';
      readonly statementDate: IsoDate;
      readonly dueDate: IsoDate;
      readonly statementMinor: number;
      readonly paidMinor: number;
      readonly remainingMinor: number;
      /** What the bank asks at least for this statement; paying only this loses the grace period. */
      readonly minimumMinor: number;
    }
  /** The statement is paid in full: no interest this time. */
  | { readonly kind: 'paid'; readonly statementDate: IsoDate; readonly dueDate: IsoDate }
  /** The last due date passed with the statement not paid in full, and the debt is still there. */
  | {
      readonly kind: 'missed';
      readonly statementDate: IsoDate;
      readonly dueDate: IsoDate;
      readonly statementMinor: number;
      readonly paidMinor: number;
      readonly debtMinor: number;
      /** Interest of a month at the rate of the contract on the debt of today; null without a rate. */
      readonly monthlyInterestMinor: number | null;
    }
  /** One long grace period that has not ended: the whole debt by its date. */
  | { readonly kind: 'grace-ends'; readonly date: IsoDate; readonly debtMinor: number }
  /** One long grace period that ended with a debt left. */
  | {
      readonly kind: 'grace-ended';
      readonly date: IsoDate;
      readonly debtMinor: number;
      readonly monthlyInterestMinor: number | null;
    };

/** How much the debt of a card went down on days after one date, up to and including another. */
export function repaidMinor(
  card: CoreAccount,
  transactions: readonly CoreTransaction[],
  after: IsoDate,
  upTo: IsoDate,
): number {
  const touching = transactions
    .filter((tx) => tx.date > after && tx.date <= upTo && tx.date >= card.openingDate)
    .filter((tx) => tx.accountId === card.id || tx.toAccountId === card.id);

  // Each operation on its own: a purchase on the same day does not cancel a payment.
  return touching.reduce((total, tx) => {
    const change = accountBalanceMinor({ ...card, openingBalanceMinor: 0 }, [tx]);
    return change < 0 ? total - change : total;
  }, 0);
}

/** Whether the debt came down to nothing on some day after a date: a repaid card starts afresh. */
function repaidInFull(
  card: CoreAccount,
  transactions: readonly CoreTransaction[],
  after: IsoDate,
  upTo: IsoDate,
): boolean {
  const days = [
    ...new Set(transactions.filter((tx) => tx.date > after && tx.date <= upTo).map((tx) => tx.date)),
  ];
  return days.some((day) => accountBalanceMinor(card, transactions, { asOf: day }) <= 0);
}

function monthlyInterest(debtMinor: number, rate: number | undefined): number | null {
  return rate === undefined ? null : Math.round((debtMinor * rate) / 12);
}

/** Where the grace period of a card stands today. */
export function cardGrace(
  card: CardAccount,
  allTransactions: readonly CoreTransaction[],
  today: IsoDate,
): CardGrace {
  if (card.side !== 'liability' || card.archived) return { kind: 'none' };
  const transactions = allTransactions.filter((tx) => tx.accountId === card.id || tx.toAccountId === card.id);
  const debtMinor = accountBalanceMinor(card, transactions, { asOf: today });

  if (card.statementDay && card.paymentDay) {
    const current = lastStatementDate(today, card.statementDay);
    const currentDue = statementDueDate(current, card.paymentDay);
    // the statement whose due date passed last: this one, or the one a month before
    const previous =
      currentDue < today ? current : withDayOfMonth(addMonths(monthOfDate(current), -1), card.statementDay);
    const previousDue = statementDueDate(previous, card.paymentDay);

    if (previous >= card.openingDate && debtMinor > 0) {
      const statementMinor = accountBalanceMinor(card, transactions, { asOf: previous });
      const paidMinor = repaidMinor(card, transactions, previous, previousDue);
      if (statementMinor > paidMinor && !repaidInFull(card, transactions, previousDue, today)) {
        return {
          kind: 'missed',
          statementDate: previous,
          dueDate: previousDue,
          statementMinor,
          paidMinor,
          debtMinor,
          monthlyInterestMinor: monthlyInterest(debtMinor, card.rate),
        };
      }
    }

    if (currentDue >= today && current >= card.openingDate) {
      const statementMinor = accountBalanceMinor(card, transactions, { asOf: current });
      if (statementMinor <= 0) return { kind: 'none' };
      const paidMinor = repaidMinor(card, transactions, current, today);
      if (paidMinor >= statementMinor) return { kind: 'paid', statementDate: current, dueDate: currentDue };
      return {
        kind: 'due',
        statementDate: current,
        dueDate: currentDue,
        statementMinor,
        paidMinor,
        remainingMinor: statementMinor - paidMinor,
        minimumMinor: minimumPaymentMinor(statementMinor, card),
      };
    }
    return { kind: 'none' };
  }

  if (card.gracePeriodEnd && debtMinor > 0) {
    return today <= card.gracePeriodEnd
      ? { kind: 'grace-ends', date: card.gracePeriodEnd, debtMinor }
      : {
          kind: 'grace-ended',
          date: card.gracePeriodEnd,
          debtMinor,
          monthlyInterestMinor: monthlyInterest(debtMinor, card.rate),
        };
  }
  return { kind: 'none' };
}

/**
 * Whether the debt of a card costs nothing today: a card with a statement every month keeps its grace
 * period unless a statement was missed, a card with one long period until its date. Any other debt pays.
 */
export function graceHolds(card: CardTerms, grace: CardGrace): boolean {
  if (grace.kind === 'missed' || grace.kind === 'grace-ended') return false;
  if (card.statementDay && card.paymentDay) return true;
  return grace.kind === 'grace-ends';
}
