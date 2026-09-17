import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock } from 'lucide-react';

import { formatMinor } from '@/core/money';
import { todayIso } from '@/core/time';
import { Notice } from '@/components/common/notice';
import { listDeductionYears } from '@/db/repositories/deductions';
import { updateSettings } from '@/db/repositories/settings';
import { dateOfYear } from '@/features/deductions/dates';
import { deductionReminder, reminderKey, type DeductionReminder } from '@/features/deductions/reminder';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettingsState } from '@/hooks/use-settings';
import { fill, strings } from '@/i18n';

const t = strings.deductions.reminder;

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
    <Notice
      testId="deduction-reminder"
      icon={CalendarClock}
      tone="reminder"
      action={{ to: '/deductions', label: t.action }}
      dismiss={{ label: t.dismiss, testId: 'deduction-reminder-dismiss' }}
      onDismiss={() => void updateSettings({ deductionReminderDismissed: reminderKey(reminder) })}
    >
      {textOf(reminder)}
    </Notice>
  );
}
