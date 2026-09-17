/**
 * Versions of the app and what each of them brought. The notes live in src/app/release-notes.json:
 * the app reads them to say what is new after an update, and the build publishes the notes of its
 * own version as version.json, so an open app learns what the waiting update brings before it is
 * installed.
 */

import { todayIso } from '@/core/time';
import { currentLanguage } from '@/i18n/locale';
import type { Language } from '@/i18n/types';
import { readUsage } from '@/lib/usage';

export type ReleaseNotes = Readonly<Record<string, readonly string[]>>;

/** src/app/release-notes.json: the notes of each version in every language of the app. */
export type ReleaseNotesByLanguage = Readonly<Record<string, Readonly<Record<Language, readonly string[]>>>>;

/** The notes of every version in one language. */
export function notesIn(all: ReleaseNotesByLanguage, language: Language = currentLanguage()): ReleaseNotes {
  return Object.fromEntries(
    Object.entries(all).map(([version, byLanguage]) => [version, byLanguage[language]]),
  );
}

export interface Release {
  readonly version: string;
  readonly notes: readonly string[];
}

/** Where the build puts the version it was built from; never kept in the offline copy. */
export const RELEASE_FILE = '/version.json';
export const SEEN_VERSION_KEY = 'konvert-me.version';

/** "0.18.0" against "0.17.2", number by number; a missing number counts as zero. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

/**
 * What came after the version the person saw last, up to the one they have now, the newest first.
 * Without a version seen, only the notes of the one they have: they came from before the notes began.
 */
export function notesSince(seen: string | null, current: string, all: ReleaseNotes): string[] {
  const versions = Object.keys(all)
    .filter((version) => compareVersions(version, current) <= 0)
    .filter((version) => (seen === null ? version === current : compareVersions(version, seen) > 0))
    .sort((a, b) => compareVersions(b, a));
  return versions.flatMap((version) => all[version]);
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readSeenVersion(store: Storage | null = storage()): string | null {
  try {
    return store?.getItem(SEEN_VERSION_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeSeenVersion(version: string, store: Storage | null = storage()): void {
  try {
    store?.setItem(SEEN_VERSION_KEY, version);
  } catch {
    // not kept: the notes may show once more next time, nothing worse
  }
}

/**
 * The notes to show once after an update, or nothing. A person who opens the app for the first time
 * today has nothing to compare with: their version is simply remembered as seen.
 */
export function pendingNotes(
  current: string,
  all: ReleaseNotes,
  store: Storage | null = storage(),
  today: string = todayIso(),
): string[] {
  const seen = readSeenVersion(store);
  if (seen === null) {
    const usage = readUsage(store);
    if (!usage || usage.firstDay >= today) return [];
    return notesSince(null, current, all);
  }
  return compareVersions(current, seen) > 0 ? notesSince(seen, current, all) : [];
}

/** The version the site has now, and what it brings; null offline or before the first build with notes. */
export async function fetchLatestRelease(fetcher: typeof fetch = fetch): Promise<Release | null> {
  try {
    const response = await fetcher(RELEASE_FILE, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<Release> & {
      notesByLanguage?: Partial<Record<Language, unknown>>;
    };
    if (typeof body.version !== 'string') return null;
    // notes stays Russian for the apps of 0.18, which read nothing else.
    const inLanguage = body.notesByLanguage?.[currentLanguage()];
    const raw: unknown[] = Array.isArray(inLanguage)
      ? inLanguage
      : Array.isArray(body.notes)
        ? body.notes
        : [];
    const notes = raw.filter((note): note is string => typeof note === 'string');
    return { version: body.version, notes };
  } catch {
    return null;
  }
}

export interface UpdateCheckOptions {
  /** How often an open app asks the site for a new version. */
  readonly intervalMs?: number;
  /** Coming back to the app asks again, but not more often than this. */
  readonly minGapMs?: number;
  readonly fetcher?: typeof fetch;
  readonly now?: () => number;
  readonly target?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  readonly online?: () => boolean;
}

/**
 * An installed app may stay open for days, and the browser looks for a new service worker only when a
 * page loads. So the app asks itself: once an hour, and when it is brought back to the screen. The
 * script of the worker is fetched past every cache first; only when the site answers is the browser
 * asked to update, so an app without the network stays quiet. Returns the stop.
 */
export function startUpdateChecks(
  registration: Pick<ServiceWorkerRegistration, 'update' | 'installing'>,
  swUrl: string,
  {
    intervalMs = 60 * 60 * 1000,
    minGapMs = 10 * 60 * 1000,
    fetcher = fetch,
    now = Date.now,
    target = document,
    online = () => navigator.onLine,
  }: UpdateCheckOptions = {},
): () => void {
  let last = now();

  const check = async () => {
    if (registration.installing || !online()) return;
    last = now();
    try {
      const response = await fetcher(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
      if (response.status === 200) await registration.update();
    } catch {
      // the site did not answer: the next check will ask again
    }
  };

  const timer = setInterval(() => void check(), intervalMs);
  const onVisible = () => {
    if (target.visibilityState === 'visible' && now() - last >= minGapMs) void check();
  };
  target.addEventListener('visibilitychange', onVisible);

  return () => {
    clearInterval(timer);
    target.removeEventListener('visibilitychange', onVisible);
  };
}
