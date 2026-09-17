/**
 * A transfer from a credit card is money borrowed, whatever it pays off. Before it is saved the form
 * says when it has to come back and whether a usual month leaves money for it (finding 4 of the
 * report of 17.09.2026).
 */

import { accountBalanceMinor } from '@/core/balance';
import { lastStatementDate, statementDueDate } from '@/core/credit-card';
import { formatForecast } from '@/core/money';
import { addMonths, monthOfDate, withDayOfMonth, type IsoDate } from '@/core/time';
import { db } from '@/db/db';
import type { Account } from '@/db/models';
import { dateLabel, rateLabel } from '@/features/balance/card-view';
import { loadGoals } from '@/features/goals/goals-data';
import { fill, strings } from '@/i18n';

export interface CardTransferContext {
  readonly card: Account;
  readonly debtMinor: number;
  /** Formula 8 of a usual month: what is left after the principal of the debts. */
  readonly availableMinor: number;
  /** Transfers from the card already made in the month of the new one. */
  readonly transfersInMonthMinor: number;
}

/** The statement a transfer made on a day falls into, and the day that statement is due. */
export function statementOfDay(
  date: IsoDate,
  terms: Pick<Account, 'statementDay' | 'paymentDay'>,
): { statement: IsoDate; due: IsoDate } | null {
  if (!terms.statementDay || !terms.paymentDay) return null;
  const last = lastStatementDate(date, terms.statementDay);
  const statement =
    last === date ? last : withDayOfMonth(addMonths(monthOfDate(last), 1), terms.statementDay);
  return { statement, due: statementDueDate(statement, terms.paymentDay) };
}

export async function loadCardTransfer(cardId: string, date: IsoDate): Promise<CardTransferContext | null> {
  const [card, transactions, goals] = await Promise.all([
    db.accounts.get(cardId),
    db.transactions.toArray(),
    loadGoals(),
  ]);
  if (!card || card.side !== 'liability' || card.type !== 'credit_card') return null;

  const month = monthOfDate(date);
  return {
    card,
    debtMinor: accountBalanceMinor(card, transactions, { asOf: date }),
    availableMinor: goals.availableMinor,
    transfersInMonthMinor: transactions
      .filter((tx) => tx.kind === 'transfer' && tx.accountId === cardId && tx.date.startsWith(month))
      .reduce((total, tx) => total + tx.amountMinor, 0),
  };
}

/** What the form says of a transfer from a card, sentence by sentence. */
export function cardTransferWarning(
  context: CardTransferContext,
  amountMinor: number,
  destination: Account | undefined,
  date: IsoDate,
): string[] {
  const t = strings.cards.transfer;
  const rubles = (minor: number) => formatForecast(minor);
  const { card } = context;
  const lines: string[] = [];

  const cycle = statementOfDay(date, card);
  lines.push(
    cycle
      ? fill(t.statement, {
          statement: dateLabel(cycle.statement, date),
          due: dateLabel(cycle.due, date),
          amount: rubles(Math.max(context.debtMinor, 0) + amountMinor),
        })
      : t.noTerms,
  );
  lines.push(
    context.availableMinor > 0 ? fill(t.free, { amount: rubles(context.availableMinor) }) : t.noFree,
  );
  if (
    destination?.side === 'liability' &&
    destination.rate !== undefined &&
    card.rate !== undefined &&
    card.rate > destination.rate
  ) {
    lines.push(fill(t.dearer, { from: rateLabel(destination.rate), to: rateLabel(card.rate) }));
  }
  if (card.freeTransfersMinor !== undefined) {
    const left = card.freeTransfersMinor - context.transfersInMonthMinor;
    if (amountMinor > left) lines.push(fill(t.overLimit, { left: rubles(Math.max(left, 0)) }));
  }
  return lines;
}
