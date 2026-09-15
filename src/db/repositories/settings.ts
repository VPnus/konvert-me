import { db } from '@/db/db';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, settingsSchema, type AppSettings } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

const SETTINGS_ID = 'app';

export async function getSettings(): Promise<AppSettings> {
  const stored = await db.settings.get(SETTINGS_ID);

  if (stored) {
    // A row written by an older schema misses the newer fields; Zod fills the defaults.
    const migrated = parseOrThrow(settingsSchema, { ...DEFAULT_SETTINGS, ...stored }, 'Настройки');
    if (JSON.stringify(migrated) !== JSON.stringify(stored)) await db.settings.put(migrated);
    return migrated;
  }

  const fresh = { ...DEFAULT_SETTINGS, schemaVersion: SCHEMA_VERSION };
  await db.settings.put(fresh);
  return fresh;
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<AppSettings> {
  const current = await getSettings();
  const next = parseOrThrow(settingsSchema, { ...current, ...patch, id: SETTINGS_ID }, 'Настройки');
  await db.settings.put(next);
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
