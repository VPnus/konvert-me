/**
 * The browser side of the backup: turning the file into a download and back.
 * Everything happens locally, the file never leaves the device on its own.
 */

import {
  backupFileName,
  collectBackup,
  isEncryptedBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  clearAllData,
  type BackupFile,
  type RestoreSummary,
} from '@/db/backup';
import { markBackupDone } from '@/db/repositories/settings';
import { publishAppEvent } from '@/lib/broadcast';
import { currentLocale, strings } from '@/i18n';
import { downloadBlob } from '@/lib/download';
import { clearUsage } from '@/lib/usage';

export async function downloadBackup(password?: string): Promise<void> {
  const backup = await collectBackup();
  const text = await serializeBackup(backup, password || undefined);

  downloadBlob(new Blob([text], { type: 'application/json' }), backupFileName());

  await markBackupDone();
  publishAppEvent({ type: 'settings-changed' });
}

export async function fileNeedsPassword(file: File): Promise<boolean> {
  return isEncryptedBackup(await file.text());
}

/** Reads and checks a file without touching the data: what it holds is shown before it replaces anything. */
export async function readBackupFile(file: File, password?: string): Promise<BackupFile> {
  return parseBackup(await file.text(), password);
}

export async function importBackup(backup: BackupFile): Promise<RestoreSummary> {
  const summary = await restoreBackup(backup);
  publishAppEvent({ type: 'data-replaced' });
  return summary;
}

export async function wipeEverything(): Promise<void> {
  await clearAllData();
  // "All the data" means the days of use too, though they live apart from the database.
  clearUsage();
  publishAppEvent({ type: 'data-cleared' });
}

/** When the last backup was made, in words; «копий ещё не было» if never. */
export function lastBackupLabel(timestamp: number | null): string {
  if (timestamp === null) return strings.settings.backupNever;
  return new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'long' }).format(new Date(timestamp));
}
