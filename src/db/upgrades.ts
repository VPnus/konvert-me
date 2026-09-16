/**
 * How a record kept by an older schema becomes one of the current schema. The upgrade of the
 * database and the import of an old backup go through the same functions, so a record comes out
 * the same whichever way it arrived.
 */

import { splitUsedBefore } from '@/core/deductions';
import { rulesForYear } from '@/core/rules';

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
      typeof record.year === 'number' ? rulesForYear(record.year) : undefined,
    );
    return { ...record, property: { ...property, ...parts } };
  } catch {
    return record;
  }
}
