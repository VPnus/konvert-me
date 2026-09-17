import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Suspense, lazy } from 'react';

import { goalProjection } from '@/core/goals';
import { formatForecast } from '@/core/money';
import type { IsoMonth } from '@/core/time';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { contributeToGoal } from '@/db/repositories/goals';
import { monthLabel } from '@/features/budget/month-label';
import { ContributeForm, EnvelopesPanel } from '@/features/goals/envelopes-panel';
import type { GoalsData, GoalView } from '@/features/goals/goals-data';
import { monthsLabel } from '@/features/goals/months-label';
import { WhatIfPanel } from '@/features/goals/what-if-panel';
import { strings } from '@/i18n';
import { percentLabel } from '@/i18n/format';

// The chart library is a chunk of its own: it is only needed once a goal is opened.
const GoalChart = lazy(() => import('@/features/goals/goal-chart'));

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={`truncate text-sm font-semibold tabular-nums ${muted ? 'text-muted-foreground' : ''}`}>
        {value}
      </p>
    </div>
  );
}

interface GoalDetailsProps {
  readonly view: GoalView;
  readonly data: GoalsData;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function GoalDetails({ view, data, open, onOpenChange }: GoalDetailsProps) {
  const { goal, plan } = view;

  const points =
    plan && plan.status === 'active' && goal.targetMonth
      ? goalProjection({
          costMinor: goal.costMinor,
          costAsOf: goal.costAsOf,
          targetMonth: goal.targetMonth as IsoMonth,
          returnRate: goal.returnRate,
          inflationRate: goal.inflationRate,
          currentMonth: data.month,
          savedMinor: view.savedMinor,
          contributionMinor: plan.contributionMinor,
        })
      : [];

  const monthly = plan?.contributionMinor ?? 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold">{goal.name}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {goal.targetMonth ? monthLabel(goal.targetMonth) : strings.goals.kinds.reserve}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label={strings.nav.close} className="rounded-md p-1 hover:bg-accent">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label={strings.goals.saved} value={formatForecast(view.savedMinor)} />
            <Figure label={strings.goals.costToday} value={formatForecast(view.costMinor)} />
            <Figure
              label={strings.goals.costFuture}
              value={plan ? formatForecast(plan.futureValueMinor) : '—'}
              muted={!plan}
            />
            <Figure
              label={strings.goals.contribution}
              value={plan ? formatForecast(monthly) : '—'}
              muted={!plan}
            />
            <Figure
              label={strings.goals.contributionYear}
              value={plan ? formatForecast(monthly * 12) : '—'}
              muted={!plan}
            />
            <Figure
              label={strings.goals.monthsLeft}
              value={plan ? monthsLabel(plan.months) : '—'}
              muted={!plan}
            />
            <Figure
              label={strings.goals.realReturn}
              value={percentLabel(Math.round(view.realReturnRate * 1000) / 10, 1)}
              muted
            />
          </div>

          {view.beatsInflation ? null : (
            <p className="mt-3 text-xs text-warning" data-testid="goal-inflation-warning">
              {strings.goals.returnBelowInflation}
            </p>
          )}

          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">{strings.goals.chartTitle}</h3>
            {points.length > 1 ? (
              // A chart that fails to load must not take the card down with it.
              <ErrorBoundary
                fallback={() => (
                  <p className="py-4 text-xs text-muted-foreground">{strings.goals.chartEmpty}</p>
                )}
              >
                <Suspense
                  fallback={<p className="py-6 text-xs text-muted-foreground">{strings.common.loading}</p>}
                >
                  <GoalChart points={points} />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <p className="py-4 text-xs text-muted-foreground">{strings.goals.chartEmpty}</p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-5 border-t border-border pt-4">
            <ContributeForm
              accounts={data.accounts}
              onContribute={(input) => contributeToGoal({ goalId: goal.id, ...input }).then(() => undefined)}
            />

            <EnvelopesPanel
              goalId={goal.id}
              envelopes={view.envelopes}
              accounts={data.accounts}
              balances={data.balances}
            />

            {goal.kind === 'reserve' ? null : (
              <div className="border-t border-border pt-4">
                <WhatIfPanel goal={goal} savedMinor={view.savedMinor} />
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm" data-testid="goal-details-close">
                {strings.nav.close}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
