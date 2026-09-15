import { describe, expect, it } from 'vitest';

import { nextPayday, nextPaydays } from './payday';

describe('payday: the next time the money comes in', () => {
  it('waits for the day of this month while it is still ahead', () => {
    expect(nextPayday('2026-09-15', 20)).toEqual({ date: '2026-09-20', inDays: 5 });
  });

  it('counts the day itself as today, not as a month away', () => {
    expect(nextPayday('2026-09-20', 20)).toEqual({ date: '2026-09-20', inDays: 0 });
  });

  it('moves to the next month once the day has passed', () => {
    expect(nextPayday('2026-09-21', 20)).toEqual({ date: '2026-10-20', inDays: 29 });
  });

  it('pays on the last day of a month that is too short', () => {
    // February 2026 has 28 days, so the 31st becomes the 28th
    expect(nextPayday('2026-02-15', 31)).toEqual({ date: '2026-02-28', inDays: 13 });
    expect(nextPayday('2026-04-30', 31)).toEqual({ date: '2026-04-30', inDays: 0 });
  });

  it('crosses the new year without help', () => {
    expect(nextPayday('2026-12-20', 5)).toEqual({ date: '2027-01-05', inDays: 16 });
  });

  it('refuses a day that is not a day of a month', () => {
    expect(() => nextPayday('2026-09-15', 0)).toThrow();
    expect(() => nextPayday('2026-09-15', 32)).toThrow();
    expect(() => nextPayday('не дата', 10)).toThrow();
  });
});

describe('payday: several sources at once', () => {
  const sources = [
    { id: 'salary', dayOfMonth: 5 },
    { id: 'advance', dayOfMonth: 20 },
    { id: 'rent-out', dayOfMonth: 25 },
  ];

  it('puts the nearest payment first, whatever the order of the list', () => {
    const found = nextPaydays('2026-09-21', sources);
    expect(found.map((item) => [item.source.id, item.inDays])).toEqual([
      ['rent-out', 4],
      ['salary', 14],
      ['advance', 29],
    ]);
  });

  it('returns nothing for a list of nothing', () => {
    expect(nextPaydays('2026-09-21', [])).toEqual([]);
  });
});
