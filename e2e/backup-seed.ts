import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, type Page } from '@playwright/test';

/**
 * Months of a household go in through a backup file, as they would from a real one: the app exports
 * what it has, the test adds its rows, and the file is imported back.
 */

export type Row = Record<string, unknown>;
export interface BackupData {
  accounts: Row[];
  transactions: Row[];
  goals: Row[];
  envelopes: Row[];
  [table: string]: Row[];
}

export const RUB = 100;

/** Exports what the app has, lets the test add its rows, and imports the file back. */
export async function seed(page: Page, fill: (data: BackupData) => void): Promise<void> {
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const file = join(await mkdtemp(join(tmpdir(), 'konverkot-scenario-')), 'backup.json');
  await (await download).saveAs(file);

  const backup = JSON.parse(await readFile(file, 'utf8')) as { data: BackupData };
  fill(backup.data);
  await writeFile(file, JSON.stringify(backup));

  await page.getByTestId('backup-import').setInputFiles(file);
  await page.getByTestId('confirm-action').click();
  await expect(page.getByTestId('backup-message')).toContainText('восстановлены');
}

export function account(id: string, patch: Row): Row {
  return {
    id,
    currency: 'RUB',
    side: 'asset',
    type: 'debit',
    openingDate: '2026-06-01',
    isLiquid: true,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

let created = 0;
export function operation(date: string, kind: string, rubles: number, patch: Row = {}): Row {
  created += 1;
  return {
    id: `op-${created}`,
    date,
    kind,
    amountMinor: Math.round(rubles * RUB),
    createdAt: created,
    ...patch,
  };
}

export function goal(id: string, name: string, patch: Row = {}): Row {
  return {
    id,
    name,
    priority: 1,
    kind: 'purchase',
    costAsOf: '2026-09',
    targetMonth: '2031-09',
    returnRate: 0.1,
    inflationRate: 0,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}
