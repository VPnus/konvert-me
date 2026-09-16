import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, CopyPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { addMonths, currentMonth, yearOfMonth, type IsoMonth } from '@/core/time';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Transaction } from '@/db/models';
import { copyPlanFromPreviousMonth } from '@/db/repositories/budget-plans';
import { deleteTransaction } from '@/db/repositories/transactions';
import { loadBudgetMonth, loadBudgetYear } from '@/features/budget/budget-data';
import { isCurrentMonth, monthLabel } from '@/features/budget/month-label';
import { ImportCard } from '@/features/budget/import/import-card';
import { PlanFactTable } from '@/features/budget/plan-fact-table';
import { TransactionForm } from '@/features/budget/transaction-form';
import { EMPTY_FILTER, type TransactionFilterState } from '@/features/budget/transaction-filter';
import { TransactionsCard } from '@/features/budget/transactions-card';
import { YearTable } from '@/features/budget/year-table';
import { useDataVersion } from '@/hooks/use-data-version';
import { ru } from '@/i18n/ru';

type Tab = 'month' | 'year';

function PeriodSwitcher({
  label,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label={prevLabel} data-testid="period-prev" onClick={onPrev}>
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <span className="min-w-[9.5rem] text-center text-sm font-medium" data-testid="period-label">
        {label}
      </span>
      <Button variant="outline" size="icon" aria-label={nextLabel} data-testid="period-next" onClick={onNext}>
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export default function BudgetPage() {
  const dataVersion = useDataVersion();
  const [month, setMonth] = useState<IsoMonth>(() => currentMonth());
  const [tab, setTab] = useState<Tab>('month');
  const [filter, setFilter] = useState<TransactionFilterState>(EMPTY_FILTER);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  const monthData = useLiveQuery(
    () =>
      loadBudgetMonth(month, {
        includeEmpty: true,
        filter: {
          query: filter.query || undefined,
          kinds: filter.kind ? [filter.kind] : undefined,
          categoryId: filter.categoryId || undefined,
          accountId: filter.accountId || undefined,
        },
      }),
    [month, filter.query, filter.kind, filter.categoryId, filter.accountId, dataVersion],
  );

  const year = yearOfMonth(month);
  const yearData = useLiveQuery(
    () => (tab === 'year' ? loadBudgetYear(year) : Promise.resolve(null)),
    [tab, year, dataVersion],
  );

  const shift = (delta: number) => {
    setMonth(addMonths(month, tab === 'year' ? delta * 12 : delta));
    setCopyNote(null);
  };

  const copyPlan = async () => {
    const copied = await copyPlanFromPreviousMonth(month);
    setCopyNote(copied === 0 ? ru.budget.copyEmpty : ru.budget.copied.replace('{count}', String(copied)));
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteTransaction(pendingDelete.id);
      setPendingDelete(null);
      setDeleteError(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : ru.common.error);
    }
  };

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (transaction: Transaction) => {
    setEditing(transaction);
    setFormOpen(true);
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{ru.budget.title}</h1>
        <p className="text-sm text-muted-foreground">{ru.budget.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1" role="tablist" aria-label={ru.budget.title}>
          <Button
            role="tab"
            aria-selected={tab === 'month'}
            variant={tab === 'month' ? 'default' : 'outline'}
            size="sm"
            data-testid="tab-month"
            onClick={() => setTab('month')}
          >
            {ru.budget.monthTab}
          </Button>
          <Button
            role="tab"
            aria-selected={tab === 'year'}
            variant={tab === 'year' ? 'default' : 'outline'}
            size="sm"
            data-testid="tab-year"
            onClick={() => setTab('year')}
          >
            {ru.budget.yearTab}
          </Button>
        </div>

        <PeriodSwitcher
          label={tab === 'year' ? String(year) : monthLabel(month)}
          prevLabel={tab === 'year' ? ru.budget.prevYear : ru.budget.prevMonth}
          nextLabel={tab === 'year' ? ru.budget.nextYear : ru.budget.nextMonth}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
        />
      </div>

      {isCurrentMonth(month) ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          data-testid="period-today"
          onClick={() => setMonth(currentMonth())}
        >
          {ru.budget.currentMonth}
        </Button>
      )}

      {monthData === undefined ? (
        <p className="text-sm text-muted-foreground">{ru.common.loading}</p>
      ) : tab === 'year' ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">{year}</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {yearData ? (
              yearData.hasAnything ? (
                <YearTable data={yearData} />
              ) : (
                <p className="text-sm text-muted-foreground">{ru.budget.year.empty}</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">{ru.common.loading}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">{ru.budget.planTitle}</CardTitle>
              <p className="text-sm text-muted-foreground">{ru.budget.planHint}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" data-testid="copy-plan" onClick={() => void copyPlan()}>
                  <CopyPlus className="size-4" aria-hidden />
                  {ru.budget.copyPrev}
                </Button>
                {copyNote ? (
                  <span role="status" className="text-xs text-muted-foreground" data-testid="copy-note">
                    {copyNote}
                  </span>
                ) : null}
              </div>

              <PlanFactTable data={monthData} />
            </CardContent>
          </Card>

          {monthData.accounts.filter((account) => !account.archived).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 p-5">
                <p className="text-sm text-muted-foreground">{ru.budget.needAccounts}</p>
                <Link to="/balance" className={buttonVariants({ size: 'sm' })}>
                  {ru.budget.needAccountsAction}
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <TransactionsCard
                data={monthData}
                filter={filter}
                onFilterChange={setFilter}
                onAdd={openAdd}
                onEdit={openEdit}
                onDelete={setPendingDelete}
              />

              <ImportCard
                accounts={monthData.accounts.filter((account) => !account.archived)}
                categories={monthData.categories}
              />
            </>
          )}
        </>
      )}

      {formOpen && monthData ? (
        <TransactionForm
          key={editing?.id ?? 'new'}
          transaction={editing}
          accounts={monthData.accounts.filter((account) => !account.archived)}
          categories={monthData.categories}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={ru.operations.deleteConfirmTitle}
        description={deleteError ?? ru.operations.deleteConfirmText}
        confirmLabel={ru.common.delete}
        destructive
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      />
    </section>
  );
}
