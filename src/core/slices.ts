/**
 * Parts of a whole, ready to be drawn. A picture on a phone reads while it has a few parts: the
 * biggest ones keep their names and the tail becomes one "the rest", so nothing is hidden and the
 * sum of what is drawn still equals the sum of everything.
 */

export interface Slice {
  readonly key: string;
  readonly amountMinor: number;
}

export interface TopSlicesOptions {
  /** How many named parts to keep; everything below them becomes one. */
  readonly limit?: number;
  readonly restKey?: string;
}

/**
 * The biggest parts first, the tail gathered into one. Parts that are zero or below are left out:
 * a refund that outgrew its category would otherwise draw a bar backwards.
 */
export function topSlices(slices: readonly Slice[], options: TopSlicesOptions = {}): Slice[] {
  const { limit = 7, restKey = 'rest' } = options;

  const positive = slices
    .filter((slice) => slice.amountMinor > 0)
    .sort((a, b) => b.amountMinor - a.amountMinor);
  if (positive.length <= limit) return positive;

  const head = positive.slice(0, limit);
  const restMinor = positive.slice(limit).reduce((total, slice) => total + slice.amountMinor, 0);
  return restMinor > 0 ? [...head, { key: restKey, amountMinor: restMinor }] : head;
}

export function sliceTotalMinor(slices: readonly Slice[]): number {
  return slices.reduce((total, slice) => total + slice.amountMinor, 0);
}

/** The share of a part in the whole, from 0 to 100; an empty whole gives zero. */
export function sharePercent(amountMinor: number, totalMinor: number): number {
  if (totalMinor <= 0) return 0;
  return (amountMinor / totalMinor) * 100;
}
