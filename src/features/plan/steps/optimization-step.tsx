import { fill } from '@/i18n';
import { debtQueue, savingsBenchmark } from '@/features/plan/debts';
import type { PlanData } from '@/features/plan/plan-data';
import { debtAdvice, percentOf, rubles, t } from '@/features/plan/plan-format';
import { Muted, NoteCard, PlanCard } from '@/features/plan/plan-parts';

const o = t.optimization;

/** Step 5 of lesson 2.7: where the money for the goals can come from. */
export function OptimizationStep({ data }: { data: PlanData }) {
  const { overview, goals } = data;
  const benchmark = savingsBenchmark(overview.accounts, overview.balances, goals.settings.defaultReturnRate);
  const debts = debtQueue({
    accounts: overview.accounts,
    balances: overview.balances,
    cards: overview.cards,
    benchmark,
  });
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
          debts.map((debt) => {
            const advice = debtAdvice(debt, benchmark);
            return (
              <div
                key={debt.account.id}
                className="flex flex-col gap-0.5 text-sm"
                data-testid={`plan-debt-${debt.account.id}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{debt.account.name}</span>
                  <span className="shrink-0 tabular-nums">{rubles(debt.balanceMinor)}</span>
                </div>
                <span className="text-muted-foreground">
                  {debt.account.rate === undefined
                    ? o.noRate
                    : fill(o.rate, { rate: percentOf(debt.account.rate) })}
                </span>
                {advice ? (
                  <span className={debt.dear || debt.statement ? 'text-warning' : 'text-muted-foreground'}>
                    {advice}
                  </span>
                ) : null}
              </div>
            );
          })
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
