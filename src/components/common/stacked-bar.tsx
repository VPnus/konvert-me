import { formatMinor } from '@/core/money';
import { sharePercent, sliceTotalMinor, type Slice } from '@/core/slices';
import { percentLabel } from '@/i18n/format';

export interface BarPart extends Slice {
  readonly label: string;
}

interface StackedBarProps {
  readonly parts: readonly BarPart[];
  /** What the whole bar is, for the reader of a screen: "Капитал: 320 000 ₽". */
  readonly caption: string;
  readonly testId?: string;
}

/**
 * One bar of several parts, with the list of them below. The app is drawn in shades of one colour,
 * so the shade alone never carries the meaning: every part is named and counted in the list, which
 * is also what a screen reader reads — the bar itself is decoration.
 */
export function StackedBar({ parts, caption, testId }: StackedBarProps) {
  const totalMinor = sliceTotalMinor(parts);
  if (totalMinor <= 0 || parts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${caption}: ${parts
          .map((part) => `${part.label} ${percentLabel(sharePercent(part.amountMinor, totalMinor), 0)}`)
          .join(', ')}`}
      >
        {parts.map((part, index) => (
          <div
            key={part.key}
            className="h-full border-r border-card bg-primary last:border-r-0"
            style={{
              width: `${sharePercent(part.amountMinor, totalMinor)}%`,
              opacity: Math.max(0.25, 1 - index * 0.16),
            }}
          />
        ))}
      </div>

      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {parts.map((part, index) => (
          <li key={part.key} className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span
                className="size-2 shrink-0 translate-y-px rounded-full bg-primary"
                style={{ opacity: Math.max(0.25, 1 - index * 0.16) }}
                aria-hidden
              />
              <span className="truncate">{part.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatMinor(part.amountMinor, { fractionDigits: 0 })} ·{' '}
              {percentLabel(sharePercent(part.amountMinor, totalMinor), 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
