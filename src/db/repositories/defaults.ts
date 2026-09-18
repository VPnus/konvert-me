/**
 * The names the app wrote itself follow the language of the page. A starter category, the account
 * the introduction opened and the goal of the emergency fund are named from the dictionary; once
 * the person renames one, the name is theirs and nothing here touches it again.
 */

import { db } from '@/db/db';
import { defaultCategoriesFor } from '@/db/default-categories';
import type { DefaultNameKey } from '@/db/models';
import { strings } from '@/i18n';
import { currentCountry } from '@/i18n/country';
import { publishAppEvent } from '@/lib/broadcast';

/** What the dictionary of the page calls each name the app writes itself. */
export function defaultNameOf(key: DefaultNameKey): string {
  return strings.defaults[key];
}

interface Renamed {
  readonly id: string;
  readonly name: string;
  readonly defaultName: string;
}

function renameOf<T extends { id: string; name: string; defaultName?: string }>(
  rows: readonly T[],
  nameOf: (row: T) => string | undefined,
): Renamed[] {
  return rows.flatMap((row) => {
    const wanted = nameOf(row);
    // Renamed by the person, or already in the language of the page: leave it alone.
    if (!wanted || row.defaultName === undefined || row.name !== row.defaultName) return [];
    return wanted === row.name ? [] : [{ id: row.id, name: wanted, defaultName: wanted }];
  });
}

/**
 * Renames what still carries the name of another language. Runs when the app opens, so a language
 * chosen in the settings reaches the categories, the accounts and the goal of the emergency fund.
 */
export async function retranslateDefaults(): Promise<number> {
  const [categories, accounts, goals] = await Promise.all([
    db.categories.toArray(),
    db.accounts.toArray(),
    db.goals.toArray(),
  ]);

  const byId = new Map(defaultCategoriesFor(currentCountry()).map((category) => [category.id, category]));
  const categoryRenames = renameOf(categories, (category) => byId.get(category.id)?.name);
  const accountRenames = renameOf(accounts, (account) =>
    account.defaultKey ? defaultNameOf(account.defaultKey) : undefined,
  );
  const goalRenames = renameOf(goals, (goal) =>
    goal.defaultKey ? defaultNameOf(goal.defaultKey) : undefined,
  );

  const total = categoryRenames.length + accountRenames.length + goalRenames.length;
  if (total === 0) return 0;

  await db.transaction('rw', [db.categories, db.accounts, db.goals], async () => {
    for (const row of categoryRenames) await db.categories.update(row.id, { ...row });
    for (const row of accountRenames) await db.accounts.update(row.id, { ...row });
    for (const row of goalRenames) await db.goals.update(row.id, { ...row });
  });

  publishAppEvent({ type: 'data-changed' });
  return total;
}
