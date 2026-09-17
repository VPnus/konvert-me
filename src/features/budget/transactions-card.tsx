import { Pencil, Plus, Trash2 } from 'lucide-react';

import { formatMinor } from '@/core/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Transaction } from '@/db/models';
import type { BudgetMonthData } from '@/features/budget/budget-data';
import {
  EMPTY_FILTER,
  isFilterEmpty,
  type TransactionFilterState,
} from '@/features/budget/transaction-filter';
import { strings } from '@/i18n';

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

interface TransactionsCardProps {
  readonly data: BudgetMonthData;
  readonly filter: TransactionFilterState;
  readonly onFilterChange: (filter: TransactionFilterState) => void;
  readonly onAdd: () => void;
  readonly onEdit: (transaction: Transaction) => void;
  readonly onDelete: (transaction: Transaction) => void;
}

export function TransactionsCard({
  data,
  filter,
  onFilterChange,
  onAdd,
  onEdit,
  onDelete,
}: TransactionsCardProps) {
  const nameOfCategory = new Map(data.categories.map((category) => [category.id, category.name]));
  const nameOfAccount = new Map(data.accounts.map((account) => [account.id, account.name]));
  const patch = (next: Partial<TransactionFilterState>) => onFilterChange({ ...filter, ...next });

  const describe = (transaction: Transaction): string => {
    if (transaction.kind === 'transfer') {
      const from = nameOfAccount.get(transaction.accountId) ?? '—';
      const to = transaction.toAccountId ? (nameOfAccount.get(transaction.toAccountId) ?? '—') : '—';
      return `${from} → ${to}`;
    }
    if (transaction.categoryId) return nameOfCategory.get(transaction.categoryId) ?? '—';
    return nameOfAccount.get(transaction.accountId) ?? '—';
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{strings.operations.title}</CardTitle>
          <p className="text-sm text-muted-foreground" data-testid="operations-count">
            {strings.operations.count}: {data.totalCount}
          </p>
        </div>
        <Button size="sm" onClick={onAdd} data-testid="add-transaction">
          <Plus className="size-4" aria-hidden />
          {strings.common.add}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <Input
          value={filter.query}
          type="search"
          aria-label={strings.operations.search}
          placeholder={strings.operations.search}
          data-testid="operations-search"
          onChange={(event) => patch({ query: event.target.value })}
        />

        <div className="grid gap-2 sm:grid-cols-3">
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

          <Select
            value={filter.categoryId}
            aria-label={strings.operations.category}
            data-testid="filter-category"
            onChange={(event) => patch({ categoryId: event.target.value })}
          >
            <option value="">{strings.operations.allCategories}</option>
            {data.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <Select
            value={filter.accountId}
            aria-label={strings.operations.account}
            data-testid="filter-account"
            onChange={(event) => patch({ accountId: event.target.value })}
          >
            <option value="">{strings.operations.allAccounts}</option>
            {data.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>

        {isFilterEmpty(filter) ? null : (
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            data-testid="filter-reset"
            onClick={() => onFilterChange(EMPTY_FILTER)}
          >
            {strings.operations.reset}
          </Button>
        )}

        {data.transactions.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground" data-testid="operations-empty">
            {data.totalCount === 0 ? strings.operations.empty : strings.operations.notFound}
          </p>
        ) : (
          <ul>
            {data.transactions.map((transaction) => (
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
        )}
      </CardContent>
    </Card>
  );
}
