import { monthsBetween } from '@/core/time';
import {
  ASSET_CLASSES,
  RISK_PROFILES,
  horizonBand,
  splitByClasses,
  strategicAllocation,
  type RiskProfile,
} from '@/core/portfolio';
import { Button } from '@/components/ui/button';
import { setRiskProfile } from '@/db/repositories/financial-plan';
import { RESERVE_GOAL_ID } from '@/db/repositories/goals';
import type { PlanData } from '@/features/plan/plan-data';
import { rubles, t } from '@/features/plan/plan-format';
import { Muted, PlanCard } from '@/features/plan/plan-parts';
import { fill, strings } from '@/i18n';

const s = t.strategy;

/** Step 6 of lesson 2.7: a teaching example of the classes of assets for each goal. */
export function StrategyStep({ data }: { data: PlanData }) {
  const profile = data.plan.riskProfile;
  const month = data.goals.month;
  const goals = data.goals.goals.filter(
    (view) => view.goal.id !== RESERVE_GOAL_ID && view.goal.status === 'active' && view.goal.targetMonth,
  );

  return (
    <div className="flex flex-col gap-4">
      <PlanCard title={s.riskTitle}>
        <Muted>{s.riskLead}</Muted>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={s.riskTitle}>
          {RISK_PROFILES.map((option: RiskProfile) => (
            <Button
              key={option}
              role="radio"
              aria-checked={profile === option}
              variant={profile === option ? 'default' : 'outline'}
              className="h-auto flex-col items-start gap-1 px-3 py-2 text-left whitespace-normal"
              data-testid={`risk-${option}`}
              onClick={() => void setRiskProfile(option)}
            >
              <span className="text-sm font-semibold">{s.profiles[option].title}</span>
              <span className="text-xs font-normal opacity-80">{s.profiles[option].text}</span>
            </Button>
          ))}
        </div>
      </PlanCard>

      <PlanCard title={s.goalsTitle} testId="plan-allocations">
        <Muted>{s.reserve}</Muted>
        {!profile ? (
          <Muted>{s.choose}</Muted>
        ) : goals.length === 0 ? (
          <Muted>{s.noGoals}</Muted>
        ) : (
          goals.map((view) => {
            const months = monthsBetween(month, view.goal.targetMonth as string);
            const shares = strategicAllocation(months, profile);
            const contribution = view.plan?.status === 'active' ? view.plan.contributionMinor : 0;
            const parts = splitByClasses(Math.round(contribution), shares);

            return (
              <div
                key={view.goal.id}
                className="flex flex-col gap-2 border-t border-border pt-3 first:border-0 first:pt-0"
                data-testid={`allocation-${view.goal.id}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{view.goal.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {fill(s.goalTerm, { term: s.horizon[horizonBand(months)] })}
                  </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                  {ASSET_CLASSES.map((asset, index) => (
                    <div
                      key={asset}
                      className="h-full bg-primary"
                      style={{ width: `${shares[asset]}%`, opacity: 1 - index * 0.22 }}
                    />
                  ))}
                </div>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {ASSET_CLASSES.filter((asset) => shares[asset] > 0).map((asset) => (
                    <li key={asset} className="flex justify-between gap-3 tabular-nums">
                      <span>
                        {s.classes[asset]} — {shares[asset].toLocaleString('ru-RU')} %
                      </span>
                      {contribution > 0 ? (
                        <span className="text-muted-foreground">{rubles(parts[asset])}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {contribution > 0 ? (
                  <Muted>{fill(s.ofContribution, { amount: rubles(contribution) })}</Muted>
                ) : null}
              </div>
            );
          })
        )}
        <Muted>{s.rebalance}</Muted>
      </PlanCard>

      <p className="text-xs text-muted-foreground" data-testid="plan-disclaimer">
        {s.example} {strings.app.disclaimer}
      </p>
    </div>
  );
}
