import { Percent } from 'lucide-react';
import { useState } from 'react';

import { formatForecast } from '@/core/money';
import { daysInMonth, withDayOfMonth } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { INTEREST_CATEGORY, type BalanceData, type InterestDue } from '@/features/balance/balance-data';
import { rateLabel } from '@/features/balance/card-view';
import { TransactionForm, type TransactionDraft } from '@/features/budget/transaction-form';
import { monthInText } from '@/features/plan/plan-format';
import { fill, strings } from '@/i18n';

const t = strings.interest;

function draftOf(due: InterestDue): TransactionDraft {
  return {
    kind: 'income',
    date: withDayOfMonth(due.month, daysInMonth(due.month)),
    amountMinor: due.amountMinor,
    accountId: due.account.id,
    categoryId: INTEREST_CATEGORY,
    note: fill(t.note, { rate: rateLabel(due.account.rate ?? 0) }),
  };
}

/** The interest of last month on the accounts with a rate, ready to be checked and written down as income. */
export function InterestCard({ data }: { data: BalanceData }) {
  const [draft, setDraft] = useState<TransactionDraft | null>(null);
  if (data.interestDue.length === 0) return null;
  const month = data.interestDue[0].month;

  return (
    <Card data-testid="interest-card">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">
          <Percent className="mr-1 inline size-4" aria-hidden />
          {fill(t.title, { month: monthInText(month) })}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t.text}</p>
      </CardHeader>
      <CardContent className="pt-3">
        <ul>
          {data.interestDue.map((due) => (
            <li
              key={due.account.id}
              className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{due.account.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fill(t.row, {
                    rate: rateLabel(due.account.rate ?? 0),
                    amount: formatForecast(due.amountMinor, { fractionDigits: 2 }),
                  })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                aria-label={`${t.record}: ${due.account.name}`}
                data-testid={`interest-record-${due.account.name}`}
                onClick={() => setDraft(draftOf(due))}
              >
                {t.record}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>

      {draft ? (
        <TransactionForm
          draft={draft}
          accounts={data.accounts.filter((account) => !account.archived)}
          categories={data.categories}
          open
          onOpenChange={(open) => {
            if (!open) setDraft(null);
          }}
        />
      ) : null}
    </Card>
  );
}
