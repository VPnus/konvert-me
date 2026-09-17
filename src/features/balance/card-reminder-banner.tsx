import { useLiveQuery } from 'dexie-react-hooks';
import { CreditCard } from 'lucide-react';

import { Notice } from '@/components/common/notice';
import { todayIso } from '@/core/time';
import { updateSettings } from '@/db/repositories/settings';
import {
  cardReminder,
  isWarning,
  loadCards,
  reminderText,
  withDismissed,
} from '@/features/balance/card-reminder';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettingsState } from '@/hooks/use-settings';
import { strings } from '@/i18n';

const t = strings.cards.reminder;

/** A week and a day before a statement is due, and after the due day if it was not paid in full. */
export function CardReminderBanner() {
  const dataVersion = useDataVersion();
  const today = todayIso();
  const cards = useLiveQuery(() => loadCards(today), [dataVersion, today]);
  const { settings, loading } = useSettingsState();
  if (loading || !cards) return null;

  const reminder = cardReminder(today, cards, settings.cardRemindersDismissed);
  if (!reminder) return null;
  const lost = isWarning(reminder);

  return (
    <Notice
      testId="card-reminder"
      kind={reminder.kind}
      icon={CreditCard}
      tone={lost ? 'warning' : 'reminder'}
      action={
        reminder.kind === 'grace-ended'
          ? { to: '/balance', label: t.open }
          : { to: '/budget', label: t.record }
      }
      dismiss={{ label: t.dismiss, testId: 'card-reminder-dismiss' }}
      onDismiss={() =>
        void updateSettings({
          cardRemindersDismissed: withDismissed(settings.cardRemindersDismissed, reminder.key),
        })
      }
    >
      {reminderText(reminder, today)}
    </Notice>
  );
}
