import { fill } from '@/features/deductions/fill';
import type { PlanData } from '@/features/plan/plan-data';
import { percentOf, rubles, t } from '@/features/plan/plan-format';
import { Muted, NoteCard, PlanCard } from '@/features/plan/plan-parts';

const o = t.optimization;

/** Step 5 of lesson 2.7: where the money for the goals can come from. */
export function OptimizationStep({ data }: { data: PlanData }) {
  const { overview, goals } = data;
  const returnRate = goals.settings.defaultReturnRate;
  const debts = overview.accounts
    .filter((account) => account.side === 'liability' && !account.archived)
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  const reserve = goals.reserve;
  const idleMinor =
    reserve.targetMinor === null ? 0 : Math.max(reserve.reserveMinor - reserve.targetMinor, 0);

  return (
    <div className="flex flex-col gap-4">
      <PlanCard title={o.budgetTitle} link={{ to: '/budget', label: o.openBudget }}>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {o.budgetTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </PlanCard>

      <PlanCard title={o.debtsTitle} testId="plan-debts">
        {debts.length === 0 ? (
          <Muted>{o.noDebts}</Muted>
        ) : (
          debts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col gap-0.5 text-sm"
              data-testid={`plan-debt-${account.id}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{account.name}</span>
                <span className="shrink-0 tabular-nums">
                  {rubles(overview.balances.get(account.id) ?? 0)}
                </span>
              </div>
              <span className="text-muted-foreground">
                {account.rate === undefined ? o.noRate : fill(o.rate, { rate: percentOf(account.rate) })}
              </span>
              {account.rate !== undefined && account.rate > returnRate ? (
                <span className="text-warning">{fill(o.dear, { rate: percentOf(returnRate) })}</span>
              ) : null}
            </div>
          ))
        )}
      </PlanCard>

      <PlanCard title={o.idleTitle}>
        <Muted testId="plan-idle">
          {idleMinor > 0 ? fill(o.idle, { amount: rubles(idleMinor) }) : o.noIdle}
        </Muted>
      </PlanCard>

      <NoteCard name="optimization" value={data.plan.notes.optimization} />
    </div>
  );
}
