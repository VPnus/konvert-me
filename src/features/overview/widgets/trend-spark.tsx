import type { MonthPoint } from '@/core/budget';
import { formatMinor } from '@/core/money';
import { shortMonthLabel } from '@/features/budget/month-label';
import { strings } from '@/i18n';

const HEIGHT = 96;
const GAP = 2;

/**
 * Twelve months of "what was left", drawn by hand in SVG. The widget sits on the first screen, and
 * a charting library there would cost a hundred kilobytes for twelve bars: the bigger charts of the
 * budget and the balance load one when they are opened, this one does not need it.
 *
 * A bar above the line is a month that ended in the black, a bar below it one that ended in the red;
 * the direction carries the meaning, not the shade, and every bar names its month and sum.
 */
export function TrendSpark({ points }: { points: readonly MonthPoint[] }) {
  const widest = Math.max(...points.map((point) => Math.abs(point.freeCashMinor)), 1);
  const width = points.length * 10;
  const middle = HEIGHT / 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-24 w-full"
      role="img"
      data-testid="trend-spark"
      aria-label={`${strings.widgets.trend.title}: ${points
        .map(
          (point) =>
            `${shortMonthLabel(point.month)} ${formatMinor(point.freeCashMinor, { fractionDigits: 0 })}`,
        )
        .join(', ')}`}
    >
      <line
        x1="0"
        y1={middle}
        x2={width}
        y2={middle}
        stroke="var(--color-border)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((point, index) => {
        const share = Math.abs(point.freeCashMinor) / widest;
        const height = Math.max(1, share * (middle - 4));
        const positive = point.freeCashMinor >= 0;

        return (
          <rect
            key={point.month}
            x={index * 10 + GAP}
            y={positive ? middle - height : middle}
            width={10 - GAP * 2}
            height={height}
            rx="1"
            fill="var(--color-foreground)"
            fillOpacity={positive ? 0.85 : 0.35}
          >
            <title>
              {shortMonthLabel(point.month)}: {formatMinor(point.freeCashMinor, { fractionDigits: 0 })}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}
