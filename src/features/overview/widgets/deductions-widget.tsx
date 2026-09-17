import { Link } from 'react-router-dom';

import { formatMinor } from '@/core/money';
import { buttonVariants } from '@/components/ui/button';
import { BigNumber, WidgetEmpty, WidgetFrame } from '@/features/overview/widgets/widget-shell';
import type { WidgetProps } from '@/features/overview/widgets/types';
import { fill, strings } from '@/i18n';

const t = strings.widgets.deductions;
const rubles = (minor: number) => formatMinor(minor, { fractionDigits: 0 });

/** What the open years give back, and where each return stands. */
export function DeductionsWidget({ data }: WidgetProps) {
  const { years, toComeMinor } = data.deductions;

  if (years.length === 0) {
    return (
      <WidgetFrame title={t.title}>
        <WidgetEmpty text={t.empty} actionLabel={t.emptyAction} to="/deductions" />
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={t.title} hint={t.hint}>
      <div data-testid="deductions-widget-total">
        {toComeMinor > 0 ? (
          <BigNumber value={rubles(toComeMinor)} />
        ) : (
          <p className="text-sm text-muted-foreground">{t.nothing}</p>
        )}
      </div>
      <ul className="flex flex-col">
        {years.map((item) => (
          <li
            key={item.year}
            className="flex items-baseline justify-between gap-2 border-b border-border py-1.5 text-sm last:border-b-0"
            data-testid={`deductions-widget-${item.year}`}
          >
            <span className="min-w-0 truncate">
              {item.year}
              <span className="text-muted-foreground">
                {' · '}
                {item.stage === 'current' ? t.current : strings.deductions.statuses[item.status]}
              </span>
            </span>
            <span className={`shrink-0 tabular-nums ${item.balanceMinor < 0 ? 'text-destructive' : ''}`}>
              {item.balanceMinor < 0
                ? fill(t.toPay, { amount: rubles(-item.balanceMinor) })
                : rubles(item.balanceMinor)}
            </span>
          </li>
        ))}
      </ul>
      <Link
        to="/deductions"
        className={buttonVariants({ size: 'sm', variant: 'outline', className: 'w-fit' })}
      >
        {t.open}
      </Link>
    </WidgetFrame>
  );
}
