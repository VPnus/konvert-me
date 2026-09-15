/**
 * Categories. The starter set follows the budget template of the course (lesson 2.9):
 * income, mandatory expenses, variable expenses.
 */

import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { categorySchema, type Category } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export interface DefaultCategory {
  readonly id: string;
  readonly name: string;
  readonly kind: Category['kind'];
  readonly group?: Category['group'];
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { id: 'salary', name: 'Зарплата', kind: 'income' },
  { id: 'advance', name: 'Аванс', kind: 'income' },
  { id: 'bonus', name: 'Премия', kind: 'income' },
  { id: 'side-income', name: 'Подработка', kind: 'income' },
  { id: 'interest', name: 'Проценты и дивиденды', kind: 'income' },
  { id: 'other-income', name: 'Прочие доходы', kind: 'income' },

  { id: 'housing', name: 'Жильё и ЖКУ', kind: 'expense', group: 'mandatory' },
  { id: 'groceries', name: 'Продукты', kind: 'expense', group: 'mandatory' },
  { id: 'transport', name: 'Транспорт', kind: 'expense', group: 'mandatory' },
  { id: 'communication', name: 'Связь и интернет', kind: 'expense', group: 'mandatory' },
  { id: 'loan-interest', name: 'Проценты по кредитам', kind: 'expense', group: 'mandatory' },
  { id: 'health', name: 'Здоровье', kind: 'expense', group: 'mandatory' },
  { id: 'children', name: 'Дети', kind: 'expense', group: 'mandatory' },
  { id: 'insurance', name: 'Страхование', kind: 'expense', group: 'mandatory' },
  { id: 'other-mandatory', name: 'Прочие обязательные', kind: 'expense', group: 'mandatory' },

  { id: 'cafe', name: 'Кафе и рестораны', kind: 'expense', group: 'variable' },
  { id: 'clothes', name: 'Одежда', kind: 'expense', group: 'variable' },
  { id: 'fun', name: 'Развлечения', kind: 'expense', group: 'variable' },
  { id: 'gifts', name: 'Подарки', kind: 'expense', group: 'variable' },
  { id: 'travel', name: 'Путешествия', kind: 'expense', group: 'variable' },
  { id: 'other-variable', name: 'Прочие переменные', kind: 'expense', group: 'variable' },
];

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
  const count = await db.categories.count();
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
