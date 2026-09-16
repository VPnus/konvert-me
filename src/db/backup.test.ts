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
import { getDeductionYear, saveDeductionYear } from '@/db/repositories/deductions';
import { getFinancialPlan, saveEducationPlan, setRiskProfile } from '@/db/repositories/financial-plan';
import { addDocument, listDocuments, readDocumentContent } from '@/db/repositories/documents';
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

  it('takes a file from an older schema, whose newer tables are simply missing', async () => {
    const backup = await collectBackup();
    const data = { ...backup.data } as Record<string, unknown>;
    delete data.incomeSources;
    delete data.links;
    delete data.feeds;
    delete data.feedItems;

    const older = { ...backup, schemaVersion: 1, data };
    const parsed = await parseBackup(JSON.stringify(older));

    expect(parsed.data.incomeSources).toEqual([]);
    expect(parsed.data.links).toEqual([]);
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

describe('backup: deductions and their documents', () => {
  async function seedDeductions(): Promise<void> {
    await saveDeductionYear({
      year: 2025,
      incomeMinor: 1_200_000 * RUB,
      spending: {
        treatmentMinor: 90_000 * RUB,
        educationMinor: 0,
        sportMinor: 0,
        insuranceMinor: 0,
        childEducationMinor: [110_000 * RUB],
        expensiveTreatmentMinor: 0,
      },
      longTermSavingsMinor: 0,
      status: 'filed',
    });
    await addDocument({
      year: 2025,
      category: 'child_schooling',
      fileName: 'договор с вузом.pdf',
      mimeType: 'application/pdf',
      // bytes that a careless text conversion would break
      content: new Uint8Array([0, 37, 80, 255, 128, 10, 13]).buffer,
    });
  }

  it('carries the years and the exact bytes of every document through export and import', async () => {
    await seedDeductions();
    const text = await serializeBackup(await collectBackup());

    await clearAllData();
    expect(await listDocuments()).toHaveLength(0);
    await restoreBackup(await parseBackup(text));

    expect(await getDeductionYear(2025)).toMatchObject({ status: 'filed', incomeMinor: 1_200_000 * RUB });
    const [document] = await listDocuments(2025);
    expect(document.fileName).toBe('договор с вузом.pdf');
    expect([...new Uint8Array((await readDocumentContent(document.id))!)]).toEqual([
      0, 37, 80, 255, 128, 10, 13,
    ]);
  });

  it('counts a document once in what the import reports, not once for its bytes as well', async () => {
    await seedDeductions();
    const text = await serializeBackup(await collectBackup());

    await clearAllData();
    const summary = await restoreBackup(await parseBackup(text));

    // one year and one document
    expect(summary.total).toBe(2);
    expect(summary.counts.documents).toBe(1);
  });

  it('keeps files of every length whole, whatever padding their base64 ends with', async () => {
    // 3 bytes end with no padding, 2 with "=", 1 with "==": a mistake in counting any of
    // them would call a sound file broken and refuse the whole backup
    for (const length of [1, 2, 3, 4, 5, 6]) {
      await addDocument({
        year: 2025,
        category: 'other',
        fileName: `${length}.bin`,
        mimeType: 'application/octet-stream',
        content: new Uint8Array(Array.from({ length }, (_, index) => 250 - index)).buffer,
      });
    }
    const text = await serializeBackup(await collectBackup());

    await clearAllData();
    await restoreBackup(await parseBackup(text));

    for (const document of await listDocuments(2025)) {
      const content = new Uint8Array((await readDocumentContent(document.id))!);
      expect(content.length, document.fileName).toBe(document.sizeBytes);
      expect(content[0], document.fileName).toBe(250);
    }
    expect(await listDocuments(2025)).toHaveLength(6);
  });

  it('carries them through a file with a password as well', async () => {
    await seedDeductions();
    const text = await serializeBackup(await collectBackup(), 'пароль');

    expect(text).not.toContain('договор с вузом');

    await clearAllData();
    await restoreBackup(await parseBackup(text, 'пароль'));

    const [document] = await listDocuments(2025);
    expect([...new Uint8Array((await readDocumentContent(document.id))!)]).toEqual([
      0, 37, 80, 255, 128, 10, 13,
    ]);
  });

  it('takes a year of schema 6 and splits what earlier returns took of its home', async () => {
    const backup = await collectBackup();
    const home = {
      purchaseMinor: 4_500_000 * RUB,
      mortgageInterestMinor: 310_000 * RUB,
      loanBefore2014: false,
    };
    const old = {
      year: 2025,
      incomeMinor: 1_200_000 * RUB,
      spending: {
        treatmentMinor: 0,
        educationMinor: 0,
        sportMinor: 0,
        insuranceMinor: 0,
        childEducationMinor: [],
        expensiveTreatmentMinor: 0,
      },
      longTermSavingsMinor: 0,
      property: { ...home, usedBeforeMinor: 2_100_000 * RUB },
      status: 'filed',
      createdAt: 1,
      updatedAt: 1,
    };
    const data = { ...backup.data, deductionYears: [old] };

    const parsed = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 6, data }));

    expect(parsed.data.deductionYears[0].property).toEqual({
      ...home,
      usedBeforePurchaseMinor: 2_000_000 * RUB,
      usedBeforeInterestMinor: 100_000 * RUB,
    });
  });

  it('refuses a year of schema 6 whose sum taken before is not money', async () => {
    const backup = await collectBackup();
    const broken = {
      year: 2025,
      incomeMinor: 0,
      spending: {
        treatmentMinor: 0,
        educationMinor: 0,
        sportMinor: 0,
        insuranceMinor: 0,
        childEducationMinor: [],
        expensiveTreatmentMinor: 0,
      },
      longTermSavingsMinor: 0,
      property: { purchaseMinor: 0, mortgageInterestMinor: 0, loanBefore2014: false, usedBeforeMinor: -5 },
      status: 'draft',
      createdAt: 1,
      updatedAt: 1,
    };
    const data = { ...backup.data, deductionYears: [broken] };

    await expect(parseBackup(JSON.stringify({ ...backup, schemaVersion: 6, data }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('takes a file from schema 4, which knows nothing of deductions', async () => {
    const backup = await collectBackup();
    const data = { ...backup.data } as Record<string, unknown>;
    delete data.deductionYears;
    delete data.documents;
    delete data.documentFiles;

    const parsed = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 4, data }));

    expect(parsed.data.deductionYears).toEqual([]);
    expect(parsed.data.documents).toEqual([]);
    expect(parsed.data.documentFiles).toEqual([]);
  });

  it('refuses a document whose bytes do not add up to its size', async () => {
    await seedDeductions();
    const backup = await collectBackup();
    const broken = {
      ...backup,
      data: { ...backup.data, documents: [{ ...backup.data.documents[0], sizeBytes: 999 }] },
    };

    await expect(parseBackup(JSON.stringify(broken))).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a document that lost its file', async () => {
    await seedDeductions();
    const backup = await collectBackup();
    const broken = { ...backup, data: { ...backup.data, documentFiles: [] } };

    await expect(parseBackup(JSON.stringify(broken))).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a document whose bytes are not readable', async () => {
    await seedDeductions();
    const backup = await collectBackup();
    const broken = {
      ...backup,
      data: {
        ...backup.data,
        documentFiles: [{ ...backup.data.documentFiles[0], content: 'это не base64 !!!' }],
      },
    };

    await expect(parseBackup(JSON.stringify(broken))).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('backup: the financial plan', () => {
  it('carries the plan through export and import', async () => {
    await setRiskProfile('moderate', '2026-09-16');
    await saveEducationPlan({
      name: 'Маша',
      yearlyCostMinor: 600_000 * RUB,
      years: 6,
      costAsOf: '2026-09',
      startMonth: '2034-09',
      returnRate: 0.0883,
      inflationRate: 0.069,
    });
    const before = await getFinancialPlan();

    const text = await serializeBackup(await collectBackup());
    await clearAllData();
    await restoreBackup(await parseBackup(text));

    expect(await getFinancialPlan()).toEqual(before);
  });

  it('takes a file from schema 5, which knows nothing of the plan', async () => {
    const backup = await collectBackup();
    const data = { ...backup.data } as Record<string, unknown>;
    delete data.financialPlans;

    const parsed = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 5, data }));

    expect(parsed.data.financialPlans).toEqual([]);
  });
});
