import { describe, expect, it } from 'vitest';

import { dataRisk, RISK_DISMISS_DAYS, type DataRiskInput } from '@/lib/data-risk';
import type { PlatformInfo } from '@/lib/platform';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 16);
const GB = 1024 ** 3;

const chrome: PlatformInfo = { isSafari: false, isIos: false, isStandalone: false, needsInstallHint: false };
const safari: PlatformInfo = { isSafari: true, isIos: false, isStandalone: false, needsInstallHint: true };

function input(patch: Partial<DataRiskInput> = {}): DataRiskInput {
  return {
    privateMode: false,
    platform: chrome,
    storage: { supported: true, persisted: true, usageBytes: 1 * GB, quotaBytes: 100 * GB },
    dismissed: null,
    now: NOW,
    ...patch,
  };
}

describe('the risk of losing the data', () => {
  it('sees none in a browser that keeps the storage and has room', () => {
    expect(dataRisk(input())).toBeNull();
  });

  it('warns when the browser has not made the storage persistent', () => {
    expect(dataRisk(input({ storage: { supported: true, persisted: false } }))).toEqual({
      kind: 'not-persisted',
    });
  });

  it('does not warn of that in an installed app, nor where the browser cannot say', () => {
    expect(
      dataRisk(
        input({
          platform: { ...chrome, isStandalone: true },
          storage: { supported: true, persisted: false },
        }),
      ),
    ).toBeNull();
    expect(dataRisk(input({ storage: { supported: false, persisted: false } }))).toBeNull();
  });

  it('names Safari rather than the storage in Safari, where a week away is enough', () => {
    expect(dataRisk(input({ platform: safari, storage: { supported: true, persisted: false } }))).toEqual({
      kind: 'safari',
    });
  });

  it('puts a private window first, and says nothing else there', () => {
    expect(
      dataRisk(
        input({ privateMode: true, platform: safari, storage: { supported: true, persisted: false } }),
      ),
    ).toEqual({ kind: 'private' });
  });

  it('warns when four fifths of the room are taken, and says how much', () => {
    const storage = { supported: true, persisted: true, usageBytes: 8 * GB, quotaBytes: 10 * GB };

    expect(dataRisk(input({ storage }))).toEqual({ kind: 'space', usageBytes: 8 * GB, quotaBytes: 10 * GB });
    expect(dataRisk(input({ storage: { ...storage, usageBytes: 7.9 * GB } }))).toBeNull();
  });

  it('puts running out of room before Safari and the storage', () => {
    const storage = { supported: true, persisted: false, usageBytes: 9 * GB, quotaBytes: 10 * GB };

    expect(dataRisk(input({ platform: safari, storage }))?.kind).toBe('space');
  });

  it('keeps a hidden risk quiet for thirty days, then brings it back', () => {
    const storage = { supported: true, persisted: false };
    const dismissed = { kind: 'not-persisted', at: NOW - (RISK_DISMISS_DAYS - 1) * DAY };

    expect(dataRisk(input({ storage, dismissed }))).toBeNull();
    expect(
      dataRisk(input({ storage, dismissed: { ...dismissed, at: NOW - RISK_DISMISS_DAYS * DAY } })),
    ).toEqual({
      kind: 'not-persisted',
    });
  });

  it('does not let a hidden risk hide another one', () => {
    const storage = { supported: true, persisted: false, usageBytes: 9 * GB, quotaBytes: 10 * GB };

    expect(dataRisk(input({ storage, dismissed: { kind: 'space', at: NOW } }))).toEqual({
      kind: 'not-persisted',
    });
  });
});
