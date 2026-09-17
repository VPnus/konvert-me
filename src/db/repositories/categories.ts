/**
 * Categories. The starter set follows the budget template of the course (lesson 2.9):
 * income, mandatory expenses, variable expenses.
 */

import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { categorySchema, type Category } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { DEFAULT_CATEGORIES, type DefaultCategory } from '@/db/default-categories';
import { publishAppEvent } from '@/lib/broadcast';

export { DEFAULT_CATEGORIES, type DefaultCategory };

/** Interest on loans: the part of a debt payment that is an expense, the rest is a transfer. */
export const LOAN_INTEREST_CATEGORY = 'loan-interest';

/** Where the onboarding puts the sums the user gives as one number. */
export const ONBOARDING_INCOME_CATEGORY = 'salary';
export const ONBOARDING_MANDATORY_CATEGORY = 'other-mandatory';
export const ONBOARDING_VARIABLE_CATEGORY = 'other-variable';

export async function listCategories(options: { includeArchived?: boolean } = {}): Promise<Category[]> {
  const all = await db.categories.toArray();
  const visible = options.includeArchived ? all : all.filter((category) => !category.archived);
  return visible.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listCategoriesOfKind(kind: Category['kind']): Promise<Category[]> {
  return (await listCategories()).filter((category) => category.kind === kind);
}

/** Creates the starter set once; categories the user already has are left alone. */
export async function seedDefaultCategories(): Promise<number> {
  const existing = new Set((await db.categories.toArray()).map((category) => category.id));
  const missing = DEFAULT_CATEGORIES.filter((category) => !existing.has(category.id)).map((category, index) =>
    parseOrThrow(
      categorySchema,
      { ...category, sortOrder: existing.size + index, archived: false },
      'Категория',
    ),
  );

  if (missing.length > 0) {
    await db.categories.bulkAdd(missing);
    publishAppEvent({ type: 'data-changed' });
  }

  return missing.length;
}

export async function createCategory(
  input: Omit<DefaultCategory, 'id'> & { id?: string },
): Promise<Category> {
  const existing = await db.categories.toArray();
  const name = input.name.trim().toLocaleLowerCase('ru');
  if (
    existing.some(
      (category) => category.kind === input.kind && category.name.toLocaleLowerCase('ru') === name,
    )
  ) {
    throw new RepositoryError('Такая категория уже есть. Если она в архиве, верните её.');
  }
  const count = existing.length;
  const category = parseOrThrow(
    categorySchema,
    { ...input, id: input.id ?? crypto.randomUUID(), sortOrder: count, archived: false },
    'Категория',
  );

  await db.categories.add(category);
  publishAppEvent({ type: 'data-changed' });
  return category;
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<Category> {
  const current = await db.categories.get(id);
  if (!current) throw new RepositoryError('Категория не найдена');

  const next = { ...current, archived };
  await db.categories.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}
