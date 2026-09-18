import { describe, expect, it } from 'vitest';

import {
  monthlyAmountMinor,
  monthlyOn,
  monthlyTotalMinor,
  nextPayday,
  nextPaydays,
  type PaySchedule,
} from './payday';

describe('payday: once a month', () => {
  it('waits for the day of this month while it is still ahead', () => {
    expect(nextPayday('2026-09-15', monthlyOn(20))).toEqual({ date: '2026-09-20', inDays: 5 });
  });

  it('counts the day itself as today, not as a month away', () => {
    expect(nextPayday('2026-09-20', monthlyOn(20))).toEqual({ date: '2026-09-20', inDays: 0 });
  });

  it('moves to the next month once the day has passed', () => {
    expect(nextPayday('2026-09-21', monthlyOn(20))).toEqual({ date: '2026-10-20', inDays: 29 });
  });

  it('pays on the last day of a month that is too short', () => {
    // February 2026 has 28 days, so the 31st becomes the 28th
    expect(nextPayday('2026-02-15', monthlyOn(31))).toEqual({ date: '2026-02-28', inDays: 13 });
    expect(nextPayday('2026-04-30', monthlyOn(31))).toEqual({ date: '2026-04-30', inDays: 0 });
  });

  it('crosses the new year without help', () => {
    expect(nextPayday('2026-12-20', monthlyOn(5))).toEqual({ date: '2027-01-05', inDays: 16 });
  });

  it('refuses a day that is not a day of a month', () => {
    expect(() => nextPayday('2026-09-15', monthlyOn(0))).toThrow();
    expect(() => nextPayday('2026-09-15', monthlyOn(32))).toThrow();
    expect(() => nextPayday('не дата', monthlyOn(10))).toThrow();
  });
});

describe('payday: twice a month', () => {
  const twice: PaySchedule = { kind: 'semimonthly', dayOfMonth: 15, secondDayOfMonth: 31 };

  it('takes whichever of the two days comes first', () => {
    expect(nextPayday('2026-09-01', twice).date).toBe('2026-09-15');
    expect(nextPayday('2026-09-16', twice).date).toBe('2026-09-30');
  });

  it('moves to the earlier day of the next month once both have passed', () => {
    expect(nextPayday('2026-10-31', twice)).toEqual({ date: '2026-10-31', inDays: 0 });
    expect(nextPayday('2026-11-01', twice)).toEqual({ date: '2026-11-15', inDays: 14 });
  });

  it('goes to the next month once both days of this one have passed', () => {
    const early: PaySchedule = { kind: 'semimonthly', dayOfMonth: 15, secondDayOfMonth: 20 };
    expect(nextPayday('2026-09-21', early)).toEqual({ date: '2026-10-15', inDays: 24 });
  });

  it('pays the last day of a short month for a day it does not have', () => {
    // the 31st of February 2026 is its 28th, and the 15th still comes first
    expect(nextPayday('2026-02-16', twice).date).toBe('2026-02-28');
  });

  it('does not mind the two days standing in the other order', () => {
    const swapped: PaySchedule = { kind: 'semimonthly', dayOfMonth: 31, secondDayOfMonth: 15 };
    expect(nextPayday('2026-09-01', swapped).date).toBe('2026-09-15');
    expect(nextPayday('2026-09-16', swapped).date).toBe('2026-09-30');
  });
});

describe('payday: every fourteen days', () => {
  const fortnight: PaySchedule = { kind: 'biweekly', firstDate: '2026-09-04' };

  it('waits for the first payment while it is still ahead', () => {
    expect(nextPayday('2026-08-20', fortnight)).toEqual({ date: '2026-09-04', inDays: 15 });
  });

  it('counts the payment day itself as today', () => {
    expect(nextPayday('2026-09-04', fortnight).inDays).toBe(0);
    expect(nextPayday('2026-09-18', fortnight).inDays).toBe(0);
  });

  it('steps by a fortnight, whatever the length of the month', () => {
    expect(nextPayday('2026-09-05', fortnight).date).toBe('2026-09-18');
    expect(nextPayday('2026-09-19', fortnight).date).toBe('2026-10-02');
    // the two paydays of October fall on the 2nd, the 16th and the 30th
    expect(nextPayday('2026-10-17', fortnight).date).toBe('2026-10-30');
  });

  it('crosses the new year without help', () => {
    expect(nextPayday('2026-12-26', fortnight).date).toBe('2027-01-08');
  });

  it('refuses a first payment that is not a date', () => {
    expect(() => nextPayday('2026-09-15', { kind: 'biweekly', firstDate: 'не дата' })).toThrow();
  });
});

describe('payday: what a payment is worth in an ordinary month', () => {
  it('leaves a monthly pay alone', () => {
    expect(monthlyAmountMinor(100_000_00, monthlyOn(5))).toBe(100_000_00);
  });

  it('doubles a pay that comes twice a month', () => {
    expect(monthlyAmountMinor(1_500_00, { kind: 'semimonthly', dayOfMonth: 15, secondDayOfMonth: 31 })).toBe(
      3_000_00,
    );
  });

  it('spreads 26 fortnightly payments over twelve months, not 24', () => {
    // 1 000 every fourteen days is 26 000 a year, so 2 166,67 a month and not 2 000
    expect(monthlyAmountMinor(1_000_00, { kind: 'biweekly', firstDate: '2026-09-04' })).toBe(2_166_67);
  });
});

describe('payday: what every source brings in a month together', () => {
  it('adds the sources up, each by its own schedule', () => {
    expect(
      monthlyTotalMinor([
        { amountMinor: 1_000_00, schedule: { kind: 'biweekly', firstDate: '2026-09-04' } },
        { amountMinor: 30_000_00, schedule: monthlyOn(5) },
      ]),
    ).toBe(32_166_67);
  });

  it('counts a source with no amount as nothing, and an empty list as zero', () => {
    expect(monthlyTotalMinor([{ schedule: monthlyOn(5) }])).toBe(0);
    expect(monthlyTotalMinor([])).toBe(0);
  });
});

describe('payday: several sources at once', () => {
  const sources = [
    { id: 'salary', schedule: monthlyOn(5) },
    { id: 'advance', schedule: monthlyOn(20) },
    { id: 'rent-out', schedule: monthlyOn(25) },
  ];

  it('puts the nearest payment first, whatever the order of the list', () => {
    const found = nextPaydays('2026-09-21', sources);
    expect(found.map((item) => [item.source.id, item.inDays])).toEqual([
      ['rent-out', 4],
      ['salary', 14],
      ['advance', 29],
    ]);
  });

  it('mixes schedules of different kinds in one list', () => {
    const mixed = [
      { id: 'salary', schedule: { kind: 'biweekly', firstDate: '2026-09-04' } as const },
      { id: 'rent-out', schedule: monthlyOn(25) },
    ];
    expect(nextPaydays('2026-09-21', mixed).map((item) => [item.source.id, item.date])).toEqual([
      ['rent-out', '2026-09-25'],
      ['salary', '2026-10-02'],
    ]);
  });

  it('sorts two payments of the same day by the source, so the order never wobbles', () => {
    const same = [
      { id: 'rent-out', schedule: monthlyOn(25) },
      { id: 'advance', schedule: monthlyOn(25) },
    ];
    expect(nextPaydays('2026-09-21', same).map((item) => item.source.id)).toEqual(['advance', 'rent-out']);
  });

  it('returns nothing for a list of nothing', () => {
    expect(nextPaydays('2026-09-21', [])).toEqual([]);
  });
});
