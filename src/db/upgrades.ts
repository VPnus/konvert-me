/**
 * How a record kept by an older schema becomes one of the current schema. The upgrade of the
 * database and the import of an old backup go through the same functions, so a record comes out
 * the same whichever way it arrived.
 */

import { splitUsedBefore } from '@/core/deductions';
import { rulesForYear } from '@/core/rules';
import { CATEGORIES_OF_SCHEMA_8, DEFAULT_CATEGORIES } from '@/db/default-categories';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Schema 7: what earlier returns took of a home is kept in two parts, the home itself and the
 * interest, instead of one sum. The sum is split the way the returns spent it. A year with no home,
 * or one already in two parts, is given back as it is; anything the split cannot read is given back
 * as it is too, for the schema to refuse on import rather than to break the upgrade of a database.
 */
export function upgradeDeductionYear(record: unknown): unknown {
  if (!isObject(record) || !isObject(record.property) || !('usedBeforeMinor' in record.property)) {
    return record;
  }

  const { usedBeforeMinor, ...property } = record.property;
  try {
    const parts = splitUsedBefore(
      {
        purchaseMinor: property.purchaseMinor as number,
        mortgageInterestMinor: property.mortgageInterestMinor as number,
        loanBefore2014: property.loanBefore2014 === true,
      },
      usedBeforeMinor as number,
      typeof record.year === 'number' ? rulesForYear('ru', record.year) : undefined,
    );
    return { ...record, property: { ...property, ...parts } };
  } catch {
    return record;
  }
}

interface StoredCategory {
  readonly id: string;
  readonly sortOrder: number;
}

/**
 * Schema 8: the starter categories added since, for someone who began earlier. Nothing is added to
 * a person with no categories at all: they have not been through the onboarding yet, it adds them all.
 */
export function categoriesOfSchema8<T extends StoredCategory>(existing: readonly T[]) {
  if (existing.length === 0) return [];
  const ids = new Set(existing.map((category) => category.id));
  let sortOrder = Math.max(...existing.map((category) => category.sortOrder)) + 1;
  return DEFAULT_CATEGORIES.filter(
    (category) => CATEGORIES_OF_SCHEMA_8.includes(category.id) && !ids.has(category.id),
  ).map((category) => ({ ...category, sortOrder: sortOrder++, archived: false }));
}

/**
 * Schema 10: a source of income that repeated on one day of a month now carries a schedule, since
 * a fortnightly pay fits no day of the month. A source already upgraded, and anything the upgrade
 * cannot read, is given back as it is: the schema refuses it on import instead of the upgrade breaking.
 */
export function upgradeIncomeSource(record: unknown): unknown {
  if (!isObject(record) || record.schedule !== undefined || typeof record.dayOfMonth !== 'number') {
    return record;
  }

  const { dayOfMonth, ...rest } = record;
  return { ...rest, schedule: { kind: 'monthly', dayOfMonth } };
}
