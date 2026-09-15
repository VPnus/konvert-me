import { Link } from 'react-router-dom';

import { formatMinor, roundToMinor } from '@/core/money';
import { ru } from '@/i18n/ru';
import { BigNumber, ProgressBar, WidgetEmpty, WidgetFrame } from '@/features/overview/widgets/widget-shell';
import type { GoalView } from '@/features/overview/overview-data';
import type { WidgetProps } from '@/features/overview/widgets/types';

function goalProgress(view: GoalView): number {
  const target = view.plan?.futureValueMinor ?? view.goal.costMinor;
  if (target <= 0) return 0;
  return view.savedMinor / target;
}

function GoalLine({ view }: { view: GoalView }) {
  const status =
    view.plan?.status === 'funded'
      ? ru.widgets.goals.funded
      : view.plan?.status === 'overdue'
        ? ru.widgets.goals.overdue
        : view.plan
          ? `${ru.widgets.goals.contribution}: ${formatMinor(roundToMinor(view.plan.contributionMinor), { fractionDigits: 0 })}`
          : '';

  return (
    <li className="flex flex-col gap-1 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{view.goal.name}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatMinor(roundToMinor(view.savedMinor), { fractionDigits: 0 })}
        </span>
      </div>
      <ProgressBar
        value={goalProgress(view)}
        tone={view.plan?.status === 'overdue' ? 'warning' : 'primary'}
      />
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </li>
  );
}

export function GoalsWidget({ data }: WidgetProps) {
  if (data.goals.length === 0) {
    return (
      <WidgetFrame title={ru.widgets.goals.title}>
        <WidgetEmpty text={ru.widgets.goals.empty} actionLabel={ru.widgets.goals.emptyAction} to="/goals" />
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={ru.widgets.goals.title}>
      <ul className="flex flex-col gap-3">
        {data.goals.map((view) => (
          <GoalLine key={view.goal.id} view={view} />
        ))}
      </ul>
      <Link to="/goals" className="text-xs text-primary underline-offset-2 hover:underline">
        {ru.widgets.goals.emptyAction}
      </Link>
    </WidgetFrame>
  );
}

export function GoalProgressWidget({ data, settings }: WidgetProps) {
  const goalId = typeof settings.goalId === 'string' ? settings.goalId : undefined;
  const view = goalId
    ? data.goals.find((candidate) => candidate.goal.id === goalId)
    : data.goals.find((candidate) => candidate.goal.kind !== 'reserve');

  if (!view) {
    return (
      <WidgetFrame title={ru.widgets.goalProgress.title}>
        <WidgetEmpty
          text={ru.widgets.goalProgress.empty}
          actionLabel={ru.widgets.goalProgress.emptyAction}
          to="/goals"
        />
      </WidgetFrame>
    );
  }

  const target = view.plan?.futureValueMinor ?? view.goal.costMinor;

  return (
    <WidgetFrame title={view.goal.name} hint={ru.widgets.goalProgress.title}>
      <BigNumber value={formatMinor(roundToMinor(view.savedMinor), { fractionDigits: 0 })} />
      <ProgressBar value={goalProgress(view)} />
      <p className="text-xs text-muted-foreground">
        {ru.widgets.goals.contribution}:{' '}
        {view.plan ? formatMinor(roundToMinor(view.plan.contributionMinor), { fractionDigits: 0 }) : '—'} ·{' '}
        {formatMinor(roundToMinor(target), { fractionDigits: 0 })}
      </p>
    </WidgetFrame>
  );
}

export function WarningsWidget({ data }: WidgetProps) {
  const warnings = data.warnings;

  if (warnings.length === 0) {
    return (
      <WidgetFrame title={ru.widgets.warnings.title}>
        <p className="text-sm text-muted-foreground">{ru.widgets.warnings.empty}</p>
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={ru.widgets.warnings.title}>
      <ul className="flex flex-col gap-2">
        {warnings.map((warning) => (
          <li key={warning.id} className="flex gap-2 text-sm">
            <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-warning" />
            {warning.to ? (
              <Link to={warning.to} className="underline-offset-2 hover:underline">
                {warning.text}
              </Link>
            ) : (
              <span>{warning.text}</span>
            )}
          </li>
        ))}
      </ul>
    </WidgetFrame>
  );
}
