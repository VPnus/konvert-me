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
  type RestoreSummary,
} from '@/db/backup';
import { markBackupDone } from '@/db/repositories/settings';
import { publishAppEvent } from '@/lib/broadcast';
import { ru } from '@/i18n/ru';
import { downloadBlob } from '@/lib/download';

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

export async function importBackupFile(file: File, password?: string): Promise<RestoreSummary> {
  const backup = await parseBackup(await file.text(), password);
  const summary = await restoreBackup(backup);
  publishAppEvent({ type: 'data-replaced' });
  return summary;
}

export async function wipeEverything(): Promise<void> {
  await clearAllData();
  publishAppEvent({ type: 'data-cleared' });
}

/** When the last backup was made, in words; «копий ещё не было» if never. */
export function lastBackupLabel(timestamp: number | null): string {
  if (timestamp === null) return ru.settings.backupNever;
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(timestamp));
}
