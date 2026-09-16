import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { NetWorthPoint } from '@/core/balance';
import { formatCompactMinor, formatMinor } from '@/core/money';
import { shortMonthLabel } from '@/features/budget/month-label';
import { ru } from '@/i18n/ru';

/** Capital month by month. One line, because one number is the point of this screen. */
export default function CapitalChart({ points }: { points: readonly NetWorthPoint[] }) {
  const data = points.map((point) => ({
    label: `${shortMonthLabel(point.month)} ${point.month.slice(2, 4)}`,
    net: Math.round(point.netWorthMinor),
  }));

  return (
    <div className="h-56 w-full" data-testid="capital-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="capital-net" x1="0" y1="0" x2="0" y2="1">
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
              ru.capital.netWorth,
            ]}
          />

          <Area
            type="monotone"
            dataKey="net"
            name={ru.capital.netWorth}
            stroke="var(--color-foreground)"
            strokeWidth={2}
            fill="url(#capital-net)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
