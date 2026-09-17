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

  it('asks a card for the whole statement by its due day, and says the minimum after it', () => {
    const platinum: UpcomingAccount = {
      id: 'platinum',
      name: 'Кредитка Платинум',
      side: 'liability',
      paymentDay: 14,
      statementDay: 19,
      monthlyPaymentMinor: 600 * 100,
      minPaymentRate: 0.08,
      balanceMinor: 78_000 * 100,
      grace: {
        kind: 'due',
        statementDate: '2026-09-19',
        dueDate: '2026-10-14',
        statementMinor: 14_000 * 100,
        paidMinor: 0,
        remainingMinor: 14_000 * 100,
        minimumMinor: 1_120 * 100,
      },
    };

    expect(upcomingEvents({ today: '2026-10-13', accounts: [platinum] })).toEqual([
      {
        kind: 'card-statement',
        id: 'platinum',
        name: 'Кредитка Платинум',
        date: '2026-10-14',
        inDays: 1,
        amountMinor: 14_000 * 100,
        minimumMinor: 1_120 * 100,
      },
    ]);

    // paid, or between the due day and the next statement: nothing to ask
    expect(
      upcomingEvents({ today: '2026-10-15', accounts: [{ ...platinum, grace: { kind: 'none' } }] }),
    ).toEqual([]);

    // a statement missed: the card pays like any debt, 8 % of the debt of today
    const missed = upcomingEvents({
      today: '2026-10-15',
      accounts: [
        {
          ...platinum,
          grace: {
            kind: 'missed',
            statementDate: '2026-09-19',
            dueDate: '2026-10-14',
            statementMinor: 14_000 * 100,
            paidMinor: 0,
            debtMinor: 78_000 * 100,
            monthlyInterestMinor: 324_350,
          },
        },
      ],
    });
    expect(missed).toMatchObject([{ kind: 'debt-payment', date: '2026-11-14', amountMinor: 6_240 * 100 }]);
  });

  it('asks nothing of a debt repaid, and the whole debt by the end of one long grace period', () => {
    const repaid = upcomingEvents({
      today: '2026-09-15',
      accounts: [
        { ...card, balanceMinor: 0 },
        { ...loan, balanceMinor: 0 },
      ],
    });
    expect(repaid).toEqual([]);

    const events = upcomingEvents({
      today: '2026-09-15',
      accounts: [{ ...card, balanceMinor: 3_000 * 100 }],
    });
    expect(events).toMatchObject([
      // the payment is never more than the debt
      { kind: 'debt-payment', amountMinor: 3_000 * 100 },
      { kind: 'grace-period', date: '2026-10-05', amountMinor: 3_000 * 100 },
    ]);
  });

  it('does not invent a payment day for an asset', () => {
    const events = upcomingEvents({
      today: '2026-09-15',
      accounts: [{ id: 'savings', name: 'Накопительный', side: 'asset', paymentDay: 20 }],
    });

    expect(events).toEqual([]);
  });
});
