import { MessageSquareHeart } from 'lucide-react';

import { SITE } from '@/app/site';
import { Notice } from '@/components/common/notice';
import { todayIso } from '@/core/time';
import { PILOT_CARD_ID } from '@/features/settings/pilot-stats';
import { useUsage } from '@/hooks/use-usage';
import { strings } from '@/i18n';
import { dueMilestone, recordShared } from '@/lib/usage';

/**
 * A week and a month after the first day, the two moments the pilot measures, the app asks to share
 * how it went. It asks only someone who came back on their own, so the asking does not make the return.
 */
export function PilotReminderBanner() {
  const usage = useUsage();
  const milestone = SITE.pilotActive ? dueMilestone(usage, todayIso()) : null;
  if (milestone === null) return null;

  return (
    <Notice
      testId="pilot-reminder"
      icon={MessageSquareHeart}
      tone="reminder"
      kind={`day-${milestone}`}
      action={{ to: `/settings#${PILOT_CARD_ID}`, label: strings.pilotReminder.action }}
      dismiss={{ label: strings.pilotReminder.dismiss, testId: 'pilot-reminder-dismiss' }}
      onDismiss={() => recordShared()}
    >
      {milestone >= 30 ? strings.pilotReminder.month : strings.pilotReminder.week}
    </Notice>
  );
}
