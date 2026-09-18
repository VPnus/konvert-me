import type { ReactNode } from 'react';

import { formatMinor } from '@/core/money';
import type { LimitView } from '@/core/tax-accounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TaxAccount } from '@/db/models';
import { fill, strings } from '@/i18n';

const t = strings.taxAccounts;

interface LimitCardProps {
  readonly view: LimitView;
  readonly accounts: readonly TaxAccount[];
  readonly year: number;
  /** The rows of the accounts that share this limit: the amounts of the year are filled in there. */
  readonly children: ReactNode;
}

/** How full one limit of the year is. */
export function LimitCard({ view, accounts, year, children }: LimitCardProps) {
  // A 529 belongs to one child, so the card carries the name of the account instead of the group.
  const title = view.group === 'gift' ? (accounts[0]?.name ?? t.groups.gift) : t.groups[view.group];
  const share = view.limitMinor === 0 ? 0 : Math.min(1, view.countedMinor / view.limitMinor);

  return (
    <Card data-testid={`limit-${view.group}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {fill(t.limitOfYear, { year, amount: formatMinor(view.limitMinor, { fractionDigits: 0 }) })}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${view.overMinor > 0 ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${Math.round(share * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm" data-testid="limit-summary">
            {t.contributed}:{' '}
            <span className="font-semibold tabular-nums">{formatMinor(view.countedMinor)}</span> · {t.left}:{' '}
            <span className="font-semibold tabular-nums">{formatMinor(view.leftMinor)}</span>
          </p>
          {view.employerMinor > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t.fromEmployer}: {formatMinor(view.employerMinor)}
              {view.group === 'deferral' ? ` · ${t.matchOutsideLimit}` : ''}
            </p>
          ) : null}
          {view.overMinor > 0 ? (
            <p role="alert" className="mt-1 text-sm text-destructive" data-testid="limit-over">
              {fill(view.group === 'gift' ? t.overGift : t.over, {
                amount: formatMinor(view.overMinor),
              })}
            </p>
          ) : null}
        </div>

        {children}
      </CardContent>
    </Card>
  );
}
