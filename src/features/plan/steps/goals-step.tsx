import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { RESERVE_GOAL_ID } from '@/db/repositories/goals';
import { fill } from '@/features/deductions/fill';
import type { GoalView } from '@/features/goals/goals-data';
import { EducationCard } from '@/features/plan/education-card';
import { PensionCard } from '@/features/plan/pension-card';
import type { PlanData } from '@/features/plan/plan-data';
import { monthInText, rubles, t } from '@/features/plan/plan-format';
import { Muted, PlanCard, Row } from '@/features/plan/plan-parts';

const g = t.goals;

function goalState(view: GoalView): string {
  if (view.goal.id === RESERVE_GOAL_ID) return g.reserve;
  if (view.goal.status === 'paused') return g.paused;
  if (view.plan?.status === 'funded') return g.funded;
  if (view.plan?.status === 'overdue') return g.overdue;
  return fill(g.perMonth, { amount: rubles(view.plan?.contributionMinor ?? 0) });
}

function Section({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Muted>{lead}</Muted>
      </div>
      {children}
    </section>
  );
}

/** Step 2 of lesson 2.7: the goals, and the two that need a calculation of their own. */
export function GoalsStep({ data }: { data: PlanData }) {
  const [adding, setAdding] = useState(false);
  const goals = data.goals.goals.filter((view) => view.goal.status !== 'done');
  const settings = data.goals.settings;
  const goalName = (goalId: string | null) =>
    goalId ? data.goals.goals.find((view) => view.goal.id === goalId)?.goal.name : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PlanCard title={g.title} link={{ to: '/goals', label: g.manage }} testId="plan-goals">
        {goals.length === 0 ? (
          <Muted>{g.empty}</Muted>
        ) : (
          goals.map((view) => (
            <Row
              key={view.goal.id}
              label={
                view.goal.targetMonth
                  ? `${view.goal.name}, ${fill(g.by, { month: monthInText(view.goal.targetMonth) })}`
                  : view.goal.name
              }
              value={goalState(view)}
              testId={`plan-goal-${view.goal.id}`}
            />
          ))
        )}
      </PlanCard>

      <Section title={t.education.title} lead={t.education.lead}>
        {data.education.map((view) => (
          <EducationCard
            key={view.item.id}
            item={view.item}
            savedMinor={view.savedMinor}
            goalName={goalName(view.item.goalId)}
            settings={settings}
          />
        ))}
        {adding ? (
          <EducationCard savedMinor={0} settings={settings} onDone={() => setAdding(false)} />
        ) : (
          <Button
            variant="outline"
            className="w-fit"
            data-testid="education-add"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" aria-hidden />
            {t.education.add}
          </Button>
        )}
      </Section>

      <Section title={t.pension.title} lead={t.pension.lead}>
        <PensionCard
          pension={data.plan.pension}
          savedMinor={data.pension?.savedMinor ?? 0}
          goalName={goalName(data.plan.pension?.goalId ?? null)}
          settings={settings}
          averageExpensesMinor={data.overview.averageExpenses.valueMinor}
        />
      </Section>
    </div>
  );
}
