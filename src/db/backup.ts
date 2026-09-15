/**
 * Export and import of every table as one JSON file, optionally encrypted with a
 * password. The import validates the file with the same Zod schemas as the storage
 * layer, so a broken file can never land in the database.
 */

import { z } from 'zod';

import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { SCHEMA_VERSION, TABLE_NAMES, TABLE_SCHEMAS, type TableName } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { decryptText, encryptText, type EncryptedPayload } from '@/lib/crypto';

export const BACKUP_FORMAT = 'konvert-me-backup';
export const BACKUP_FORMAT_ENCRYPTED = 'konvert-me-backup-encrypted';

const backupDataSchema = z.object({
  settings: z.array(TABLE_SCHEMAS.settings),
  accounts: z.array(TABLE_SCHEMAS.accounts),
  categories: z.array(TABLE_SCHEMAS.categories),
  transactions: z.array(TABLE_SCHEMAS.transactions),
  budgetPlans: z.array(TABLE_SCHEMAS.budgetPlans),
  goals: z.array(TABLE_SCHEMAS.goals),
  envelopes: z.array(TABLE_SCHEMAS.envelopes),
  dashboardLayouts: z.array(TABLE_SCHEMAS.dashboardLayouts),
  // Added in schema 2: a file written by schema 1 simply has none of them.
  links: z.array(TABLE_SCHEMAS.links).default([]),
  feeds: z.array(TABLE_SCHEMAS.feeds).default([]),
  feedItems: z.array(TABLE_SCHEMAS.feedItems).default([]),
});

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.number().int().nonnegative(),
  data: backupDataSchema,
});

const encryptedFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT_ENCRYPTED),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.number().int().nonnegative(),
  kdf: z.object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    iterations: z.number().int().positive(),
    salt: z.string().min(1),
  }),
  cipher: z.object({ name: z.literal('AES-GCM'), iv: z.string().min(1) }),
  payload: z.string().min(1),
});

export type BackupFile = z.infer<typeof backupFileSchema>;
export type BackupData = z.infer<typeof backupDataSchema>;

export async function collectBackup(now: number = Date.now()): Promise<BackupFile> {
  const [
    settings,
    accounts,
    categories,
    transactions,
    budgetPlans,
    goals,
    envelopes,
    dashboardLayouts,
    links,
    feeds,
    feedItems,
  ] = await Promise.all([
    db.settings.toArray(),
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgetPlans.toArray(),
    db.goals.toArray(),
    db.envelopes.toArray(),
    db.dashboardLayouts.toArray(),
    db.links.toArray(),
    db.feeds.toArray(),
    db.feedItems.toArray(),
  ]);

  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    data: {
      settings,
      accounts,
      categories,
      transactions,
      budgetPlans,
      goals,
      envelopes,
      dashboardLayouts,
      links,
      feeds,
      feedItems,
    },
  };
}

export async function serializeBackup(backup: BackupFile, password?: string): Promise<string> {
  if (!password) return JSON.stringify(backup, null, 2);

  const encrypted = await encryptText(JSON.stringify(backup), password);
  return JSON.stringify(
    {
      format: BACKUP_FORMAT_ENCRYPTED,
      schemaVersion: backup.schemaVersion,
      exportedAt: backup.exportedAt,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: encrypted.iterations, salt: encrypted.salt },
      cipher: { name: 'AES-GCM', iv: encrypted.iv },
      payload: encrypted.data,
    },
    null,
    2,
  );
}

export function isEncryptedBackup(text: string): boolean {
  try {
    return (JSON.parse(text) as { format?: string }).format === BACKUP_FORMAT_ENCRYPTED;
  } catch {
    return false;
  }
}

export async function parseBackup(text: string, password?: string): Promise<BackupFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new RepositoryError('Это не файл резервной копии: не удалось прочитать JSON.');
  }

  const format = (raw as { format?: string }).format;

  if (format === BACKUP_FORMAT_ENCRYPTED) {
    const file = parseOrThrow(encryptedFileSchema, raw, 'Зашифрованная копия');
    const payload: EncryptedPayload = {
      salt: file.kdf.salt,
      iv: file.cipher.iv,
      iterations: file.kdf.iterations,
      data: file.payload,
    };
    return parseBackup(await decryptText(payload, password ?? ''));
  }

  const file = parseOrThrow(backupFileSchema, raw, 'Резервная копия');

  if (file.schemaVersion > SCHEMA_VERSION) {
    throw new RepositoryError(
      `Файл создан более новой версией приложения (схема ${file.schemaVersion}). Обновите приложение и повторите импорт.`,
    );
  }

  return file;
}

export interface RestoreSummary {
  readonly counts: Record<TableName, number>;
  readonly total: number;
}

/** Replace mode: the database is cleared and filled from the file in one transaction. */
export async function restoreBackup(backup: BackupFile): Promise<RestoreSummary> {
  const tables = TABLE_NAMES.map((name) => db.table(name));

  await db.transaction('rw', tables, async () => {
    for (const name of TABLE_NAMES) {
      await db.table(name).clear();
      const rows = backup.data[name] as unknown[];
      if (rows.length > 0) await db.table(name).bulkPut(rows);
    }
  });

  const counts = Object.fromEntries(TABLE_NAMES.map((name) => [name, backup.data[name].length])) as Record<
    TableName,
    number
  >;

  return { counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
}

export async function clearAllData(): Promise<void> {
  const tables = TABLE_NAMES.map((name) => db.table(name));
  await db.transaction('rw', tables, async () => {
    for (const table of tables) await table.clear();
  });
}

export function backupFileName(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `konverkot-backup-${stamp}.json`;
}
