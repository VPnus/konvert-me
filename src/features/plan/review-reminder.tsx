import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { todayIso } from '@/core/time';
import { Button, buttonVariants } from '@/components/ui/button';
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
    <div
      role="status"
      data-testid="plan-review-reminder"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
    >
      <CalendarCheck className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 basis-64">{r[reminder.kind]}</span>
      <div className="flex gap-2">
        <Link to="/plan?step=8" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          {r.action}
        </Link>
        <Button
          size="sm"
          variant="ghost"
          data-testid="plan-review-reminder-dismiss"
          onClick={() => void dismissReviewReminder(reminder.key)}
        >
          {r.dismiss}
        </Button>
      </div>
    </div>
  );
}
