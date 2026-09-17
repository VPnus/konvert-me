/**
 * How an account and the grace period of a card are said on the screen: dates in words, sums in
 * rubles, the state of a statement in one sentence. Every number comes from src/core.
 */

import type { CardGrace } from '@/core/credit-card';
import { formatForecast } from '@/core/money';
import { todayIso, type IsoDate } from '@/core/time';
import type { Account } from '@/db/models';
import { fill, strings } from '@/i18n';

const DAY_MONTH = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

/** «14 октября 2026». */
export function fullDateLabel(date: IsoDate): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${DAY_MONTH.format(new Date(year, month - 1, day))} ${year}`;
}

/** «14 октября» within this year, «14 октября 2027» beyond it. */
export function dateLabel(date: IsoDate, today: IsoDate = todayIso()): string {
  return date.slice(0, 4) === today.slice(0, 4)
    ? fullDateLabel(date).replace(/ \d{4}$/, '')
    : fullDateLabel(date);
}

/** 0.499 → «49,9 %». */
export function rateLabel(rate: number): string {
  return `${(Math.round(rate * 10_000) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} %`;
}

const rubles = (minor: number): string => formatForecast(minor);

/** The line under an account: its type and whatever terms and dates it carries, the dates in words. */
export function accountDetails(account: Account): string {
  const d = strings.accounts.details;
  const parts: string[] = [strings.accounts.types[account.type]];
  if (account.bankName) parts.push(account.bankName);
  if (account.rate !== undefined) parts.push(fill(d.rate, { rate: rateLabel(account.rate) }));
  if (account.statementDay && account.paymentDay) {
    parts.push(fill(d.cardDays, { statement: account.statementDay, payment: account.paymentDay }));
  } else if (account.paymentDay) {
    parts.push(fill(d.payment, { day: account.paymentDay }));
  }
  if (account.maturityDate) parts.push(fill(d.maturity, { date: fullDateLabel(account.maturityDate) }));
  if (account.gracePeriodEnd && !account.statementDay) {
    parts.push(fill(d.grace, { date: fullDateLabel(account.gracePeriodEnd) }));
  }
  if (account.endDate) parts.push(fill(d.end, { date: fullDateLabel(account.endDate) }));
  return parts.join(' · ');
}

export interface CardStatus {
  readonly text: string;
  /** The grace period is lost or ended: the bank charges interest now. */
  readonly warning: boolean;
}

/** Where the grace period of a card stands, in one sentence; nothing when there is nothing to say. */
export function cardStatus(grace: CardGrace, today: IsoDate = todayIso()): CardStatus | null {
  const t = strings.cards.status;
  switch (grace.kind) {
    case 'none':
      return null;
    case 'due':
      return {
        text: fill(t.due, {
          date: dateLabel(grace.dueDate, today),
          amount: rubles(grace.remainingMinor),
          minimum: rubles(grace.minimumMinor),
        }),
        warning: false,
      };
    case 'paid':
      return { text: fill(t.paid, { date: dateLabel(grace.statementDate, today) }), warning: false };
    case 'missed':
      return {
        text: fill(t.missed, {
          statement: rubles(grace.statementMinor),
          date: dateLabel(grace.dueDate, today),
        }),
        warning: true,
      };
    case 'grace-ends':
      return {
        text: fill(t.graceEnds, { date: dateLabel(grace.date, today), amount: rubles(grace.debtMinor) }),
        warning: false,
      };
    case 'grace-ended':
      return {
        text: fill(t.graceEnded, { date: dateLabel(grace.date, today), amount: rubles(grace.debtMinor) }),
        warning: true,
      };
  }
}

/** The limit of a card and what is left of it: «Лимит 106 000 ₽, свободно 28 000 ₽». */
export function limitStatus(account: Pick<Account, 'creditLimitMinor'>, debtMinor: number): string | null {
  const limit = account.creditLimitMinor;
  if (!limit) return null;
  const t = strings.cards.status;
  return debtMinor > limit
    ? fill(t.overLimit, { limit: rubles(limit), over: rubles(debtMinor - limit) })
    : fill(t.limit, { limit: rubles(limit), free: rubles(limit - Math.max(debtMinor, 0)) });
}
