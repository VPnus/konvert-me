import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarCheck } from 'lucide-react';

import { todayIso } from '@/core/time';
import { Notice } from '@/components/common/notice';
import { dismissReviewReminder, getFinancialPlan } from '@/db/repositories/financial-plan';
import { planReviewReminder } from '@/features/plan/review';
import { t } from '@/features/plan/plan-format';
import { useDataVersion } from '@/hooks/use-data-version';

const r = t.review.reminder;

/** Once a quarter and once a year: the plan is due for another look (lesson 2.7, step 8). */
export function PlanReviewReminderBanner() {
  const dataVersion = useDataVersion();
  // null while nothing is saved: undefined is the query still running.
  const plan = useLiveQuery(async () => (await getFinancialPlan()) ?? null, [dataVersion]);
  if (!plan) return null;

  const reminder = planReviewReminder(plan, todayIso());
  if (!reminder) return null;

  return (
    <Notice
      testId="plan-review-reminder"
      icon={CalendarCheck}
      tone="reminder"
      action={{ to: '/plan?step=8', label: r.action }}
      dismiss={{ label: r.dismiss, testId: 'plan-review-reminder-dismiss' }}
      onDismiss={() => void dismissReviewReminder(reminder.key)}
    >
      {r[reminder.kind]}
    </Notice>
  );
}
