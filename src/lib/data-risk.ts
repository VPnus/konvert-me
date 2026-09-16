/**
 * What could make the data disappear without anyone deleting it. The data lives in this browser
 * only, so the browser's own habits are the risk: a private window, a full disk, Safari's week,
 * storage the browser never promised to keep.
 */

import type { StorageStatus } from '@/lib/persist';
import type { PlatformInfo } from '@/lib/platform';

export type DataRisk =
  /** Everything goes when the window closes. */
  | { readonly kind: 'private' }
  /** The room the browser gives the site is nearly taken: new records may not be saved. */
  | { readonly kind: 'space'; readonly usageBytes: number; readonly quotaBytes: number }
  /** Safari erases the data of a site not opened for seven days, unless it is installed. */
  | { readonly kind: 'safari' }
  /** The browser may evict the data when the device runs short of room. */
  | { readonly kind: 'not-persisted' };

export type DataRiskKind = DataRisk['kind'];

/** Four fifths of the room: enough to still act before a save fails. */
export const SPACE_WARNING_SHARE = 0.8;
/** A hidden warning comes back after this long: the risk has not gone anywhere. */
export const RISK_DISMISS_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DataRiskInput {
  readonly privateMode: boolean;
  readonly platform: PlatformInfo;
  readonly storage: StorageStatus;
  readonly dismissed: { readonly kind: string; readonly at: number } | null;
  readonly now: number;
}

/** The most serious risk that is not hidden, or none. */
export function dataRisk(input: DataRiskInput): DataRisk | null {
  const { storage, platform } = input;
  const risks: DataRisk[] = [];

  if (input.privateMode) risks.push({ kind: 'private' });

  if (
    storage.usageBytes !== undefined &&
    storage.quotaBytes !== undefined &&
    storage.quotaBytes > 0 &&
    storage.usageBytes >= storage.quotaBytes * SPACE_WARNING_SHARE
  ) {
    risks.push({ kind: 'space', usageBytes: storage.usageBytes, quotaBytes: storage.quotaBytes });
  }

  // In a private window the rest is beside the point: nothing outlives the window anyway.
  if (!input.privateMode) {
    if (platform.needsInstallHint) risks.push({ kind: 'safari' });
    else if (storage.supported && !storage.persisted && !platform.isStandalone)
      risks.push({ kind: 'not-persisted' });
  }

  const hidden = input.dismissed;
  return (
    risks.find(
      (risk) => !(hidden && hidden.kind === risk.kind && input.now - hidden.at < RISK_DISMISS_DAYS * DAY_MS),
    ) ?? null
  );
}
