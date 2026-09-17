/**
 * The notice above the page about a credit card: a week and a day before its statement is due, and
 * after the due day if the statement was not paid in full. What the notice says is decided here; the
 * banner only shows it.
 */

import { cardGrace, type CardGrace } from '@/core/credit-card';
import { formatForecast } from '@/core/money';
import { daysBetween, type IsoDate } from '@/core/time';
import { db } from '@/db/db';
import type { Account } from '@/db/models';
import { dateLabel, rateLabel } from '@/features/balance/card-view';
import { fill } from '@/features/deductions/fill';
import { ru } from '@/i18n/ru';

export type CardReminderKind = 'week' | 'day' | 'grace-week' | 'grace-day' | 'missed' | 'grace-ended';

export interface CardOfReminder {
  readonly account: Pick<Account, 'id' | 'name' | 'rate'>;
  readonly grace: CardGrace;
}

export interface CardReminder extends CardOfReminder {
  readonly kind: CardReminderKind;
  /** What hiding it remembers: the next stage or the next statement brings a notice back. */
  readonly key: string;
  readonly inDays: number;
}

/** How many hidden reminders are remembered: the oldest are long past. */
const MAX_DISMISSED = 50;
const WEEK = 7;

function candidate(today: IsoDate, card: CardOfReminder): CardReminder | null {
  const { account, grace } = card;
  const stage = (inDays: number) => (inDays <= 1 ? 'day' : 'week');

  switch (grace.kind) {
    case 'missed':
      return { ...card, kind: 'missed', key: `missed:${account.id}:${grace.dueDate}`, inDays: 0 };
    case 'grace-ended':
      return { ...card, kind: 'grace-ended', key: `grace-ended:${account.id}:${grace.date}`, inDays: 0 };
    case 'due': {
      const inDays = daysBetween(today, grace.dueDate);
      if (inDays > WEEK) return null;
      const kind = stage(inDays);
      return { ...card, kind, key: `${kind}:${account.id}:${grace.dueDate}`, inDays };
    }
    case 'grace-ends': {
      const inDays = daysBetween(today, grace.date);
      if (inDays > WEEK) return null;
      const kind = stage(inDays) === 'day' ? 'grace-day' : 'grace-week';
      return { ...card, kind, key: `${kind}:${account.id}:${grace.date}`, inDays };
    }
    default:
      return null;
  }
}

/** The one notice to show: interest already charged first, then the nearest due day. */
export function cardReminder(
  today: IsoDate,
  cards: readonly CardOfReminder[],
  dismissed: readonly string[],
): CardReminder | null {
  const hidden = new Set(dismissed);
  const open = cards
    .map((card) => candidate(today, card))
    .filter((reminder): reminder is CardReminder => reminder !== null && !hidden.has(reminder.key));
  const lost = (reminder: CardReminder) => reminder.kind === 'missed' || reminder.kind === 'grace-ended';
  open.sort((a, b) => Number(lost(b)) - Number(lost(a)) || a.inDays - b.inDays);
  return open[0] ?? null;
}

export function withDismissed(dismissed: readonly string[], key: string): string[] {
  return [...dismissed.filter((item) => item !== key), key].slice(-MAX_DISMISSED);
}

export function isWarning(reminder: CardReminder): boolean {
  return reminder.kind === 'missed' || reminder.kind === 'grace-ended';
}

export function reminderText(reminder: CardReminder, today: IsoDate): string {
  const t = ru.cards.reminder;
  const { account, grace } = reminder;
  const rubles = (minor: number) => formatForecast(minor);
  const rate = account.rate === undefined ? '' : fill(t.rate, { rate: rateLabel(account.rate) });
  const when = reminder.inDays <= 0 ? t.today : t.tomorrow;

  switch (grace.kind) {
    case 'due':
      return reminder.kind === 'day'
        ? fill(t.day, { when, name: account.name, amount: rubles(grace.remainingMinor), rate })
        : fill(t.week, {
            date: dateLabel(grace.dueDate, today),
            name: account.name,
            amount: rubles(grace.remainingMinor),
            minimum: rubles(grace.minimumMinor),
          });
    case 'grace-ends':
      return reminder.kind === 'grace-day'
        ? fill(t.graceDay, { when, name: account.name, amount: rubles(grace.debtMinor), rate })
        : fill(t.graceWeek, {
            date: dateLabel(grace.date, today),
            name: account.name,
            amount: rubles(grace.debtMinor),
            rate,
          });
    case 'missed':
      return fill(t.missed, {
        name: account.name,
        date: dateLabel(grace.dueDate, today),
        paid: rubles(grace.paidMinor),
        statement: rubles(grace.statementMinor),
        rate,
        interest:
          grace.monthlyInterestMinor === null
            ? ''
            : fill(t.interest, { amount: rubles(grace.monthlyInterestMinor) }),
      });
    case 'grace-ended':
      return fill(t.graceEnded, {
        name: account.name,
        date: dateLabel(grace.date, today),
        amount: rubles(grace.debtMinor),
        rate,
        interest:
          grace.monthlyInterestMinor === null
            ? ''
            : fill(t.interest, { amount: rubles(grace.monthlyInterestMinor) }),
      });
    default:
      return '';
  }
}

/** The cards as they stand today, for the banner. */
export async function loadCards(today: IsoDate): Promise<CardOfReminder[]> {
  // Only a card with grace terms can have a reminder, and only its own operations are read: the banner
  // stands on every page, and a household may hold years of operations.
  const cards = (await db.accounts.where('side').equals('liability').toArray()).filter(
    (account) =>
      !account.archived && ((account.statementDay && account.paymentDay) || account.gracePeriodEnd),
  );
  if (cards.length === 0) return [];
  const ids = cards.map((card) => card.id);
  const transactions = await db.transactions
    .where('accountId')
    .anyOf(ids)
    .or('toAccountId')
    .anyOf(ids)
    .toArray();
  return cards
    .map((account) => ({ account, grace: cardGrace(account, transactions, today) }))
    .filter((card) => card.grace.kind !== 'none');
}
