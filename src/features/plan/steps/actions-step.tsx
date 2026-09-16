import { useState } from 'react';
import { Link } from 'react-router-dom';

import { setPlanActionDone } from '@/db/repositories/financial-plan';
import { fill } from '@/features/deductions/fill';
import type { PlanData } from '@/features/plan/plan-data';
import { actionText, t } from '@/features/plan/plan-format';
import { Muted, PlanCard } from '@/features/plan/plan-parts';

const a = t.actions;

/** Step 7 of lesson 2.7: what to do for the plan to work, ticked off one by one. */
export function ActionsStep({ data }: { data: PlanData }) {
  // A tick shows at once: the saved list catches up a moment later with the same answer.
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const saved = new Set(data.plan.doneActions);
  const isDone = (key: string) => ticked[key] ?? saved.has(key);
  const doneCount = data.actions.filter((action) => isDone(action.key)).length;

  const tick = async (key: string, done: boolean) => {
    setTicked((current) => ({ ...current, [key]: done }));
    try {
      await setPlanActionDone(key, done);
    } catch {
      // Not saved: show what is stored again.
      setTicked(({ [key]: _dropped, ...rest }) => rest);
    }
  };

  return (
    <PlanCard title={a.title} testId="plan-actions">
      <Muted testId="plan-actions-progress">
        {fill(a.progress, { done: doneCount, total: data.actions.length })}
      </Muted>
      <ul className="flex flex-col gap-2">
        {data.actions.map((action) => (
          <li key={action.key} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              id={`action-${action.key}`}
              className="mt-0.5 size-4 shrink-0"
              checked={isDone(action.key)}
              data-testid={`action-${action.key}`}
              onChange={(event) => void tick(action.key, event.target.checked)}
            />
            <label htmlFor={`action-${action.key}`} className="min-w-0 flex-1">
              {actionText(action)}
            </label>
            <Link to={action.to} className="shrink-0 text-muted-foreground underline underline-offset-2">
              {t.open}
            </Link>
          </li>
        ))}
      </ul>
    </PlanCard>
  );
}
