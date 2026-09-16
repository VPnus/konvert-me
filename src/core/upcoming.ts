/**
 * The "soon" feed: dates that are about to matter. A payment on a debt repeats every
 * month, the rest happen once — the end of a deposit, of a grace period, of a policy,
 * of a loan. Nothing here knows how it will be worded on screen.
 */

import { nextPayday } from './payday';
import { daysBetween, type IsoDate } from './time';

export type UpcomingKind = 'debt-payment' | 'deposit-maturity' | 'grace-period' | 'policy-end' | 'debt-end';

export interface UpcomingEvent {
  readonly kind: UpcomingKind;
  /** Id of the account or the policy the date belongs to. */
  readonly id: string;
  /** Its name, as the user typed it. */
  readonly name: string;
  readonly date: IsoDate;
  readonly inDays: number;
  readonly amountMinor?: number;
}

export interface UpcomingAccount {
  readonly id: string;
  readonly name: string;
  readonly side: 'asset' | 'liability';
  readonly archived?: boolean;
  readonly monthlyPaymentMinor?: number;
  readonly paymentDay?: number;
  readonly maturityDate?: IsoDate;
  readonly gracePeriodEnd?: IsoDate;
  readonly endDate?: IsoDate;
}

export interface UpcomingPolicy {
  readonly id: string;
  readonly name: string;
  readonly endDate: IsoDate;
  readonly premiumMinor?: number;
  readonly archived?: boolean;
}

export interface UpcomingParams {
  readonly today: IsoDate;
  readonly accounts: readonly UpcomingAccount[];
  readonly policies?: readonly UpcomingPolicy[];
  /** How far ahead to look; 45 days covers "next month" from any day of this one. */
  readonly horizonDays?: number;
}

export const DEFAULT_HORIZON_DAYS = 45;

export function upcomingEvents({
  today,
  accounts,
  policies = [],
  horizonDays = DEFAULT_HORIZON_DAYS,
}: UpcomingParams): UpcomingEvent[] {
  const events: UpcomingEvent[] = [];

  const add = (event: Omit<UpcomingEvent, 'inDays'>) => {
    const inDays = daysBetween(today, event.date);
    // A date that has passed is not "soon", and one beyond the horizon is not yet news.
    if (inDays < 0 || inDays > horizonDays) return;
    events.push({ ...event, inDays });
  };

  for (const account of accounts) {
    if (account.archived) continue;

    if (account.side === 'liability' && account.paymentDay) {
      const payday = nextPayday(today, account.paymentDay);
      add({
        kind: 'debt-payment',
        id: account.id,
        name: account.name,
        date: payday.date,
        amountMinor: account.monthlyPaymentMinor,
      });
    }

    if (account.maturityDate) {
      add({ kind: 'deposit-maturity', id: account.id, name: account.name, date: account.maturityDate });
    }
    if (account.gracePeriodEnd) {
      add({ kind: 'grace-period', id: account.id, name: account.name, date: account.gracePeriodEnd });
    }
    if (account.endDate && account.side === 'liability') {
      add({ kind: 'debt-end', id: account.id, name: account.name, date: account.endDate });
    }
  }

  for (const policy of policies) {
    if (policy.archived) continue;
    add({
      kind: 'policy-end',
      id: policy.id,
      name: policy.name,
      date: policy.endDate,
      amountMinor: policy.premiumMinor,
    });
  }

  return events.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name, 'ru'));
}
