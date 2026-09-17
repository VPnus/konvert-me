import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearUsage,
  dayNumbers,
  daysSinceFirst,
  dueMilestone,
  MAX_USAGE_DAYS,
  parseUsage,
  readUsage,
  recordAppOpen,
  recordOnboarding,
  recordShared,
  startUsage,
  subscribeToUsage,
  USAGE_STORAGE_KEY,
  withOpenDay,
  type Usage,
} from '@/lib/usage';

/** A storage of its own for every test: the browser one is shared by the whole file. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

afterEach(() => {
  localStorage.clear();
});

describe('the days of use', () => {
  it('starts on the first day the app is opened', () => {
    const storage = memoryStorage();
    const usage = recordAppOpen('2026-09-17', false, storage);

    expect(usage).toEqual(startUsage('2026-09-17'));
    expect(readUsage(storage)).toEqual(usage);
  });

  it('counts a day once, however many times the app is opened on it', () => {
    const storage = memoryStorage();
    recordAppOpen('2026-09-17', false, storage);
    recordAppOpen('2026-09-17', false, storage);
    recordAppOpen('2026-09-18', false, storage);
    const usage = recordAppOpen('2026-09-18', false, storage);

    expect(usage.days).toEqual(['2026-09-17', '2026-09-18']);
    expect(dayNumbers(usage)).toEqual([0, 1]);
  });

  it('numbers the days from the first one across months', () => {
    let usage: Usage | null = null;
    for (const day of ['2026-09-17', '2026-09-24', '2026-10-17', '2026-10-20']) {
      usage = withOpenDay(usage, day, false);
    }

    expect(dayNumbers(usage!)).toEqual([0, 7, 30, 33]);
    expect(daysSinceFirst(usage!, '2026-11-01')).toBe(45);
  });

  it('leaves out a day before the first one: the clock of the device went back', () => {
    const usage = withOpenDay(startUsage('2026-09-17'), '2026-09-10', false);

    expect(usage.days).toEqual(['2026-09-17']);
    expect(daysSinceFirst(usage, '2026-09-10')).toBe(0);
  });

  it('keeps the first day when the oldest of the rest have to go', () => {
    let usage = startUsage('2025-01-01');
    for (let day = 1; day <= MAX_USAGE_DAYS + 20; day += 1) {
      const date = new Date(Date.UTC(2025, 0, 1 + day)).toISOString().slice(0, 10);
      usage = withOpenDay(usage, date, false);
    }

    expect(usage.days).toHaveLength(MAX_USAGE_DAYS);
    expect(usage.firstDay).toBe('2025-01-01');
    expect(daysSinceFirst(usage, usage.days[usage.days.length - 1])).toBe(MAX_USAGE_DAYS + 20);
  });

  it('remembers that the app was once opened installed', () => {
    const storage = memoryStorage();
    recordAppOpen('2026-09-17', true, storage);

    expect(recordAppOpen('2026-09-17', false, storage).installed).toBe(true);
    expect(recordAppOpen('2026-09-18', false, storage).installed).toBe(true);
  });

  it('keeps how the onboarding ended', () => {
    const storage = memoryStorage();
    recordAppOpen('2026-09-17', false, storage);

    expect(recordOnboarding('skipped', '2026-09-17', storage).onboarding).toBe('skipped');
    expect(readUsage(storage)?.days).toEqual(['2026-09-17']);
  });

  it('takes a broken or foreign record for none', () => {
    expect(parseUsage(null)).toBeNull();
    expect(parseUsage('not json')).toBeNull();
    expect(parseUsage(JSON.stringify({ firstDay: '17.09.2026', days: [] }))).toBeNull();
  });

  it('works with a blocked storage, only counting nothing', () => {
    expect(recordAppOpen('2026-09-17', false, null)).toEqual(startUsage('2026-09-17'));
    expect(readUsage(null)).toBeNull();
  });

  it('forgets everything when the data is wiped', () => {
    recordAppOpen('2026-09-17', false);
    expect(localStorage.getItem(USAGE_STORAGE_KEY)).not.toBeNull();

    clearUsage();
    expect(readUsage()).toBeNull();
  });

  it('tells the listeners of every change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToUsage(listener);

    recordAppOpen('2026-09-17', false);
    recordAppOpen('2026-09-17', false);
    expect(listener).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent('storage', { key: USAGE_STORAGE_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'konvert-me.theme' }));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    clearUsage();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('the reminder to share', () => {
  const first = startUsage('2026-09-01');

  it('waits for a week', () => {
    expect(dueMilestone(null, '2026-09-30')).toBeNull();
    expect(dueMilestone(first, '2026-09-07')).toBeNull();
    expect(dueMilestone(first, '2026-09-08')).toBe(7);
  });

  it('asks about the month next, once the week is shared', () => {
    const storage = memoryStorage();
    storage.setItem(USAGE_STORAGE_KEY, JSON.stringify(first));

    const shared = recordShared('2026-09-09', storage);
    expect(shared.sharedMilestone).toBe(7);
    expect(dueMilestone(shared, '2026-09-30')).toBeNull();
    expect(dueMilestone(shared, '2026-10-01')).toBe(30);

    const done = recordShared('2026-10-02', storage);
    expect(dueMilestone(done, '2027-01-01')).toBeNull();
  });

  it('asks once about the month someone came back after, not about the week too', () => {
    expect(dueMilestone(first, '2026-10-15')).toBe(30);
    expect(dueMilestone(recordShared('2026-10-15', seeded(first)), '2026-10-16')).toBeNull();
  });

  it('does not move the milestones when shared in the first week', () => {
    expect(recordShared('2026-09-03', seeded(first)).sharedMilestone).toBe(0);
  });
});

function seeded(usage: Usage): Storage {
  const storage = memoryStorage();
  storage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
  return storage;
}
