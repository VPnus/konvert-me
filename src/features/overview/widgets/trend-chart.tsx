import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { MonthPoint } from '@/core/budget';
import { formatCompactMinor, formatMinor } from '@/core/money';
import { shortMonthLabel } from '@/features/budget/month-label';
import { strings } from '@/i18n';

/** What was left of every month of the last year, drawn like the line of the capital. */
export default function TrendChart({ points }: { points: readonly MonthPoint[] }) {
  const data = points.map((point) => ({
    label: shortMonthLabel(point.month),
    free: Math.round(point.freeCashMinor),
  }));

  return (
    <div className="h-44 w-full" data-testid="trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trend-free" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity={0.24} />
              <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            stroke="var(--color-border)"
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            stroke="var(--color-border)"
            width={58}
            tickFormatter={formatCompactMinor}
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
            formatter={(value) => [
              formatMinor(typeof value === 'number' ? value : 0, { fractionDigits: 0 }),
              strings.widgets.trend.free,
            ]}
          />
          <Area
            type="monotone"
            dataKey="free"
            name={strings.widgets.trend.free}
            stroke="var(--color-foreground)"
            strokeWidth={2}
            fill="url(#trend-free)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
