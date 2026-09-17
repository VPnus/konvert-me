import { afterEach, describe, expect, it, vi } from 'vitest';

import releaseNotes from '@/app/release-notes.json';
import {
  compareVersions,
  fetchLatestRelease,
  notesSince,
  pendingNotes,
  readSeenVersion,
  SEEN_VERSION_KEY,
  startUpdateChecks,
  writeSeenVersion,
} from '@/lib/release';
import { USAGE_STORAGE_KEY } from '@/lib/usage';

const NOTES = {
  '0.17.0': ['Сайт и пилот'],
  '0.17.1': ['Исправлена кнопка'],
  '0.18.0': ['Кредитка', 'Вкладки сбоку'],
  '0.19.0': ['Ещё не вышло'],
};

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('versions and their notes', () => {
  it('compares versions number by number, not as text', () => {
    expect(compareVersions('0.18.0', '0.17.9')).toBe(1);
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
    expect(compareVersions('0.18', '0.18.0')).toBe(0);
    expect(compareVersions('0.17.0', '0.18.0')).toBe(-1);
  });

  it('gathers what came after the version seen, the newest first, never what has not come yet', () => {
    expect(notesSince('0.17.0', '0.18.0', NOTES)).toEqual(['Кредитка', 'Вкладки сбоку', 'Исправлена кнопка']);
    expect(notesSince('0.18.0', '0.18.0', NOTES)).toEqual([]);
    // from before the notes began: only the version they have now
    expect(notesSince(null, '0.18.0', NOTES)).toEqual(['Кредитка', 'Вкладки сбоку']);
  });

  it('has notes for the version of this build', () => {
    expect((releaseNotes as Record<string, string[]>)[__APP_VERSION__]?.length).toBeGreaterThan(0);
  });
});

describe('what is new, once after an update', () => {
  const usedSince = (firstDay: string) =>
    localStorage.setItem(
      USAGE_STORAGE_KEY,
      JSON.stringify({
        firstDay,
        days: [firstDay],
        onboarding: 'completed',
        installed: false,
        sharedMilestone: 0,
      }),
    );

  it('says nothing to someone who opens the app for the first time', () => {
    usedSince('2026-09-17');
    expect(pendingNotes('0.18.0', NOTES, localStorage, '2026-09-17')).toEqual([]);
    expect(pendingNotes('0.18.0', NOTES, localStorage, '2026-09-17')).toEqual([]);
  });

  it('tells someone who used an older version, until they have seen it', () => {
    usedSince('2026-09-10');
    expect(pendingNotes('0.18.0', NOTES, localStorage, '2026-09-17')).toEqual(['Кредитка', 'Вкладки сбоку']);

    writeSeenVersion('0.18.0');
    expect(readSeenVersion()).toBe('0.18.0');
    expect(pendingNotes('0.18.0', NOTES, localStorage, '2026-09-17')).toEqual([]);

    localStorage.setItem(SEEN_VERSION_KEY, '0.17.0');
    expect(pendingNotes('0.18.0', NOTES, localStorage, '2026-09-17')).toHaveLength(3);
  });
});

describe('the release on the site', () => {
  it('reads the version and the notes, and gives nothing when the site does not answer', async () => {
    const answer = (body: unknown, ok = true) =>
      vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }) as unknown as typeof fetch;

    expect(await fetchLatestRelease(answer({ version: '0.18.0', notes: ['Кредитка', 7] }))).toEqual({
      version: '0.18.0',
      notes: ['Кредитка'],
    });
    expect(await fetchLatestRelease(answer({ notes: [] }))).toBeNull();
    expect(await fetchLatestRelease(answer({}, false))).toBeNull();
    expect(await fetchLatestRelease(vi.fn().mockRejectedValue(new Error('offline')))).toBeNull();
  });
});

describe('an open app looks for a new version itself', () => {
  function setup(online = true) {
    vi.useFakeTimers();
    let clock = 0;
    const listeners = new Map<string, () => void>();
    const target = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: vi.fn((name: string, listener: () => void) => listeners.set(name, listener)),
      removeEventListener: vi.fn((name: string) => listeners.delete(name)),
    };
    const registration = { installing: null, update: vi.fn().mockResolvedValue(undefined) };
    const fetcher = vi.fn().mockResolvedValue({ status: 200 }) as unknown as typeof fetch;
    const stop = startUpdateChecks(registration, '/sw.js', {
      intervalMs: 60_000,
      minGapMs: 10_000,
      fetcher,
      now: () => clock,
      target: target as unknown as Document,
      online: () => online,
    });
    return {
      stop,
      registration,
      fetcher,
      listeners,
      advance: async (ms: number) => {
        clock += ms;
        await vi.advanceTimersByTimeAsync(ms);
      },
    };
  }

  it('asks once an hour, past the cache, and updates when the site answers', async () => {
    const { registration, fetcher, advance, stop } = setup();
    await advance(59_000);
    expect(registration.update).not.toHaveBeenCalled();

    await advance(1_000);
    expect(fetcher).toHaveBeenCalledWith('/sw.js', expect.objectContaining({ cache: 'no-store' }));
    expect(registration.update).toHaveBeenCalledTimes(1);

    stop();
    await advance(120_000);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('asks again when the app comes back to the screen, but not every minute', async () => {
    const { registration, listeners, advance } = setup();
    listeners.get('visibilitychange')?.();
    await advance(0);
    expect(registration.update).not.toHaveBeenCalled();

    await advance(10_000);
    listeners.get('visibilitychange')?.();
    await advance(0);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('stays quiet without the network', async () => {
    const { registration, fetcher, advance } = setup(false);
    await advance(60_000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(registration.update).not.toHaveBeenCalled();
  });
});
