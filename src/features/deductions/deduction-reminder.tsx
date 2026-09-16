import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatMinor } from '@/core/money';
import { todayIso } from '@/core/time';
import { Button, buttonVariants } from '@/components/ui/button';
import { listDeductionYears } from '@/db/repositories/deductions';
import { updateSettings } from '@/db/repositories/settings';
import { dateOfYear } from '@/features/deductions/dates';
import { fill } from '@/features/deductions/fill';
import { deductionReminder, reminderKey, type DeductionReminder } from '@/features/deductions/reminder';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettingsState } from '@/hooks/use-settings';
import { ru } from '@/i18n/ru';

const t = ru.deductions.reminder;

function textOf(reminder: DeductionReminder): string {
  switch (reminder.kind) {
    case 'start':
      return fill(t.start, { year: reminder.year });
    case 'refund':
      return fill(t.refund, {
        year: reminder.year,
        amount: formatMinor(reminder.amountMinor, { fractionDigits: 0 }),
      });
    case 'sale':
      return fill(t.sale, { year: reminder.year, date: dateOfYear(reminder.fileBy, reminder.year + 1) });
  }
}

/** From January to the day returns are due: the year that ended, if there is something to do about it. */
export function DeductionReminderBanner() {
  const dataVersion = useDataVersion();
  const years = useLiveQuery(() => listDeductionYears(), [dataVersion]);
  const { settings, loading } = useSettingsState();
  if (loading || !years) return null;

  const reminder = deductionReminder(todayIso(), years, settings.deductionReminderDismissed);
  if (!reminder) return null;

  return (
    <div
      role="status"
      data-testid="deduction-reminder"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
    >
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{textOf(reminder)}</span>
      <div className="flex gap-2">
        <Link to="/deductions" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          {t.action}
        </Link>
        <Button
          size="sm"
          variant="ghost"
          data-testid="deduction-reminder-dismiss"
          onClick={() => void updateSettings({ deductionReminderDismissed: reminderKey(reminder) })}
        >
          {t.dismiss}
        </Button>
      </div>
    </div>
  );
}
