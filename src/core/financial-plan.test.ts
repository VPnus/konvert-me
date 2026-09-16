import { describe, expect, it } from 'vitest';

import { budgetBalance, reviewState } from './financial-plan';

describe('financial plan: the kind of budget', () => {
  it('is in deficit when income is below the spending, balanced when equal, in surplus above', () => {
    expect(budgetBalance(-1)).toBe('deficit');
    expect(budgetBalance(0)).toBe('balanced');
    expect(budgetBalance(1)).toBe('surplus');
  });
});

describe('financial plan: when to look at it again', () => {
  it('a plan made today is reviewed in a quarter and in a year', () => {
    const state = reviewState({ startedOn: '2026-09-16', today: '2026-09-16' });

    expect(state.nextQuarterly).toBe('2026-12-16');
    expect(state.nextYearly).toBe('2027-09-16');
    expect(state.due).toBeNull();
  });

  it('asks for the quarterly look once three months have passed', () => {
    expect(reviewState({ startedOn: '2026-09-16', today: '2026-12-15' }).due).toBeNull();
    expect(reviewState({ startedOn: '2026-09-16', today: '2026-12-16' }).due).toBe('quarterly');
  });

  it('counts the next quarter from the last look', () => {
    const state = reviewState({
      startedOn: '2026-09-16',
      quarterlyReviewedOn: '2027-01-10',
      today: '2027-03-01',
    });

    expect(state.nextQuarterly).toBe('2027-04-10');
    expect(state.due).toBeNull();
  });

  it('asks for the yearly look after a year, even when the quarters were kept', () => {
    const state = reviewState({
      startedOn: '2026-09-16',
      quarterlyReviewedOn: '2027-09-01',
      today: '2027-09-16',
    });

    expect(state.due).toBe('yearly');
    expect(state.nextYearly).toBe('2027-09-16');
  });

  it('a yearly look counts as the quarterly one too', () => {
    const state = reviewState({
      startedOn: '2026-09-16',
      quarterlyReviewedOn: '2027-06-01',
      yearlyReviewedOn: '2027-09-20',
      today: '2027-10-01',
    });

    expect(state.nextQuarterly).toBe('2027-12-20');
    expect(state.nextYearly).toBe('2028-09-20');
    expect(state.due).toBeNull();
  });

  it('days until the next look, and how long it is overdue', () => {
    expect(reviewState({ startedOn: '2026-09-16', today: '2026-12-06' }).daysToNext).toBe(10);
    expect(reviewState({ startedOn: '2026-09-16', today: '2026-12-26' }).daysToNext).toBe(-10);
  });
});
