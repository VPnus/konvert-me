/**
 * The strategic allocation of lesson 6.2: which share of a goal's savings goes to each
 * class of assets, by the term of the goal and the risk the person accepts.
 *
 * Classes only — never a security, a fund or a broker (principle 5 of the plan). It is a
 * teaching example, and the screen says so with the disclaimer.
 */

export const RISK_PROFILES = ['conservative', 'moderate', 'aggressive'] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

export const ASSET_CLASSES = ['stocks', 'bonds', 'realEstate', 'gold'] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

/** Percent of the savings per class; together 100. */
export type AssetShares = Readonly<Record<AssetClass, number>>;

export const HORIZON_BANDS = ['upTo5', 'from5To10', 'from10To15', 'over15'] as const;
export type HorizonBand = (typeof HORIZON_BANDS)[number];

const TABLE: Record<HorizonBand, Record<RiskProfile, readonly [number, number, number, number]>> = {
  upTo5: { conservative: [10, 90, 0, 0], moderate: [10, 80, 5, 5], aggressive: [20, 70, 5, 5] },
  from5To10: { conservative: [30, 60, 5, 5], moderate: [40, 50, 5, 5], aggressive: [60, 30, 5, 5] },
  from10To15: { conservative: [40, 50, 5, 5], moderate: [60, 30, 5, 5], aggressive: [80, 10, 5, 5] },
  over15: { conservative: [50, 40, 5, 5], moderate: [70, 20, 5, 5], aggressive: [90, 5, 2.5, 2.5] },
};

/**
 * The lesson names the terms "up to 5 years", "5–10", "10–15" and "over 15"; a term that
 * is exactly 5, 10 or 15 years belongs to the shorter one, the more careful choice.
 */
export function horizonBand(months: number): HorizonBand {
  if (months <= 60) return 'upTo5';
  if (months <= 120) return 'from5To10';
  if (months <= 180) return 'from10To15';
  return 'over15';
}

export function strategicAllocation(months: number, profile: RiskProfile): AssetShares {
  const [stocks, bonds, realEstate, gold] = TABLE[horizonBand(months)][profile];
  return { stocks, bonds, realEstate, gold };
}

/**
 * A sum in kopecks split by the shares so that the parts add up to it exactly: each class
 * gets the whole kopecks of its share, and the kopecks left go to the largest remainders
 * — on equal remainders, to the class listed first.
 */
export function splitByClasses(amountMinor: number, shares: AssetShares): Record<AssetClass, number> {
  const exact = ASSET_CLASSES.map((asset) => ({ asset, value: (amountMinor * shares[asset]) / 100 }));
  const parts = Object.fromEntries(exact.map(({ asset, value }) => [asset, Math.floor(value)])) as Record<
    AssetClass,
    number
  >;

  let left = amountMinor - Object.values(parts).reduce((total, value) => total + value, 0);
  const byRemainder = [...exact].sort(
    (a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)),
  );
  for (const { asset } of byRemainder) {
    if (left <= 0) break;
    parts[asset] += 1;
    left -= 1;
  }
  return parts;
}
