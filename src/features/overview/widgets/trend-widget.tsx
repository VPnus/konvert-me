import { lazy, Suspense } from 'react';

import { formatMinor } from '@/core/money';
import { WidgetEmpty, WidgetFrame } from '@/features/overview/widgets/widget-shell';
import type { WidgetProps } from '@/features/overview/widgets/types';
import { strings } from '@/i18n';

// Recharts is heavy: it travels with the chart, not with the first screen.
const TrendChart = lazy(() => import('@/features/overview/widgets/trend-chart'));

const t = strings.widgets.trend;

/**
 * The shape of the last twelve months among the numbers: every other widget answers "how much
 * now", this one answers "which way". The months that had nothing are drawn as zero, not skipped.
 */
export function TrendWidget({ data }: WidgetProps) {
  const points = data.trend;
  const anything = points.some((point) => point.incomeMinor !== 0 || point.expenseMinor !== 0);

  if (!anything) {
    return (
      <WidgetFrame title={t.title}>
        <WidgetEmpty text={t.empty} actionLabel={t.emptyAction} to="/budget" />
      </WidgetFrame>
    );
  }

  const last = points[points.length - 1];
  const twelve = points.reduce((total, point) => total + point.freeCashMinor, 0);

  return (
    <WidgetFrame title={t.title}>
      <Suspense fallback={<p className="text-sm text-muted-foreground">{strings.common.loading}</p>}>
        <TrendChart points={points} />
      </Suspense>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>{t.thisMonth}:</dt>
          <dd className="tabular-nums" data-testid="trend-this-month">
            {formatMinor(last?.freeCashMinor ?? 0, { fractionDigits: 0 })}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{t.year}:</dt>
          <dd className="tabular-nums">{formatMinor(twelve, { fractionDigits: 0 })}</dd>
        </div>
      </dl>
    </WidgetFrame>
  );
}
