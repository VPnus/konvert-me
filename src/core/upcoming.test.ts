import { describe, expect, it } from 'vitest';

import { upcomingEvents, type UpcomingAccount } from './upcoming';

const card: UpcomingAccount = {
  id: 'card',
  name: 'Кредитная карта',
  side: 'liability',
  monthlyPaymentMinor: 5_000 * 100,
  paymentDay: 20,
  gracePeriodEnd: '2026-10-05',
};

const deposit: UpcomingAccount = {
  id: 'deposit',
  name: 'Вклад',
  side: 'asset',
  maturityDate: '2026-09-30',
};

const loan: UpcomingAccount = {
  id: 'loan',
  name: 'Автокредит',
  side: 'liability',
  monthlyPaymentMinor: 12_000 * 100,
  paymentDay: 5,
  endDate: '2026-10-20',
};

describe('upcoming: what is about to matter', () => {
  it('puts the nearest date first and says how far it is', () => {
    const events = upcomingEvents({ today: '2026-09-15', accounts: [card, deposit, loan] });

    expect(events.map((event) => [event.kind, event.name, event.date, event.inDays])).toEqual([
      ['debt-payment', 'Кредитная карта', '2026-09-20', 5],
      ['deposit-maturity', 'Вклад', '2026-09-30', 15],
      // two dates land on the same day, so they go by name
      ['debt-payment', 'Автокредит', '2026-10-05', 20],
      ['grace-period', 'Кредитная карта', '2026-10-05', 20],
      ['debt-end', 'Автокредит', '2026-10-20', 35],
    ]);
  });

  it('carries the payment of a debt and the premium of a policy', () => {
    const events = upcomingEvents({
      today: '2026-09-15',
      accounts: [card],
      policies: [{ id: 'osago', name: 'ОСАГО', endDate: '2026-09-25', premiumMinor: 9_000 * 100 }],
    });

    expect(events[0].amountMinor).toBe(5_000 * 100);
    expect(events.find((event) => event.kind === 'policy-end')?.amountMinor).toBe(9_000 * 100);
  });

  it('keeps out what has passed, what is too far, and what is archived', () => {
    const events = upcomingEvents({
      today: '2026-09-15',
      accounts: [
        { id: 'old', name: 'Старый вклад', side: 'asset', maturityDate: '2026-09-01' },
        { id: 'far', name: 'Долгий вклад', side: 'asset', maturityDate: '2027-09-01' },
        { ...deposit, id: 'hidden', archived: true },
      ],
      policies: [{ id: 'gone', name: 'Старый полис', endDate: '2026-09-20', archived: true }],
    });

    expect(events).toEqual([]);
  });

  it('counts today as soon, not as gone', () => {
    const events = upcomingEvents({
      today: '2026-09-30',
      accounts: [deposit],
    });

    expect(events).toHaveLength(1);
    expect(events[0].inDays).toBe(0);
  });

  it('looks only as far as it is asked to', () => {
    const near = upcomingEvents({ today: '2026-09-15', accounts: [card, loan], horizonDays: 7 });
    expect(near.map((event) => event.name)).toEqual(['Кредитная карта']);
  });

  it('does not invent a payment day for an asset', () => {
    const events = upcomingEvents({
      today: '2026-09-15',
      accounts: [{ id: 'savings', name: 'Накопительный', side: 'asset', paymentDay: 20 }],
    });

    expect(events).toEqual([]);
  });
});
