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

export async function downloadBackup(password?: string): Promise<void> {
  const backup = await collectBackup();
  const text = await serializeBackup(backup, password || undefined);

  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

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
