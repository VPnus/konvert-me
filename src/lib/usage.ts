/**
 * The days the app was opened on this device, for the pilot. It lives in localStorage next to the
 * theme: it says nothing about money and never leaves the device on its own. The settings turn it
 * into a short text the user may copy and send (features/settings/pilot-stats.ts).
 */

import { z } from 'zod';

import { daysBetween, isIsoDate, todayIso, type IsoDate } from '@/core/time';
import { isStandaloneDisplay } from '@/lib/platform';

export const USAGE_STORAGE_KEY = 'konvert-me.usage';

/** More than a year of daily use. The first day is kept apart, so only the oldest of the rest go. */
export const MAX_USAGE_DAYS = 400;

/** The days after the first one when the app asks to share how it went. */
export const PILOT_MILESTONES = [7, 30] as const;

const USAGE_EVENT = 'konvert-me:usage';

const isoDate = z.string().refine(isIsoDate);

const usageSchema = z.object({
  firstDay: isoDate,
  /** Every day the app was opened on, the first one too, in order. */
  days: z.array(isoDate).max(MAX_USAGE_DAYS),
  onboarding: z.enum(['completed', 'skipped']).nullable(),
  /** Opened at least once as an installed app rather than a browser tab. */
  installed: z.boolean(),
  /** The last milestone the user shared or hid the reminder of; 0 before the first. */
  sharedMilestone: z.number().int().nonnegative(),
});

export type Usage = z.infer<typeof usageSchema>;
export type OnboardingOutcome = NonNullable<Usage['onboarding']>;

export function startUsage(today: IsoDate): Usage {
  return { firstDay: today, days: [today], onboarding: null, installed: false, sharedMilestone: 0 };
}

/** Counts today in. A day before the first one means the clock went back, and is left out. */
export function withOpenDay(usage: Usage | null, today: IsoDate, installed: boolean): Usage {
  const base = usage ?? startUsage(today);
  const seenInstalled = base.installed || installed;
  if (daysBetween(base.firstDay, today) < 0) {
    return seenInstalled === base.installed ? base : { ...base, installed: seenInstalled };
  }
  if (base.days.includes(today)) {
    return seenInstalled === base.installed ? base : { ...base, installed: seenInstalled };
  }
  const days = [...base.days, today].sort().slice(-MAX_USAGE_DAYS);
  return { ...base, days, installed: seenInstalled };
}

export function withOnboarding(usage: Usage | null, outcome: OnboardingOutcome, today: IsoDate): Usage {
  return { ...withOpenDay(usage, today, false), onboarding: outcome };
}

/** Whole days since the first one: 0 on the first day. */
export function daysSinceFirst(usage: Usage, today: IsoDate): number {
  return Math.max(0, daysBetween(usage.firstDay, today));
}

/** The days of use counted from the first one, which is 0. */
export function dayNumbers(usage: Usage): number[] {
  return usage.days.map((day) => daysBetween(usage.firstDay, day)).filter((number) => number >= 0);
}

/** The latest milestone already reached, or null in the first week. */
export function reachedMilestone(usage: Usage, today: IsoDate): number | null {
  const passed = daysSinceFirst(usage, today);
  const reached = PILOT_MILESTONES.filter((milestone) => passed >= milestone);
  return reached.length > 0 ? reached[reached.length - 1] : null;
}

/**
 * The milestone to remind of today. Someone back after five weeks is asked once, about the month,
 * not twice; a reminder hidden for the week comes back for the month.
 */
export function dueMilestone(usage: Usage | null, today: IsoDate): number | null {
  if (!usage) return null;
  const reached = reachedMilestone(usage, today);
  return reached !== null && reached > usage.sharedMilestone ? reached : null;
}

export function withShared(usage: Usage, today: IsoDate): Usage {
  const reached = reachedMilestone(usage, today) ?? 0;
  return reached > usage.sharedMilestone ? { ...usage, sharedMilestone: reached } : usage;
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Storage blocked by the browser: the app works, there is just nothing to count.
    return null;
  }
}

/** The record as it is stored: a string stays the same between reads, which React relies on. */
export function readUsageText(storage: Storage | null = browserStorage()): string | null {
  try {
    return storage?.getItem(USAGE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** A broken or foreign record counts as none: the counting simply starts again. */
export function parseUsage(text: string | null): Usage | null {
  if (!text) return null;
  try {
    const parsed = usageSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readUsage(storage: Storage | null = browserStorage()): Usage | null {
  return parseUsage(readUsageText(storage));
}

function writeUsage(usage: Usage, storage: Storage | null): void {
  try {
    storage?.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // A full or blocked storage: the stats of the pilot are not worth an error.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(USAGE_EVENT));
}

function update(change: (usage: Usage | null) => Usage, storage: Storage | null): Usage {
  const current = readUsage(storage);
  const next = change(current);
  if (current === null || JSON.stringify(next) !== JSON.stringify(current)) writeUsage(next, storage);
  return next;
}

export function recordAppOpen(
  today: IsoDate = todayIso(),
  installed: boolean = isStandaloneDisplay(),
  storage: Storage | null = browserStorage(),
): Usage {
  return update((usage) => withOpenDay(usage, today, installed), storage);
}

export function recordOnboarding(
  outcome: OnboardingOutcome,
  today: IsoDate = todayIso(),
  storage: Storage | null = browserStorage(),
): Usage {
  return update((usage) => withOnboarding(usage, outcome, today), storage);
}

/** The user copied the stats or hid the reminder: nothing more to ask until the next milestone. */
export function recordShared(today: IsoDate = todayIso(), storage: Storage | null = browserStorage()): Usage {
  return update((usage) => withShared(withOpenDay(usage, today, false), today), storage);
}

export function clearUsage(storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(USAGE_STORAGE_KEY);
  } catch {
    // nothing to remove from a blocked storage
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(USAGE_EVENT));
}

/** Calls back on every change of the record, in this tab and in the others. */
export function subscribeToUsage(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === USAGE_STORAGE_KEY) listener();
  };
  window.addEventListener(USAGE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(USAGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}
