/**
 * The accounts the United States taxes differently: a 401(k) at work, an IRA and a Roth IRA of
 * one's own, an HSA for health, a 529 for a child's schooling. The app does not count the tax —
 * it only holds the limits of a year against what has been put in, so nothing is left unused and
 * nothing goes over.
 *
 * What the limits are lives in the norms of the country (`core/rules/us`), never here.
 */

import type { UsYearRules } from './rules';

export const TAX_ACCOUNT_KINDS = ['401k', 'ira', 'roth_ira', 'hsa', '529'] as const;
export type TaxAccountKind = (typeof TAX_ACCOUNT_KINDS)[number];

/**
 * Accounts that share one limit. Every IRA of a person shares one, traditional and Roth together;
 * every 529, on the other hand, is measured child by child, so each stands alone.
 */
export const LIMIT_GROUPS = ['deferral', 'ira', 'hsa', 'gift'] as const;
export type LimitGroup = (typeof LIMIT_GROUPS)[number];

export const GROUP_OF_KIND: Readonly<Record<TaxAccountKind, LimitGroup>> = {
  '401k': 'deferral',
  ira: 'ira',
  roth_ira: 'ira',
  hsa: 'hsa',
  '529': 'gift',
};

/** A 529 is a gift to one child, so two of them do not share a threshold. */
const SHARED_BY_EVERY_ACCOUNT: Readonly<Record<LimitGroup, boolean>> = {
  deferral: true,
  ira: true,
  hsa: true,
  gift: false,
};

/**
 * Whether the person is old enough for the larger limit, and which of the two. The years are the
 * person's own business: they say which one applies, the app does not ask for a birthday.
 */
export const CATCH_UPS = ['none', 'standard', 'enhanced'] as const;
export type CatchUp = (typeof CATCH_UPS)[number];

/** What the employer adds to a 401(k) for what the person puts in. */
export interface MatchTerms {
  /** 0.5 for fifty cents on a dollar. */
  readonly share: number;
  /** And only up to this share of the pay: 0.06 for the first 6 % of it. */
  readonly upToShareOfPay: number;
}

/** What the app needs of an account to hold it against a limit. */
export interface TaxAccountLike {
  readonly id: string;
  readonly kind: TaxAccountKind;
  readonly catchUp: CatchUp;
  /** An HSA under a family health plan has the larger limit. */
  readonly familyCoverage: boolean;
}

export interface YearContribution {
  /** What the person put in themselves. */
  readonly ownMinor: number;
  /** And what the employer added: a match of a 401(k), or money into an HSA. */
  readonly employerMinor: number;
}

/**
 * The limit of one group in a year. A year nobody has written the norms for borrows the last ones
 * written, as every other norm of the app does.
 */
export function limitMinor(
  group: LimitGroup,
  rules: UsYearRules,
  options: { catchUp?: CatchUp; familyCoverage?: boolean } = {},
): number {
  const catchUp = options.catchUp ?? 'none';

  if (group === 'deferral') {
    const limits = rules.deferralLimits.value;
    const extra =
      catchUp === 'enhanced'
        ? limits.catchUpFrom60To63Minor
        : catchUp === 'standard'
          ? limits.catchUpFrom50Minor
          : 0;
    return limits.electiveDeferralMinor + extra;
  }

  if (group === 'ira') {
    const limits = rules.iraLimits.value;
    return limits.contributionMinor + (catchUp === 'none' ? 0 : limits.catchUpFrom50Minor);
  }

  if (group === 'hsa') {
    const limits = rules.hsaLimits.value;
    const base = options.familyCoverage ? limits.familyMinor : limits.selfOnlyMinor;
    return base + (catchUp === 'none' ? 0 : limits.catchUpFrom55Minor);
  }

  return rules.giftExclusionMinor.value;
}

/**
 * Whose money counts against the limit. A 401(k) limits what the person defers from their own pay,
 * and what the employer matches lies outside it; an HSA and a 529 count every dollar that arrives.
 */
export function employerCountsTowardsLimit(group: LimitGroup): boolean {
  return group === 'hsa' || group === 'gift';
}

export interface LimitView {
  readonly group: LimitGroup;
  /** The accounts this limit is shared by; a 529 stands alone, so it has one. */
  readonly accountIds: readonly string[];
  readonly limitMinor: number;
  /** What counts against the limit. */
  readonly countedMinor: number;
  /** What the employer added, whether it counts against the limit or not. */
  readonly employerMinor: number;
  /** What is still free this year; never below zero. */
  readonly leftMinor: number;
  /** And what has gone over it, if anything: money that is taxed twice or taken back out. */
  readonly overMinor: number;
}

/**
 * What every limit of a year has taken so far. The catch-up and the health cover of a group are
 * the largest any of its accounts claims: two IRAs of one person are one person, and a person who
 * says they are past 50 on one of them is past 50 on the other.
 */
export function limitsOfYear(
  accounts: readonly TaxAccountLike[],
  contributions: ReadonlyMap<string, YearContribution>,
  rules: UsYearRules,
): LimitView[] {
  const views: LimitView[] = [];

  for (const group of LIMIT_GROUPS) {
    const ofGroup = accounts.filter((account) => GROUP_OF_KIND[account.kind] === group);
    if (ofGroup.length === 0) continue;

    const sets = SHARED_BY_EVERY_ACCOUNT[group] ? [ofGroup] : ofGroup.map((account) => [account]);

    for (const set of sets) {
      const catchUp: CatchUp = set.some((account) => account.catchUp === 'enhanced')
        ? 'enhanced'
        : set.some((account) => account.catchUp === 'standard')
          ? 'standard'
          : 'none';
      const familyCoverage = set.some((account) => account.familyCoverage);

      const own = set.reduce((sum, account) => sum + (contributions.get(account.id)?.ownMinor ?? 0), 0);
      const employer = set.reduce(
        (sum, account) => sum + (contributions.get(account.id)?.employerMinor ?? 0),
        0,
      );
      const counted = own + (employerCountsTowardsLimit(group) ? employer : 0);
      const limit = limitMinor(group, rules, { catchUp, familyCoverage });

      views.push({
        group,
        accountIds: set.map((account) => account.id),
        limitMinor: limit,
        countedMinor: counted,
        employerMinor: employer,
        leftMinor: Math.max(0, limit - counted),
        overMinor: Math.max(0, counted - limit),
      });
    }
  }

  return views;
}

/** What the person has to put in from a year's pay to take the whole match of the employer. */
export function contributionForFullMatchMinor(annualPayMinor: number, terms: MatchTerms): number {
  return Math.round(annualPayMinor * terms.upToShareOfPay);
}

/** And what the employer adds for what the person actually put in. */
export function matchOfContributionMinor(
  annualPayMinor: number,
  contributionMinor: number,
  terms: MatchTerms,
): number {
  const matched = Math.min(contributionMinor, contributionForFullMatchMinor(annualPayMinor, terms));
  return Math.round(matched * terms.share);
}
