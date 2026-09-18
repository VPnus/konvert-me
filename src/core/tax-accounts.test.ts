import { describe, expect, it } from 'vitest';

import { US_RULES_2026 as RULES } from './rules/us/2026';
import {
  contributionForFullMatchMinor,
  limitMinor,
  limitsOfYear,
  matchOfContributionMinor,
  type TaxAccountLike,
  type YearContribution,
} from './tax-accounts';

const DOLLAR = 100;

function account(id: string, kind: TaxAccountLike['kind'], extra: Partial<TaxAccountLike> = {}) {
  return { id, kind, catchUp: 'none' as const, familyCoverage: false, ...extra };
}

function put(entries: Record<string, Partial<YearContribution>>): Map<string, YearContribution> {
  return new Map(
    Object.entries(entries).map(([id, value]) => [
      id,
      { ownMinor: value.ownMinor ?? 0, employerMinor: value.employerMinor ?? 0 },
    ]),
  );
}

describe('the limit of a group in a year', () => {
  it('lets a 401(k) take 24 500, and more from 50 and from 60 to 63', () => {
    expect(limitMinor('deferral', RULES)).toBe(24_500 * DOLLAR);
    expect(limitMinor('deferral', RULES, { catchUp: 'standard' })).toBe(32_500 * DOLLAR);
    expect(limitMinor('deferral', RULES, { catchUp: 'enhanced' })).toBe(35_750 * DOLLAR);
  });

  it('lets an IRA take 7 500, and 1 100 more from 50', () => {
    expect(limitMinor('ira', RULES)).toBe(7_500 * DOLLAR);
    expect(limitMinor('ira', RULES, { catchUp: 'standard' })).toBe(8_600 * DOLLAR);
    // an IRA knows one catch-up only, so the larger one of a 401(k) does not reach it
    expect(limitMinor('ira', RULES, { catchUp: 'enhanced' })).toBe(8_600 * DOLLAR);
  });

  it('follows the health cover of an HSA, and adds 1 000 from 55', () => {
    expect(limitMinor('hsa', RULES)).toBe(4_400 * DOLLAR);
    expect(limitMinor('hsa', RULES, { familyCoverage: true })).toBe(8_750 * DOLLAR);
    expect(limitMinor('hsa', RULES, { familyCoverage: true, catchUp: 'standard' })).toBe(9_750 * DOLLAR);
  });

  it('measures a 529 by the gift exclusion, the same for every age', () => {
    expect(limitMinor('gift', RULES)).toBe(19_000 * DOLLAR);
    expect(limitMinor('gift', RULES, { catchUp: 'enhanced' })).toBe(19_000 * DOLLAR);
  });
});

describe('what the limits of a year have taken', () => {
  it('shares one limit between every IRA of a person, traditional and Roth together', () => {
    const views = limitsOfYear(
      [account('ira', 'ira'), account('roth', 'roth_ira')],
      put({ ira: { ownMinor: 4_000 * DOLLAR }, roth: { ownMinor: 2_000 * DOLLAR } }),
      RULES,
    );

    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({
      group: 'ira',
      accountIds: ['ira', 'roth'],
      limitMinor: 7_500 * DOLLAR,
      countedMinor: 6_000 * DOLLAR,
      leftMinor: 1_500 * DOLLAR,
      overMinor: 0,
    });
  });

  it('gives every 529 a threshold of its own: one child is not another', () => {
    const views = limitsOfYear(
      [account('son', '529'), account('daughter', '529')],
      put({ son: { ownMinor: 20_000 * DOLLAR }, daughter: { ownMinor: 5_000 * DOLLAR } }),
      RULES,
    );

    expect(views.map((view) => view.accountIds)).toEqual([['son'], ['daughter']]);
    expect(views[0].overMinor).toBe(1_000 * DOLLAR);
    expect(views[1].leftMinor).toBe(14_000 * DOLLAR);
  });

  it('keeps what the employer matches out of the 401(k) limit, and counts it into an HSA', () => {
    const [deferral, hsa] = limitsOfYear(
      [account('plan', '401k'), account('health', 'hsa')],
      put({
        plan: { ownMinor: 20_000 * DOLLAR, employerMinor: 6_000 * DOLLAR },
        health: { ownMinor: 3_000 * DOLLAR, employerMinor: 1_000 * DOLLAR },
      }),
      RULES,
    );

    expect(deferral).toMatchObject({
      countedMinor: 20_000 * DOLLAR,
      employerMinor: 6_000 * DOLLAR,
      leftMinor: 4_500 * DOLLAR,
    });
    expect(hsa).toMatchObject({ countedMinor: 4_000 * DOLLAR, leftMinor: 400 * DOLLAR });
  });

  it('takes the larger catch-up any account of a group claims: one person has one age', () => {
    const [view] = limitsOfYear(
      [account('old', 'ira', { catchUp: 'standard' }), account('new', 'roth_ira')],
      put({}),
      RULES,
    );
    expect(view.limitMinor).toBe(8_600 * DOLLAR);
  });

  it('says how much has gone over a limit instead of showing a negative remainder', () => {
    const [view] = limitsOfYear(
      [account('plan', '401k')],
      put({ plan: { ownMinor: 25_000 * DOLLAR } }),
      RULES,
    );
    expect(view.leftMinor).toBe(0);
    expect(view.overMinor).toBe(500 * DOLLAR);
  });

  it('shows nothing for a group without accounts', () => {
    expect(limitsOfYear([], put({}), RULES)).toEqual([]);
    expect(limitsOfYear([account('plan', '401k')], put({}), RULES).map((view) => view.group)).toEqual([
      'deferral',
    ]);
  });
});

describe('the match of the employer', () => {
  const terms = { share: 0.5, upToShareOfPay: 0.06 };

  it('says what the person has to put in to take all of it', () => {
    expect(contributionForFullMatchMinor(100_000 * DOLLAR, terms)).toBe(6_000 * DOLLAR);
  });

  it('halves what the person put in, up to that much', () => {
    expect(matchOfContributionMinor(100_000 * DOLLAR, 4_000 * DOLLAR, terms)).toBe(2_000 * DOLLAR);
    expect(matchOfContributionMinor(100_000 * DOLLAR, 6_000 * DOLLAR, terms)).toBe(3_000 * DOLLAR);
  });

  it('adds nothing for what goes beyond the share of the pay the employer matches', () => {
    expect(matchOfContributionMinor(100_000 * DOLLAR, 20_000 * DOLLAR, terms)).toBe(3_000 * DOLLAR);
  });

  it('matches a whole dollar on a dollar when the employer does', () => {
    expect(
      matchOfContributionMinor(80_000 * DOLLAR, 10_000 * DOLLAR, { share: 1, upToShareOfPay: 0.04 }),
    ).toBe(3_200 * DOLLAR);
  });
});
