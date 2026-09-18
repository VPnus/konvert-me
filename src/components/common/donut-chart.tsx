import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { formatMinor } from '@/core/money';
import { sharePercent, sliceTotalMinor, type Slice } from '@/core/slices';
import { percentLabel } from '@/i18n/format';

export interface DonutPart extends Slice {
  readonly label: string;
}

interface DonutChartProps {
  readonly parts: readonly DonutPart[];
  /** What the whole ring is, for the reader of a screen: "Активы". */
  readonly caption: string;
  readonly testId?: string;
}

/**
 * A ring of parts with its legend. The app is drawn in shades of one colour, so the shade never
 * carries the meaning alone: every part is named in the legend and counted in the tooltip.
 */
export default function DonutChart({ parts, caption, testId }: DonutChartProps) {
  const totalMinor = sliceTotalMinor(parts);
  if (totalMinor <= 0 || parts.length === 0) return null;

  const data = parts.map((part, index) => ({
    ...part,
    value: Math.round(part.amountMinor),
    opacity: Math.max(0.28, 1 - index * 0.16),
  }));

  return (
    <div
      className="h-56 w-full"
      data-testid={testId}
      role="img"
      aria-label={`${caption}: ${data
        .map((part) => `${part.label} ${percentLabel(sharePercent(part.amountMinor, totalMinor), 0)}`)
        .join(', ')}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={1}
            stroke="var(--color-card)"
            isAnimationActive={false}
          >
            {data.map((part) => (
              <Cell key={part.key} fill="var(--color-foreground)" fillOpacity={part.opacity} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--color-foreground)',
            }}
            formatter={(value, name) => [
              `${formatMinor(typeof value === 'number' ? value : 0, { fractionDigits: 0 })} · ${percentLabel(
                sharePercent(typeof value === 'number' ? value : 0, totalMinor),
                0,
              )}`,
              String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
