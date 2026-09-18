import { Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { formatMinor } from '@/core/money';
import { PERIOD_KINDS, type PeriodKind } from '@/core/period';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import type { Account, Category, Transaction } from '@/db/models';
import type { OperationsData } from '@/features/budget/operations-data';
import {
  EMPTY_FILTER,
  extraFilterCount,
  isFilterEmpty,
  toggleId,
  type TransactionFilterState,
} from '@/features/budget/transaction-filter';
import { fill, strings } from '@/i18n';

const KINDS: readonly Transaction['kind'][] = [
  'expense',
  'income',
  'refund',
  'transfer',
  'adjustment',
  'revaluation',
];

/** The sign an operation carries in the list: only cash flow gets a plus or a minus. */
function signOf(kind: Transaction['kind']): string {
  if (kind === 'income' || kind === 'refund') return '+';
  if (kind === 'expense') return '−';
  return '';
}

function money(minor: number): string {
  return formatMinor(minor, { fractionDigits: 0 });
}

/** A condition that is either on or off, as a button: a checkbox row would not fit a phone. */
function Chip({
  label,
  pressed,
  testId,
  onClick,
}: {
  readonly label: string;
  readonly pressed: boolean;
  readonly testId?: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? 'default' : 'outline'}
      aria-pressed={pressed}
      className="h-auto min-h-8 py-1 text-xs whitespace-normal"
      data-testid={testId}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

interface TransactionsCardProps {
  readonly categories: readonly Category[];
  readonly accounts: readonly Account[];
  readonly operations: OperationsData | undefined;
  readonly filter: TransactionFilterState;
  readonly onFilterChange: (filter: TransactionFilterState) => void;
  readonly limit: number;
  readonly onShowMore: () => void;
  readonly onAdd: () => void;
  readonly onEdit: (transaction: Transaction) => void;
  readonly onDelete: (transaction: Transaction) => void;
}

export function TransactionsCard({
  categories,
  accounts,
  operations,
  filter,
  onFilterChange,
  limit,
  onShowMore,
  onAdd,
  onEdit,
  onDelete,
}: TransactionsCardProps) {
  const [extraOpen, setExtraOpen] = useState(false);
  const nameOfCategory = new Map(categories.map((category) => [category.id, category.name]));
  const nameOfAccount = new Map(accounts.map((account) => [account.id, account.name]));
  const patch = (next: Partial<TransactionFilterState>) => onFilterChange({ ...filter, ...next });
  const extra = extraFilterCount(filter);

  const describe = (transaction: Transaction): string => {
    if (transaction.kind === 'transfer') {
      const from = nameOfAccount.get(transaction.accountId) ?? '—';
      const to = transaction.toAccountId ? (nameOfAccount.get(transaction.toAccountId) ?? '—') : '—';
      return `${from} → ${to}`;
    }
    if (transaction.categoryId) return nameOfCategory.get(transaction.categoryId) ?? '—';
    return nameOfAccount.get(transaction.accountId) ?? '—';
  };

  const setPeriod = (kind: PeriodKind) => {
    patch({
      period: kind === 'custom' ? { kind, from: filter.period.from, to: filter.period.to } : { kind },
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{strings.operations.title}</CardTitle>
          <p className="text-sm text-muted-foreground" data-testid="operations-count">
            {strings.operations.found}: {operations?.found ?? 0}
          </p>
          {operations && operations.found > 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="operations-totals">
              {strings.operations.foundIncome}: {money(operations.totals.incomeMinor)} ·{' '}
              {strings.operations.foundExpense}: {money(operations.totals.expenseMinor)}
            </p>
          ) : null}
        </div>
        <Button size="sm" onClick={onAdd} data-testid="add-transaction">
          <Plus className="size-4" aria-hidden />
          {strings.common.add}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label={strings.operations.period.label}
          data-testid="period-kinds"
        >
          {PERIOD_KINDS.map((kind) => (
            <Chip
              key={kind}
              label={strings.operations.period[kind]}
              pressed={filter.period.kind === kind}
              testId={`period-${kind}`}
              onClick={() => setPeriod(kind)}
            />
          ))}
        </div>

        {filter.period.kind === 'custom' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="date"
              value={filter.period.from ?? ''}
              aria-label={strings.operations.period.from}
              data-testid="period-from"
              onChange={(event) =>
                patch({ period: { kind: 'custom', from: event.target.value, to: filter.period.to } })
              }
            />
            <Input
              type="date"
              value={filter.period.to ?? ''}
              aria-label={strings.operations.period.to}
              data-testid="period-to"
              onChange={(event) =>
                patch({ period: { kind: 'custom', from: filter.period.from, to: event.target.value } })
              }
            />
          </div>
        ) : null}

        <Input
          value={filter.query}
          type="search"
          aria-label={strings.operations.search}
          placeholder={strings.operations.search}
          data-testid="operations-search"
          onChange={(event) => patch({ query: event.target.value })}
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={filter.kind}
            aria-label={strings.operations.kind}
            data-testid="filter-kind"
            onChange={(event) => patch({ kind: event.target.value as TransactionFilterState['kind'] })}
          >
            <option value="">{strings.operations.allKinds}</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {strings.operations.kinds[kind]}
              </option>
            ))}
          </Select>

          <div className="flex flex-wrap gap-1">
            <Chip
              label={strings.operations.onlyExpenses}
              pressed={filter.kind === 'expense'}
              testId="filter-only-expenses"
              onClick={() => patch({ kind: filter.kind === 'expense' ? '' : 'expense' })}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-expanded={extraOpen}
              className="h-auto min-h-8 py-1 text-xs"
              data-testid="filter-more"
              onClick={() => setExtraOpen((open) => !open)}
            >
              <SlidersHorizontal className="size-3.5" aria-hidden />
              {strings.operations.moreFilters}
              {extra > 0 ? ` · ${extra}` : ''}
            </Button>
          </div>
        </div>

        {extraOpen ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3" data-testid="filter-panel">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">{strings.operations.category}</p>
              <div className="flex flex-wrap gap-1">
                {categories
                  .filter((category) => !category.archived)
                  .map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      pressed={filter.categoryIds.includes(category.id)}
                      testId={`filter-category-${category.id}`}
                      onClick={() => patch({ categoryIds: toggleId(filter.categoryIds, category.id) })}
                    />
                  ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">{strings.operations.account}</p>
              <div className="flex flex-wrap gap-1">
                {accounts
                  .filter((account) => !account.archived)
                  .map((account) => (
                    <Chip
                      key={account.id}
                      label={account.name}
                      pressed={filter.accountIds.includes(account.id)}
                      testId={`filter-account-${account.id}`}
                      onClick={() => patch({ accountIds: toggleId(filter.accountIds, account.id) })}
                    />
                  ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <NumberInput
                value={filter.minAmount}
                aria-label={strings.operations.amountFrom}
                placeholder={strings.operations.amountFrom}
                data-testid="filter-amount-min"
                onValueChange={(value) => patch({ minAmount: value })}
              />
              <NumberInput
                value={filter.maxAmount}
                aria-label={strings.operations.amountTo}
                placeholder={strings.operations.amountTo}
                data-testid="filter-amount-max"
                onValueChange={(value) => patch({ maxAmount: value })}
              />
            </div>
          </div>
        ) : null}

        {isFilterEmpty(filter) ? null : (
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            data-testid="filter-reset"
            onClick={() => onFilterChange({ ...EMPTY_FILTER, period: filter.period })}
          >
            {strings.operations.reset}
          </Button>
        )}

        {operations === undefined ? (
          <p className="py-4 text-sm text-muted-foreground">{strings.common.loading}</p>
        ) : operations.rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground" data-testid="operations-empty">
            {operations.inPeriod === 0 ? strings.operations.empty : strings.operations.notFound}
          </p>
        ) : (
          <>
            <ul>
              {operations.rows.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-b-0"
                  data-testid="operation-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{describe(transaction)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {transaction.date} · {strings.operations.kinds[transaction.kind]}
                      {transaction.note ? ` · ${transaction.note}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 text-sm font-semibold tabular-nums">
                      {signOf(transaction.kind)}
                      {formatMinor(transaction.amountMinor, { withCurrency: false, fractionDigits: 0 })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${strings.common.edit}: ${describe(transaction)}`}
                      data-testid={`edit-${transaction.id}`}
                      onClick={() => onEdit(transaction)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${strings.common.delete}: ${describe(transaction)}`}
                      onClick={() => onDelete(transaction)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {operations.found > operations.rows.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" data-testid="show-more" onClick={onShowMore}>
                  {strings.operations.showMore}
                </Button>
                <span className="text-xs text-muted-foreground" data-testid="operations-shown">
                  {fill(strings.operations.shown, {
                    shown: String(Math.min(limit, operations.rows.length)),
                    found: String(operations.found),
                  })}
                </span>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
