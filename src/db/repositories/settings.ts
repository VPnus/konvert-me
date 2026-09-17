import { COUNTRY_CURRENCY, DEFAULT_COUNTRY, type Country } from '@/core/country';
import { db } from '@/db/db';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, settingsSchema, type AppSettings } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { strings } from '@/i18n';
import { publishAppEvent } from '@/lib/broadcast';

const SETTINGS_ID = 'app';

export async function getSettings(): Promise<AppSettings> {
  const stored = await db.settings.get(SETTINGS_ID);

  if (stored) {
    // A row written by an older schema misses the newer fields; Zod fills the defaults.
    const migrated = parseOrThrow(
      settingsSchema,
      { ...DEFAULT_SETTINGS, ...stored },
      strings.data.subjects.settings,
    );
    if (JSON.stringify(migrated) !== JSON.stringify(stored)) await db.settings.put(migrated);
    return migrated;
  }

  const fresh = { ...DEFAULT_SETTINGS, schemaVersion: SCHEMA_VERSION };
  await db.settings.put(fresh);
  return fresh;
}

/** The country of the data as kept; nothing is written, not even a missing row. */
export async function getCountry(): Promise<Country> {
  return (await db.settings.get(SETTINGS_ID))?.country ?? DEFAULT_COUNTRY;
}

/** Any setting but the country: that one moves the currency of the accounts too, see changeCountry. */
export async function updateSettings(
  patch: Partial<Omit<AppSettings, 'id' | 'country'>>,
): Promise<AppSettings> {
  // Read and write in one transaction: two updates at once must not write over each other.
  const next = await db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    const merged = parseOrThrow(
      settingsSchema,
      { ...current, ...patch, id: SETTINGS_ID },
      strings.data.subjects.settings,
    );
    await db.settings.put(merged);
    return merged;
  });
  publishAppEvent({ type: 'settings-changed' });
  return next;
}

/**
 * Moves the data to another country: the accounts take its currency, and every sum stays the number it
 * was. 100 000 ₽ become $100,000, not their price in dollars: the app knows no rate of exchange.
 */
export async function changeCountry(country: Country): Promise<AppSettings> {
  const next = await db.transaction('rw', db.settings, db.accounts, async () => {
    const current = await getSettings();
    const merged = parseOrThrow(
      settingsSchema,
      { ...current, country, id: SETTINGS_ID },
      strings.data.subjects.settings,
    );
    await db.settings.put(merged);
    await db.accounts.toCollection().modify({ currency: COUNTRY_CURRENCY[country] });
    return merged;
  });
  publishAppEvent({ type: 'settings-changed' });
  return next;
}

export async function markBackupDone(at: number = Date.now()): Promise<AppSettings> {
  return updateSettings({ lastBackupAt: at });
}

/** True when the user has not exported anything for longer than the reminder period. */
export function isBackupDue(settings: AppSettings, now: number = Date.now()): boolean {
  if (settings.backupReminderDays === 0) return false;
  if (settings.lastBackupAt === null) return true;
  return now - settings.lastBackupAt >= settings.backupReminderDays * 24 * 60 * 60 * 1000;
}
