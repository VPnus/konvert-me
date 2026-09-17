import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import {
  createCategory,
  DEFAULT_CATEGORIES,
  listCategories,
  seedDefaultCategories,
  setCategoryArchived,
} from '@/db/repositories/categories';

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
