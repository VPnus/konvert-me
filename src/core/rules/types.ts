import type { IsoDate } from '../time';

/**
 * A number the state sets, not the user: a limit, a rate, a threshold. Every one of
 * them carries where it came from and when it was last checked, so a stale rule can
 * be found without reading the code that uses it.
 */
export interface Norm<T> {
  readonly value: T;
  /** The page the value was read from. */
  readonly source: string;
  readonly checkedAt: IsoDate;
  /** What the value does not cover — exceptions the app cannot detect by itself. */
  readonly note?: string;
}

export interface YearRules {
  readonly year: number;
  /** Deposit insurance: what one bank pays back per person if it fails. */
  readonly depositInsuranceLimitMinor: Norm<number>;
}
