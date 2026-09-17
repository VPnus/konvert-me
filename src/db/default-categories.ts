/**
 * The starter set of categories. It follows the budget template of the course (lesson 2.9): income,
 * mandatory expenses, variable expenses. Kept apart from the repository, so the upgrades of the
 * schema can read it without importing the database.
 */

import type { Category } from '@/db/models';

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
  // Schema 8: a premium subscription of a bank, a fee for a card, a streaming service.
  { id: 'subscriptions', name: 'Подписки и комиссии', kind: 'expense', group: 'variable' },
];

/** The starter categories added after the first version: someone who began earlier gets them on upgrade. */
export const CATEGORIES_OF_SCHEMA_8: readonly string[] = ['subscriptions'];
