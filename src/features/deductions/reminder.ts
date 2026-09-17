/**
 * The reminder that a year has ended and its return can be filed. Plan, stage 7: "напоминание
 * в январе". It says something only when there is something to say.
 */

import { summarizeDeductionYear } from '@/core/deductions';
import { latestRules, rulesForYear, type MonthDay } from '@/core/rules';
import type { IsoDate } from '@/core/time';
import type { DeductionYear } from '@/db/models';
import { toDeductionClaim } from '@/db/repositories/deductions';

export type DeductionReminder =
  /** January, and nothing written for the year that ended: worth a look. */
  | { readonly kind: 'start'; readonly year: number }
  /** A year written, not filed yet, and money to come back. */
  | { readonly kind: 'refund'; readonly year: number; readonly amountMinor: number }
  /** A home sold: the return is not a choice, and it has a day. */
  | { readonly kind: 'sale'; readonly year: number; readonly fileBy: MonthDay };

/** What hiding a reminder remembers: the year and the kind, so hiding one never hides another. */
export function reminderKey(reminder: DeductionReminder): string {
  return `${reminder.year}:${reminder.kind}`;
}

/**
 * What to remind of on a given day, if anything. Only the year that has just ended counts: the
 * reminder is about this spring's return. Hidden, it keeps quiet until the next year — unless
 * something of another kind comes up, such as a sale written after the January look was hidden.
 */
export function deductionReminder(
  today: IsoDate,
  saved: readonly DeductionYear[],
  dismissed: string | null,
): DeductionReminder | null {
  const reminder = reminderFor(today, saved);
  return reminder && reminderKey(reminder) !== dismissed ? reminder : null;
}

function reminderFor(today: IsoDate, saved: readonly DeductionYear[]): DeductionReminder | null {
  const year = Number(today.slice(0, 4)) - 1;

  const rules = rulesForYear('ru', year) ?? latestRules('ru');
  const fileBy = rules.declarationDeadline.value;
  if (today > `${year + 1}-${fileBy}`) return null;

  const record = saved.find((item) => item.year === year);
  if (!record) return today.slice(5, 7) === '01' ? { kind: 'start', year } : null;
  if (record.status !== 'draft') return null;

  const own = rulesForYear('ru', year);
  if (!own) return null;
  const summary = summarizeDeductionYear(toDeductionClaim(record), own);

  if (summary.sale?.declarationRequired) return { kind: 'sale', year, fileBy };
  if (summary.balanceMinor > 0) return { kind: 'refund', year, amountMinor: summary.balanceMinor };
  return null;
}
