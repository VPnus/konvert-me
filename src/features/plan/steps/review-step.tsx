import { Button } from '@/components/ui/button';
import { markPlanReviewed } from '@/db/repositories/financial-plan';
import { fill } from '@/features/deductions/fill';
import type { PlanData } from '@/features/plan/plan-data';
import { dateInText, t } from '@/features/plan/plan-format';
import { Muted, PlanCard } from '@/features/plan/plan-parts';

const r = t.review;

/** Step 8 of lesson 2.7: the results once a quarter, the plan against life once a year. */
export function ReviewStep({ data }: { data: PlanData }) {
  const { plan, review, started } = data;

  return (
    <PlanCard title={r.title} testId="plan-review">
      {!started ? (
        <Muted>{t.notStarted}</Muted>
      ) : (
        <Muted>{fill(r.startedOn, { date: dateInText(plan.startedOn) })}</Muted>
      )}

      {review.due ? (
        <p className="font-medium text-warning" data-testid="plan-review-due">
          {r.due[review.due]}
        </p>
      ) : null}

      <div className="flex flex-col gap-1 text-sm">
        <span data-testid="plan-next-quarterly">
          {fill(r.nextQuarterly, { date: dateInText(review.nextQuarterly) })}
        </span>
        <span data-testid="plan-next-yearly">
          {fill(r.nextYearly, { date: dateInText(review.nextYearly) })}
        </span>
      </div>

      <Muted>{r.quarterlyLead}</Muted>
      <Muted>{r.yearlyLead}</Muted>
      <Muted>{r.alsoWhen}</Muted>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          data-testid="review-quarterly"
          onClick={() => void markPlanReviewed('quarterly')}
        >
          {r.markQuarterly}
        </Button>
        <Button
          size="sm"
          variant="outline"
          data-testid="review-yearly"
          onClick={() => void markPlanReviewed('yearly')}
        >
          {r.markYearly}
        </Button>
      </div>

      {plan.quarterlyReviewedOn ? (
        <Muted>{fill(r.lastQuarterly, { date: dateInText(plan.quarterlyReviewedOn) })}</Muted>
      ) : null}
      {plan.yearlyReviewedOn ? (
        <Muted>{fill(r.lastYearly, { date: dateInText(plan.yearlyReviewedOn) })}</Muted>
      ) : null}
    </PlanCard>
  );
}
