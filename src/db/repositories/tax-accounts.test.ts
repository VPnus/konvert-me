import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { RepositoryError, ValidationError } from '@/db/errors';
import {
  contributionOfYear,
  createTaxAccount,
  deleteTaxAccount,
  listTaxAccounts,
  loadTaxAccounts,
  setTaxAccountYear,
  updateTaxAccount,
} from '@/db/repositories/tax-accounts';

const DOLLAR = 100;

beforeEach(async () => {
  await clearAllData();
});

describe('tax advantaged accounts', () => {
  it('keeps the order in which they were added and hides an archived one', async () => {
    const plan = await createTaxAccount({ name: 'Work 401(k)', kind: '401k' });
    await createTaxAccount({ name: 'Roth IRA', kind: 'roth_ira' });

    expect((await listTaxAccounts()).map((account) => account.name)).toEqual(['Work 401(k)', 'Roth IRA']);

    await updateTaxAccount(plan.id, { archived: true });
    expect(await listTaxAccounts()).toHaveLength(1);
    expect(await listTaxAccounts({ includeArchived: true })).toHaveLength(2);
  });

  it('starts an account with no year filled in and no catch-up claimed', async () => {
    const account = await createTaxAccount({ name: 'HSA', kind: 'hsa' });
    expect(account).toMatchObject({ years: [], catchUp: 'none', familyCoverage: false });
  });

  it('refuses a kind it does not know and an empty name', async () => {
    await expect(
      createTaxAccount({ name: 'Что-то', kind: 'иис' as unknown as '401k' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(createTaxAccount({ name: '  ', kind: 'ira' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('reports an account that is not there instead of creating one', async () => {
    await expect(updateTaxAccount('нет-такого', { name: 'IRA' })).rejects.toBeInstanceOf(RepositoryError);
    await expect(
      setTaxAccountYear('нет-такого', 2026, { ownMinor: 0, employerMinor: 0 }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });

  it('writes what went in in a year, replaces it, and drops a year emptied again', async () => {
    const account = await createTaxAccount({ name: 'Work 401(k)', kind: '401k' });

    await setTaxAccountYear(account.id, 2026, { ownMinor: 10_000 * DOLLAR, employerMinor: 3_000 * DOLLAR });
    await setTaxAccountYear(account.id, 2025, { ownMinor: 8_000 * DOLLAR, employerMinor: 0 });
    let stored = await db.taxAccounts.get(account.id);
    expect(stored?.years.map((year) => year.year)).toEqual([2025, 2026]);
    expect(contributionOfYear(stored!, 2026)).toEqual({
      ownMinor: 10_000 * DOLLAR,
      employerMinor: 3_000 * DOLLAR,
    });

    await setTaxAccountYear(account.id, 2026, { ownMinor: 12_000 * DOLLAR, employerMinor: 0 });
    stored = await db.taxAccounts.get(account.id);
    expect(contributionOfYear(stored!, 2026).ownMinor).toBe(12_000 * DOLLAR);

    await setTaxAccountYear(account.id, 2026, { ownMinor: 0, employerMinor: 0 });
    stored = await db.taxAccounts.get(account.id);
    expect(stored?.years.map((year) => year.year)).toEqual([2025]);
    expect(contributionOfYear(stored!, 2026)).toEqual({ ownMinor: 0, employerMinor: 0 });
  });

  it('holds the limits of the year against every account of the person', async () => {
    const ira = await createTaxAccount({ name: 'IRA', kind: 'ira' });
    const roth = await createTaxAccount({ name: 'Roth IRA', kind: 'roth_ira' });
    await setTaxAccountYear(ira.id, 2026, { ownMinor: 5_000 * DOLLAR, employerMinor: 0 });
    await setTaxAccountYear(roth.id, 2026, { ownMinor: 1_000 * DOLLAR, employerMinor: 0 });

    const view = await loadTaxAccounts(2026);
    expect(view.rulesYear).toBe(2026);
    expect(view.limits).toHaveLength(1);
    expect(view.limits[0]).toMatchObject({
      group: 'ira',
      countedMinor: 6_000 * DOLLAR,
      leftMinor: 1_500 * DOLLAR,
    });
  });

  it('lends the latest norms to a year nobody has written yet, and says which year they are', async () => {
    await createTaxAccount({ name: 'IRA', kind: 'ira' });
    const view = await loadTaxAccounts(2031);
    expect(view.year).toBe(2031);
    expect(view.rulesYear).toBe(2026);
    expect(view.limits[0].limitMinor).toBe(7_500 * DOLLAR);
  });

  it('deletes an account with everything it kept', async () => {
    const account = await createTaxAccount({ name: '529', kind: '529' });
    await setTaxAccountYear(account.id, 2026, { ownMinor: 1_000 * DOLLAR, employerMinor: 0 });
    await deleteTaxAccount(account.id);
    expect(await db.taxAccounts.count()).toBe(0);
  });
});
