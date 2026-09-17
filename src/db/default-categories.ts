/**
 * The starter set of categories. It follows the budget template of the course (lesson 2.9): income,
 * mandatory expenses, variable expenses. Kept apart from the repository, so the upgrades of the
 * schema can read it without importing the database.
 */

import type { Category } from '@/db/models';
import { strings } from '@/i18n';

export interface DefaultCategory {
  readonly id: string;
  readonly name: string;
  readonly kind: Category['kind'];
  readonly group?: Category['group'];
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { id: 'salary', name: strings.defaults.categories.salary, kind: 'income' },
  { id: 'advance', name: strings.defaults.categories.advance, kind: 'income' },
  { id: 'bonus', name: strings.defaults.categories.bonus, kind: 'income' },
  { id: 'side-income', name: strings.defaults.categories['side-income'], kind: 'income' },
  { id: 'interest', name: strings.defaults.categories.interest, kind: 'income' },
  { id: 'other-income', name: strings.defaults.categories['other-income'], kind: 'income' },

  { id: 'housing', name: strings.defaults.categories.housing, kind: 'expense', group: 'mandatory' },
  { id: 'groceries', name: strings.defaults.categories.groceries, kind: 'expense', group: 'mandatory' },
  { id: 'transport', name: strings.defaults.categories.transport, kind: 'expense', group: 'mandatory' },
  {
    id: 'communication',
    name: strings.defaults.categories.communication,
    kind: 'expense',
    group: 'mandatory',
  },
  {
    id: 'loan-interest',
    name: strings.defaults.categories['loan-interest'],
    kind: 'expense',
    group: 'mandatory',
  },
  { id: 'health', name: strings.defaults.categories.health, kind: 'expense', group: 'mandatory' },
  { id: 'children', name: strings.defaults.categories.children, kind: 'expense', group: 'mandatory' },
  { id: 'insurance', name: strings.defaults.categories.insurance, kind: 'expense', group: 'mandatory' },
  {
    id: 'other-mandatory',
    name: strings.defaults.categories['other-mandatory'],
    kind: 'expense',
    group: 'mandatory',
  },

  { id: 'cafe', name: strings.defaults.categories.cafe, kind: 'expense', group: 'variable' },
  { id: 'clothes', name: strings.defaults.categories.clothes, kind: 'expense', group: 'variable' },
  { id: 'fun', name: strings.defaults.categories.fun, kind: 'expense', group: 'variable' },
  { id: 'gifts', name: strings.defaults.categories.gifts, kind: 'expense', group: 'variable' },
  { id: 'travel', name: strings.defaults.categories.travel, kind: 'expense', group: 'variable' },
  {
    id: 'other-variable',
    name: strings.defaults.categories['other-variable'],
    kind: 'expense',
    group: 'variable',
  },
  // Schema 8: a premium subscription of a bank, a fee for a card, a streaming service.
  {
    id: 'subscriptions',
    name: strings.defaults.categories.subscriptions,
    kind: 'expense',
    group: 'variable',
  },
];

/** The starter categories added after the first version: someone who began earlier gets them on upgrade. */
export const CATEGORIES_OF_SCHEMA_8: readonly string[] = ['subscriptions'];
