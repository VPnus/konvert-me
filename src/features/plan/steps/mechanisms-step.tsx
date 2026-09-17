import { fill } from '@/i18n';
import type { PlanData } from '@/features/plan/plan-data';
import { rubles, t } from '@/features/plan/plan-format';
import { Muted, NoteCard, PlanCard, Row } from '@/features/plan/plan-parts';

const m = t.mechanisms;

/** Step 3 of lesson 2.7: the goals against what the budget can give them. */
export function MechanismsStep({ data }: { data: PlanData }) {
  const { goals } = data;
  const names = new Map(goals.goals.map((view) => [view.goal.id, view.goal.name]));
  const neededMinor = goals.allocations.reduce((total, allocation) => total + allocation.requiredMinor, 0);

  return (
    <div className="flex flex-col gap-4">
      <PlanCard title={m.title} link={{ to: '/goals', label: t.goals.manage }} testId="plan-mechanisms">
        <Row label={m.free} value={rubles(goals.freeCashMinor)} testId="plan-free" />
        {goals.principalDueMinor > 0 ? (
          <>
            <Row label={m.principal} value={rubles(goals.principalDueMinor)} testId="plan-principal" />
            <Row label={m.available} value={rubles(goals.availableMinor)} strong testId="plan-available" />
          </>
        ) : null}
        <Row label={m.needed} value={rubles(neededMinor)} testId="plan-needed" />

        {goals.allocations.length === 0 ? (
          <Muted>{m.noGoals}</Muted>
        ) : (
          <>
            <p className="font-medium" data-testid="plan-enough">
              {goals.totalDeficitMinor > 0
                ? fill(m.short, { amount: rubles(goals.totalDeficitMinor) })
                : fill(m.enough, { amount: rubles(goals.leftoverMinor) })}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-normal">{m.goal}</th>
                    <th className="py-1 pr-3 text-right font-normal">{m.needs}</th>
                    <th className="py-1 text-right font-normal">{m.gets}</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.allocations.map((allocation) => (
                    <tr key={allocation.goalId}>
                      <td className="py-1 pr-3">{names.get(allocation.goalId)}</td>
                      <td className="py-1 pr-3 text-right">{rubles(allocation.requiredMinor)}</td>
                      <td
                        className={
                          allocation.deficitMinor > 0 ? 'py-1 text-right text-destructive' : 'py-1 text-right'
                        }
                      >
                        {rubles(allocation.allocatedMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PlanCard>

      <PlanCard title={m.tipsTitle}>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {m.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </PlanCard>

      <NoteCard name="mechanisms" value={data.plan.notes.mechanisms} />
    </div>
  );
}
