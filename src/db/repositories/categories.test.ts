import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import {
  createCategory,
  DEFAULT_CATEGORIES,
  defaultCategoriesFor,
  listCategories,
  seedDefaultCategories,
  setCategoryArchived,
} from '@/db/repositories/categories';
import { changeCountry } from '@/db/repositories/settings';
import { setCurrentCountry } from '@/i18n/country';

beforeEach(async () => {
  await clearAllData();
});

describe('categories of one’s own', () => {
  it('starts with a category for subscriptions and bank fees', async () => {
    await seedDefaultCategories();
    expect(await db.categories.get('subscriptions')).toMatchObject({
      name: 'Подписки и комиссии',
      kind: 'expense',
      group: 'variable',
    });
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });

  it('adds one, refuses the same name twice in the same kind, and hides it in the archive', async () => {
    await seedDefaultCategories();
    const pet = await createCategory({ name: 'Питомец', kind: 'expense', group: 'variable' });
    expect((await listCategories()).at(-1)?.name).toBe('Питомец');

    await expect(createCategory({ name: ' питомец ', kind: 'expense', group: 'mandatory' })).rejects.toThrow(
      RepositoryError,
    );
    // an income may bear the name of an expense
    await expect(createCategory({ name: 'Питомец', kind: 'income' })).resolves.toMatchObject({
      kind: 'income',
    });

    await setCategoryArchived(pet.id, true);
    expect((await listCategories()).map((category) => category.id)).not.toContain(pet.id);
    expect((await listCategories({ includeArchived: true })).map((category) => category.id)).toContain(
      pet.id,
    );
  });
});

describe('categories: the starter set of a country', () => {
  it('leaves the advance of a Russian payroll out of the United States', () => {
    expect(defaultCategoriesFor('ru').map((category) => category.id)).toContain('advance');
    expect(defaultCategoriesFor('us').map((category) => category.id)).not.toContain('advance');
    expect(defaultCategoriesFor('us')).toHaveLength(DEFAULT_CATEGORIES.length - 1);
  });

  it('seeds the set of the country of the page', async () => {
    // the app session sets the country of the page from the settings before a screen is drawn
    await changeCountry('us');
    setCurrentCountry('us');
    await seedDefaultCategories();

    const ids = (await db.categories.toArray()).map((category) => category.id);
    expect(ids).not.toContain('advance');
    expect(ids).toContain('salary');

    await changeCountry('ru');
    setCurrentCountry('ru');
  });
});
