import { useState } from 'react';

import {
  futureValueMinor,
  monthlyContribution,
  monthsToGoal,
  realReturnRate,
  returnBeatsInflation,
} from '@/core/goals';
import { formatForecast, minorToRubles, rublesToMinor } from '@/core/money';
import { addMonths, currentMonth, monthsBetween } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { Goal } from '@/db/models';
import { updateGoal } from '@/db/repositories/goals';
import { monthLabel } from '@/features/budget/month-label';
import { monthsLabel } from '@/features/goals/months-label';
import { ru } from '@/i18n/ru';

const MIN_MONTHS = 1;
const MAX_MONTHS = 360;
const MAX_RATE_PERCENT = 25;

interface WhatIfPanelProps {
  readonly goal: Goal;
  readonly savedMinor: number;
}

/**
 * The three questions a goal always raises: what if it takes longer, what if it costs
 * less, what if the money earns more. Nothing here is saved until the button is
 * pressed — the sliders are a calculator, not an editor.
 */
export function WhatIfPanel({ goal, savedMinor }: WhatIfPanelProps) {
  const today = currentMonth();
  const storedMonths = goal.targetMonth ? Math.max(monthsBetween(today, goal.targetMonth), MIN_MONTHS) : 12;

  const [months, setMonths] = useState(Math.min(storedMonths, MAX_MONTHS));
  const [costRub, setCostRub] = useState(Math.round(minorToRubles(goal.costMinor)));
  const [ratePercent, setRatePercent] = useState(Math.round(goal.returnRate * 1000) / 10);
  const [busy, setBusy] = useState(false);

  const costMinor = rublesToMinor(costRub);
  const returnRate = ratePercent / 100;
  const targetMonth = addMonths(today, months);

  // The cost is stated in the prices of costAsOf, so it inflates until the new date.
  const target = futureValueMinor(costMinor, goal.inflationRate, monthsBetween(goal.costAsOf, targetMonth));
  const contributionMinor = monthlyContribution({
    futureValueMinor: target,
    savedMinor,
    returnRate,
    months,
  });

  // Formula 5 in the other direction: how long that contribution would actually take.
  const termMonths =
    contributionMinor > 0
      ? monthsToGoal({
          costMinor,
          costAsOf: goal.costAsOf,
          currentMonth: today,
          savedMinor,
          paymentMinor: contributionMinor,
          returnRate,
          inflationRate: goal.inflationRate,
        })
      : 0;

  const changed =
    targetMonth !== goal.targetMonth ||
    costMinor !== goal.costMinor ||
    Math.abs(returnRate - goal.returnRate) > 1e-9;

  const reset = () => {
    setMonths(Math.min(storedMonths, MAX_MONTHS));
    setCostRub(Math.round(minorToRubles(goal.costMinor)));
    setRatePercent(Math.round(goal.returnRate * 1000) / 10);
  };

  const apply = async () => {
    setBusy(true);
    try {
      await updateGoal(goal.id, { targetMonth, costMinor, returnRate });
    } finally {
      setBusy(false);
    }
  };

  const maxCost = Math.max(costRub * 2, 100_000);

  return (
    <section className="flex flex-col gap-3" data-testid="what-if">
      <div>
        <h3 className="text-sm font-semibold">{ru.goals.whatIf}</h3>
        <p className="text-xs text-muted-foreground">{ru.goals.whatIfHint}</p>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="flex justify-between">
          <span>{ru.goals.whatIfMonths}</span>
          <span className="font-medium tabular-nums">
            {monthsLabel(months)} · {monthLabel(targetMonth)}
          </span>
        </span>
        <Slider
          min={MIN_MONTHS}
          max={MAX_MONTHS}
          value={months}
          data-testid="what-if-months"
          aria-label={ru.goals.whatIfMonths}
          onValueChange={setMonths}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="flex justify-between">
          <span>{ru.goals.cost}</span>
          <span className="font-medium tabular-nums">{formatForecast(costMinor)}</span>
        </span>
        <Slider
          min={0}
          max={maxCost}
          step={1000}
          value={costRub}
          data-testid="what-if-cost"
          aria-label={ru.goals.cost}
          onValueChange={setCostRub}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="flex justify-between">
          <span>{ru.goals.whatIfReturn}</span>
          <span className="font-medium tabular-nums">{ratePercent} %</span>
        </span>
        <Slider
          min={0}
          max={MAX_RATE_PERCENT}
          step={0.5}
          value={ratePercent}
          data-testid="what-if-return"
          aria-label={ru.goals.whatIfReturn}
          onValueChange={setRatePercent}
        />
      </label>

      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-sm">
          {ru.goals.contribution}:{' '}
          <span className="font-semibold tabular-nums" data-testid="what-if-contribution">
            {formatForecast(contributionMinor)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground" data-testid="what-if-term">
          {termMonths === null
            ? ru.goals.whatIfNever
            : ru.goals.whatIfResult.replace('{months}', monthsLabel(termMonths))}
        </p>
        <p className="text-xs text-muted-foreground">
          {ru.goals.costFuture}: {formatForecast(target)} · {ru.goals.realReturn}:{' '}
          {Math.round(realReturnRate(returnRate, goal.inflationRate) * 1000) / 10} %
        </p>
        {returnBeatsInflation(returnRate, goal.inflationRate) ? null : (
          <p className="mt-1 text-xs text-warning">{ru.goals.returnBelowInflation}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!changed || busy}
          data-testid="what-if-apply"
          onClick={() => void apply()}
        >
          {ru.goals.whatIfApply}
        </Button>
        <Button size="sm" variant="outline" disabled={!changed} onClick={reset}>
          {ru.goals.whatIfReset}
        </Button>
      </div>
    </section>
  );
}
