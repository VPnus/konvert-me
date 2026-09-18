import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCompactMinor, formatMinor } from '@/core/money';
import { monthsOfYear } from '@/core/time';
import type { BudgetYearData } from '@/features/budget/budget-data';
import { shortMonthLabel } from '@/features/budget/month-label';
import { strings } from '@/i18n';

const t = strings.budget.chart;

/**
 * The year at a glance: what came in and what went out of every month, and the line of what was
 * left. The table below holds the exact numbers; this one is for the shape of the year.
 */
export default function YearChart({ data }: { data: BudgetYearData }) {
  const rows = monthsOfYear(data.year).map((month) => {
    const totals = data.fact.byMonth[month];
    return {
      label: shortMonthLabel(month),
      income: Math.round(totals?.incomeMinor ?? 0),
      expense: Math.round(totals?.expenseMinor ?? 0),
      free: Math.round(totals?.freeCashMinor ?? 0),
    };
  });

  return (
    <div className="h-64 w-full" data-testid="year-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            stroke="var(--color-border)"
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            stroke="var(--color-border)"
            width={62}
            tickFormatter={formatCompactMinor}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-muted)' }}
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
          <Legend wrapperStyle={{ fontSize: 12 }} />

          <Bar dataKey="income" name={t.income} fill="var(--color-foreground)" fillOpacity={0.85} />
          <Bar dataKey="expense" name={t.expense} fill="var(--color-foreground)" fillOpacity={0.35} />
          <Line
            type="monotone"
            dataKey="free"
            name={t.free}
            stroke="var(--color-foreground)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
