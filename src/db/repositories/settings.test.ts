import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db/db';
import { ValidationError } from '@/db/errors';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '@/db/models';
import { createAccount } from '@/db/repositories/accounts';
import {
  changeCountry,
  getCountry,
  getSettings,
  isBackupDue,
  markBackupDone,
  updateSettings,
} from '@/db/repositories/settings';

const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await db.settings.clear();
  await db.accounts.clear();
});

describe('settings', () => {
  it('creates the defaults of the plan on the first read', async () => {
    const settings = await getSettings();

    expect(settings.inflationRate).toBe(0.08);
    expect(settings.defaultReturnRate).toBe(0.1);
    expect(settings.reserveTargetMonths).toBe(6);
    expect(settings.onboardingDone).toBe(false);
    expect(settings.schemaVersion).toBe(SCHEMA_VERSION);
    expect(await db.settings.count()).toBe(1);
  });

  it('keeps the stored settings on the next read', async () => {
    await updateSettings({ inflationRate: 0.07 });
    expect((await getSettings()).inflationRate).toBe(0.07);
    expect(await db.settings.count()).toBe(1);
  });

  it('validates what it is given', async () => {
    await expect(updateSettings({ reserveTargetMonths: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateSettings({ reserveTargetMonths: 6.5 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('keeps both of two updates made at the same time', async () => {
    // The onboarding skip and the storage bootstrap both write the settings on /welcome.
    await Promise.all([updateSettings({ onboardingDone: true }), updateSettings({ storagePersisted: true })]);

    const settings = await getSettings();
    expect(settings.onboardingDone).toBe(true);
    expect(settings.storagePersisted).toBe(true);
  });

  it('remembers the date of the last backup', async () => {
    const settings = await markBackupDone(1_700_000_000_000);
    expect(settings.lastBackupAt).toBe(1_700_000_000_000);
  });
});

describe('settings: the country of the data', () => {
  it('is Russia until another is chosen, and reading it writes nothing', async () => {
    expect(await getCountry()).toBe('ru');
    expect(await db.settings.count()).toBe(0);
    expect((await getSettings()).country).toBe('ru');
  });

  it('fills the country of a row kept before it was asked', async () => {
    const older: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete older.country;
    await db.settings.put(older as typeof DEFAULT_SETTINGS);
    expect((await getSettings()).country).toBe('ru');
  });

  it('takes the accounts to the currency of the new country and leaves every sum as it was', async () => {
    const card = await createAccount({
      name: 'Карта',
      side: 'asset',
      type: 'debit',
      openingBalanceMinor: 100_000_00,
    });
    expect(card.currency).toBe('RUB');

    const settings = await changeCountry('us');
    expect(settings.country).toBe('us');
    expect(await getCountry()).toBe('us');
    expect(await db.accounts.get(card.id)).toMatchObject({
      currency: 'USD',
      openingBalanceMinor: 100_000_00,
    });

    // an account opened there is in dollars from the start
    const cash = await createAccount({
      name: 'Cash',
      side: 'asset',
      type: 'cash',
      openingBalanceMinor: 50_00,
    });
    expect(cash.currency).toBe('USD');

    await changeCountry('ru');
    expect((await db.accounts.toArray()).map((account) => account.currency)).toEqual(['RUB', 'RUB']);
  });
});

describe('settings: the backup reminder', () => {
  const base = { ...DEFAULT_SETTINGS };

  it('asks for a backup when there has never been one', () => {
    expect(isBackupDue(base)).toBe(true);
  });

  it('stays quiet for thirty days after a backup', () => {
    const now = 1_800_000_000_000;
    expect(isBackupDue({ ...base, lastBackupAt: now - 29 * DAY }, now)).toBe(false);
    expect(isBackupDue({ ...base, lastBackupAt: now - 30 * DAY }, now)).toBe(true);
  });

  it('can be switched off', () => {
    expect(isBackupDue({ ...base, backupReminderDays: 0 })).toBe(false);
  });
});
