import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatMinor } from '@/core/money';
import type { ProjectionPoint } from '@/core/goals';
import { shortMonthLabel } from '@/features/budget/month-label';
import { ru } from '@/i18n/ru';

/** Whole thousands: a goal chart is about the shape, not about the kopecks. */
function thousands(minor: number): string {
  return `${Math.round(minor / 100_000)} тыс.`;
}

interface GoalChartProps {
  readonly points: readonly ProjectionPoint[];
}

/**
 * The savings line against the price line. They are drawn from the same numbers the
 * card shows, so the picture can never disagree with the figures above it.
 */
export default function GoalChart({ points }: GoalChartProps) {
  const data = points.map((point) => ({
    month: point.month,
    label: `${shortMonthLabel(point.month)} ${point.month.slice(2, 4)}`,
    saved: Math.round(point.savedMinor),
    target: Math.round(point.targetMinor),
  }));

  return (
    <div className="h-56 w-full" data-testid="goal-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="goal-saved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            stroke="var(--color-border)"
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            stroke="var(--color-border)"
            width={62}
            tickFormatter={thousands}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-border)' }}
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--color-foreground)',
            }}
            formatter={(value, name) => [
              formatMinor(typeof value === 'number' ? value : 0, { fractionDigits: 0 }),
              String(name),
            ]}
          />

          <Area
            type="monotone"
            dataKey="saved"
            name={ru.goals.chartSaved}
            stroke="var(--color-foreground)"
            strokeWidth={2}
            fill="url(#goal-saved)"
          />
          <Line
            type="monotone"
            dataKey="target"
            name={ru.goals.chartTarget}
            stroke="var(--color-muted-foreground)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
