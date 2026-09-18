import { formatMinor } from '@/core/money';
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

/**
 * Where the money went over the chosen period. Drawn as rows and not as a ring: on a phone a row
 * carries its name, its sum and its share at once, and a tap on it filters the list below.
 *
 * The bars are shades of one colour, so the numbers beside them, not the shade, carry the meaning.
 */
export function CategoryChart({ expenses, categories, chosen, onPick }: CategoryChartProps) {
  const totalMinor = sliceTotalMinor(expenses);
  if (totalMinor <= 0) return null;

  const nameOf = new Map(categories.map((category) => [category.id, category.name]));
  const widest = expenses[0]?.amountMinor ?? 0;

  return (
    <ul className="flex flex-col gap-1.5" data-testid="category-chart">
      {expenses.map((slice) => {
        const rest = slice.key === REST_KEY;
        const label = rest
          ? strings.budget.chart.rest
          : (nameOf.get(slice.key) ?? strings.budget.chart.noCategory);
        const active = chosen.includes(slice.key);

        const row = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{label}</span>
              <span className="shrink-0 tabular-nums">
                {formatMinor(slice.amountMinor, { fractionDigits: 0 })}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {percentLabel(sharePercent(slice.amountMinor, totalMinor), 0)}
                </span>
              </span>
            </span>
            <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full rounded-full bg-primary"
                style={{
                  width: `${widest > 0 ? (slice.amountMinor / widest) * 100 : 0}%`,
                  opacity: active ? 1 : 0.75,
                }}
              />
            </span>
          </>
        );

        return (
          <li key={slice.key} data-testid={`chart-row-${slice.key}`}>
            {rest ? (
              <span className="block">{row}</span>
            ) : (
              <button
                type="button"
                className="block w-full text-left"
                aria-pressed={active}
                data-testid={`chart-pick-${slice.key}`}
                onClick={() => onPick(slice.key)}
              >
                {row}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
