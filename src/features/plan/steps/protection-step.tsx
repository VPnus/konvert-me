import { recommendedReserveContributionMinor } from '@/core/balance';
import type { InsurancePolicy } from '@/db/models';
import { fill } from '@/features/deductions/fill';
import { monthsLabel } from '@/features/goals/months-label';
import type { PlanData } from '@/features/plan/plan-data';
import { rubles, t } from '@/features/plan/plan-format';
import { Muted, NoteCard, PlanCard, Row } from '@/features/plan/plan-parts';

const p = t.protection;

/** The three kinds of risk of lesson 2.6 that insurance covers, and the policies that do. */
const RISKS: readonly { key: keyof typeof p.risks; types: readonly InsurancePolicy['type'][] }[] = [
  { key: 'life', types: ['life', 'health'] },
  { key: 'property', types: ['property', 'vehicle'] },
  // Third-party liability has no type of its own: the list says what to look for instead.
  { key: 'liability', types: [] },
];

/** Step 4 of lesson 2.7: the reserve and the insurance, the foundation of the plan. */
export function ProtectionStep({ data }: { data: PlanData }) {
  const reserve = data.goals.reserve;
  const settings = data.goals.settings;
  const shortMinor =
    reserve.targetMinor === null ? 0 : Math.max(reserve.targetMinor - reserve.reserveMinor, 0);

  return (
    <div className="flex flex-col gap-4">
      <PlanCard title={p.reserveTitle} link={{ to: '/goals', label: t.goals.manage }} testId="plan-reserve">
        <Row label={p.reserveNow} value={rubles(reserve.reserveMinor)} />
        {reserve.targetMinor === null ? (
          <Muted>{p.reserveUnknown}</Muted>
        ) : (
          <>
            <Row
              label={fill(p.reserveTarget, { months: monthsLabel(settings.reserveTargetMonths) })}
              value={rubles(reserve.targetMinor)}
            />
            {shortMinor > 0 ? (
              <>
                <Row label={p.reserveShort} value={rubles(shortMinor)} strong testId="plan-reserve-short" />
                <Row
                  label={p.reserveContribution}
                  value={rubles(recommendedReserveContributionMinor(data.budget.incomeMinor))}
                />
                <Muted>{p.reserveContributionHint}</Muted>
              </>
            ) : (
              <p className="font-medium">{p.reserveDone}</p>
            )}
          </>
        )}
        <Muted>{p.reserveWhere}</Muted>
      </PlanCard>

      <PlanCard title={p.insuranceTitle} link={{ to: '/balance', label: p.manage }} testId="plan-insurance">
        <Muted>{p.insuranceLead}</Muted>
        {RISKS.map((risk) => {
          const policies = data.policies.filter((policy) => risk.types.includes(policy.type));
          return (
            <div
              key={risk.key}
              className="flex flex-col gap-0.5 text-sm"
              data-testid={`plan-risk-${risk.key}`}
            >
              <span className="font-medium">{p.risks[risk.key]}</span>
              <span className="text-muted-foreground">
                {policies.length > 0
                  ? fill(p.covered, { names: policies.map((policy) => policy.name).join(', ') })
                  : risk.key === 'liability'
                    ? p.liabilityHint
                    : p.notCovered}
              </span>
            </div>
          );
        })}
      </PlanCard>

      <NoteCard key={data.plan.notes.protection} name="protection" value={data.plan.notes.protection} />
    </div>
  );
}
