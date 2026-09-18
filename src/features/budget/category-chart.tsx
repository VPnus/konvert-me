import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatCompactMinor, formatMinor } from '@/core/money';
import { sharePercent, sliceTotalMinor, type Slice } from '@/core/slices';
import { REST_KEY } from '@/features/budget/operations-data';
import type { Category } from '@/db/models';
import { strings } from '@/i18n';
import { percentLabel } from '@/i18n/format';

interface CategoryChartProps {
  readonly expenses: readonly Slice[];
  readonly categories: readonly Category[];
  readonly chosen: readonly string[];
  readonly onPick: (categoryId: string) => void;
}

interface Row {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly share: number;
}

interface ShapeProps {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly payload?: Row;
  readonly chosen?: readonly string[];
}

/**
 * The bar of a category, drawn by hand so that it can carry its own test id and its own shade: the
 * one that is filtered by stands out, the rest keep one step back.
 */
function CategoryBar({ x = 0, y = 0, width = 0, height = 0, payload, chosen = [] }: ShapeProps) {
  const active = payload ? chosen.includes(payload.key) : false;

  return (
    <rect
      x={x}
      y={y}
      width={Math.max(width, 1)}
      height={height}
      rx={4}
      fill="var(--color-foreground)"
      fillOpacity={active ? 1 : 0.62}
      style={{ cursor: payload?.key === REST_KEY ? 'default' : 'pointer' }}
      data-testid={payload ? `chart-pick-${payload.key}` : undefined}
    />
  );
}

/**
 * Where the money went over the chosen period: the biggest categories as bars, the tail as one.
 * A click on a bar filters the list below, so the picture is not only a picture.
 */
export default function CategoryChart({ expenses, categories, chosen, onPick }: CategoryChartProps) {
  const totalMinor = sliceTotalMinor(expenses);
  if (totalMinor <= 0) return null;

  const nameOf = new Map(categories.map((category) => [category.id, category.name]));
  const rows: Row[] = expenses.map((slice) => ({
    key: slice.key,
    label:
      slice.key === REST_KEY
        ? strings.budget.chart.rest
        : (nameOf.get(slice.key) ?? strings.budget.chart.noCategory),
    value: Math.round(slice.amountMinor),
    share: sharePercent(slice.amountMinor, totalMinor),
  }));

  return (
    <div style={{ height: rows.length * 38 + 28 }} className="w-full" data-testid="category-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            stroke="var(--color-border)"
            tickFormatter={formatCompactMinor}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={116}
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            stroke="var(--color-border)"
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
            formatter={(value, _name, item) => [
              `${formatMinor(typeof value === 'number' ? value : 0, { fractionDigits: 0 })} · ${percentLabel(
                (item?.payload as Row | undefined)?.share ?? 0,
                0,
              )}`,
              strings.budget.chart.spent,
            ]}
          />
          <Bar
            dataKey="value"
            name={strings.budget.chart.spent}
            shape={<CategoryBar chosen={chosen} />}
            onClick={(row: unknown) => {
              const key = (row as { payload?: Row } | undefined)?.payload?.key;
              if (key && key !== REST_KEY) onPick(key);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
