import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, CopyPlus } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { addMonths, currentMonth, yearOfMonth, type IsoMonth } from '@/core/time';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Transaction } from '@/db/models';
import { copyPlanFromPreviousMonth } from '@/db/repositories/budget-plans';
import { deleteTransaction } from '@/db/repositories/transactions';
import { loadBudgetMonth, loadBudgetYear } from '@/features/budget/budget-data';
import { loadOperations } from '@/features/budget/operations-data';
import { isCurrentMonth, monthLabel } from '@/features/budget/month-label';
import { CategoriesCard } from '@/features/budget/categories-card';
import { ImportCard } from '@/features/budget/import/import-card';
import { PlanFactTable } from '@/features/budget/plan-fact-table';
import { TransactionForm } from '@/features/budget/transaction-form';
import {
  filterFromSearch,
  filterToSearch,
  readPeriod,
  writePeriod,
  type TransactionFilterState,
} from '@/features/budget/transaction-filter';
import { TransactionsCard } from '@/features/budget/transactions-card';
import { YearTable } from '@/features/budget/year-table';
import { useDataVersion } from '@/hooks/use-data-version';
import { strings } from '@/i18n';

type Tab = 'month' | 'year';

/** How many operations a page of the list holds; "show more" adds another page. */
const PAGE = 50;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState<IsoMonth>(() => currentMonth());
  const [tab, setTab] = useState<Tab>('month');
  const listRef = useRef<HTMLDivElement>(null);
  // The period the device remembers is the fallback of a page opened without one in the address.
  const [remembered] = useState(readPeriod);
  // How much of the answer is shown, and which answer it belongs to: a new filter or another month
  // starts from the first page again, without an effect that sets state after the render.
  const [page, setPage] = useState({ key: '', limit: PAGE });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  // The filter lives in the address: a search can be kept as a link and survives a reload.
  const search = searchParams.toString();
  const filter = useMemo(
    () => filterFromSearch(new URLSearchParams(search), remembered),
    [search, remembered],
  );

  const setFilter = (next: TransactionFilterState) => {
    writePeriod(next.period);
    setSearchParams(filterToSearch(next), { replace: true });
  };

  const pageKey = `${search}|${month}`;
  const limit = page.key === pageKey ? page.limit : PAGE;

  const monthData = useLiveQuery(() => loadBudgetMonth(month, { includeEmpty: true }), [month, dataVersion]);

  const operations = useLiveQuery(
    () => loadOperations({ filter, anchor: month, limit }),
    [search, month, limit, dataVersion],
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
    setCopyNote(
      copied === 0 ? strings.budget.copyEmpty : strings.budget.copied.replace('{count}', String(copied)),
    );
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteTransaction(pendingDelete.id);
      setPendingDelete(null);
      setDeleteError(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : strings.common.error);
    }
  };

  /** A category of the table above filters the list below, and the screen scrolls to it. */
  const pickCategory = (categoryId: string) => {
    setFilter({ ...filter, categoryIds: [categoryId] });
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <h1 className="text-2xl font-semibold tracking-tight">{strings.budget.title}</h1>
        <p className="text-sm text-muted-foreground">{strings.budget.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1" role="tablist" aria-label={strings.budget.title}>
          <Button
            role="tab"
            aria-selected={tab === 'month'}
            variant={tab === 'month' ? 'default' : 'outline'}
            size="sm"
            data-testid="tab-month"
            onClick={() => setTab('month')}
          >
            {strings.budget.monthTab}
          </Button>
          <Button
            role="tab"
            aria-selected={tab === 'year'}
            variant={tab === 'year' ? 'default' : 'outline'}
            size="sm"
            data-testid="tab-year"
            onClick={() => setTab('year')}
          >
            {strings.budget.yearTab}
          </Button>
        </div>

        <PeriodSwitcher
          label={tab === 'year' ? String(year) : monthLabel(month)}
          prevLabel={tab === 'year' ? strings.budget.prevYear : strings.budget.prevMonth}
          nextLabel={tab === 'year' ? strings.budget.nextYear : strings.budget.nextMonth}
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
          {strings.budget.currentMonth}
        </Button>
      )}

      {monthData === undefined ? (
        <p className="text-sm text-muted-foreground">{strings.common.loading}</p>
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
                <p className="text-sm text-muted-foreground">{strings.budget.year.empty}</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">{strings.common.loading}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">{strings.budget.planTitle}</CardTitle>
              <p className="text-sm text-muted-foreground">{strings.budget.planHint}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-auto min-h-9 py-1.5 text-left whitespace-normal"
                  data-testid="copy-plan"
                  onClick={() => void copyPlan()}
                >
                  <CopyPlus className="size-4" aria-hidden />
                  {strings.budget.copyPrev}
                </Button>
                {copyNote ? (
                  <span role="status" className="text-xs text-muted-foreground" data-testid="copy-note">
                    {copyNote}
                  </span>
                ) : null}
              </div>

              <PlanFactTable data={monthData} onPickCategory={pickCategory} />
            </CardContent>
          </Card>

          {monthData.accounts.filter((account) => !account.archived).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 p-5">
                <p className="text-sm text-muted-foreground">{strings.budget.needAccounts}</p>
                <Link to="/balance" className={buttonVariants({ size: 'sm' })}>
                  {strings.budget.needAccountsAction}
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <div ref={listRef}>
                <TransactionsCard
                  categories={monthData.categories}
                  accounts={monthData.accounts}
                  operations={operations}
                  filter={filter}
                  onFilterChange={setFilter}
                  limit={limit}
                  onShowMore={() => setPage({ key: pageKey, limit: limit + PAGE })}
                  onAdd={openAdd}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                />
              </div>

              <ImportCard
                accounts={monthData.accounts.filter((account) => !account.archived)}
                categories={monthData.categories}
              />

              <CategoriesCard />
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
        title={strings.operations.deleteConfirmTitle}
        description={deleteError ?? strings.operations.deleteConfirmText}
        confirmLabel={strings.common.delete}
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
