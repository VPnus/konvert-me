import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import {
  BACKUP_FORMAT,
  backupFileName,
  clearAllData,
  collectBackup,
  isEncryptedBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from '@/db/backup';
import { SCHEMA_VERSION, TABLE_NAMES } from '@/db/models';
import { createAccount } from '@/db/repositories/accounts';
import { getSettings } from '@/db/repositories/settings';
import { CryptoError } from '@/lib/crypto';

const RUB = 100;

async function seed(): Promise<void> {
  await getSettings();
  await createAccount({
    name: 'Карта',
    side: 'asset',
    type: 'debit',
    openingBalanceMinor: 100_000 * RUB,
    openingDate: '2026-09-01',
  });
  await createAccount({
    name: 'Ипотека',
    side: 'liability',
    type: 'mortgage',
    openingBalanceMinor: 3_000_000 * RUB,
    openingDate: '2026-01-01',
    monthlyPaymentMinor: 35_000 * RUB,
  });
  await db.categories.add({
    id: 'food',
    name: 'Еда',
    kind: 'expense',
    group: 'variable',
    sortOrder: 0,
    archived: false,
  });
  await db.transactions.add({
    id: 't1',
    date: '2026-09-05',
    amountMinor: 1_500 * RUB,
    kind: 'expense',
    accountId: (await db.accounts.toArray())[0].id,
    categoryId: 'food',
    createdAt: 1_700_000_000_000,
  });
}

beforeEach(async () => {
  await clearAllData();
});

describe('backup: export and import without a password', () => {
  it('collects every table', async () => {
    await seed();
    const backup = await collectBackup(1_700_000_000_000);

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect(backup.exportedAt).toBe(1_700_000_000_000);
    expect(Object.keys(backup.data).sort()).toEqual([...TABLE_NAMES].sort());
    expect(backup.data.accounts).toHaveLength(2);
    expect(backup.data.transactions).toHaveLength(1);
  });

  it('survives the round trip data → export → clear → import', async () => {
    await seed();
    const before = await collectBackup();
    const text = await serializeBackup(before);

    await clearAllData();
    expect(await db.accounts.count()).toBe(0);

    const parsed = await parseBackup(text);
    const summary = await restoreBackup(parsed);

    expect(summary.counts.accounts).toBe(2);
    expect(summary.total).toBeGreaterThan(3);

    const after = await collectBackup(before.exportedAt);
    expect(after).toEqual(before);
  });

  it('replaces whatever was in the database', async () => {
    await seed();
    const text = await serializeBackup(await collectBackup());

    await clearAllData();
    await createAccount({ name: 'Лишний счёт', side: 'asset', type: 'cash', openingBalanceMinor: 0 });

    await restoreBackup(await parseBackup(text));

    const names = (await db.accounts.toArray()).map((account) => account.name).sort();
    expect(names).toEqual(['Ипотека', 'Карта']);
  });

  it('names the file by the date', () => {
    expect(backupFileName(new Date(2026, 8, 15))).toBe('konverkot-backup-2026-09-15.json');
  });
});

describe('backup: a broken file never reaches the database', () => {
  it('rejects text that is not JSON', async () => {
    await expect(parseBackup('не json')).rejects.toBeInstanceOf(RepositoryError);
  });

  it('rejects JSON that is not a backup', async () => {
    await expect(parseBackup('{"hello":"world"}')).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a row that breaks the rules', async () => {
    await seed();
    const backup = await collectBackup();
    const broken = {
      ...backup,
      data: {
        ...backup.data,
        accounts: [{ ...backup.data.accounts[0], openingBalanceMinor: 10.5 }],
      },
    };

    await expect(parseBackup(JSON.stringify(broken))).rejects.toBeInstanceOf(ValidationError);
    expect(await db.accounts.count()).toBe(2);
  });

  it('rejects a file from a newer schema', async () => {
    await seed();
    const backup = await collectBackup();
    const newer = { ...backup, schemaVersion: SCHEMA_VERSION + 5 };

    await expect(parseBackup(JSON.stringify(newer))).rejects.toThrow(/более новой версией/);
  });
});

describe('backup: optional password', () => {
  it('encrypts and decrypts the file', async () => {
    await seed();
    const backup = await collectBackup();
    const text = await serializeBackup(backup, 'очень секретно');

    expect(isEncryptedBackup(text)).toBe(true);
    expect(text).not.toContain('Ипотека');

    const parsed = await parseBackup(text, 'очень секретно');
    expect(parsed).toEqual(backup);
  });

  it('refuses a wrong password', async () => {
    await seed();
    const text = await serializeBackup(await collectBackup(), 'правильный');

    await expect(parseBackup(text, 'неправильный')).rejects.toBeInstanceOf(CryptoError);
  });

  it('refuses an empty password for an encrypted file', async () => {
    await seed();
    const text = await serializeBackup(await collectBackup(), 'пароль');

    await expect(parseBackup(text)).rejects.toBeInstanceOf(CryptoError);
  });

  it('refuses to encrypt with an empty password', async () => {
    await expect(serializeBackup(await collectBackup(), '')).resolves.not.toContain('payload');
  });

  it('knows a plain file is not encrypted', async () => {
    const text = await serializeBackup(await collectBackup());
    expect(isEncryptedBackup(text)).toBe(false);
    expect(isEncryptedBackup('не json')).toBe(false);
  });
});
