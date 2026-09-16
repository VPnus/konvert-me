import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';

import { formatForecast } from '@/core/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { AccountForm } from '@/features/balance/account-form';
import { loadBalance, type BalanceData } from '@/features/balance/balance-data';
import { PaydayCard } from '@/features/balance/payday-card';
import { PoliciesCard } from '@/features/balance/policies-card';
import { useDataVersion } from '@/hooks/use-data-version';
import type { Account } from '@/db/models';
import { deleteAccount, setAccountArchived } from '@/db/repositories/accounts';
import { ru } from '@/i18n/ru';

// Recharts is a chunk of its own: the balance screen is useful long before it draws.
const CapitalChart = lazy(() => import('@/features/balance/capital-chart'));

const RANGES: readonly { readonly months?: number; readonly label: string }[] = [
  { months: 12, label: ru.capital.range12 },
  { months: 24, label: ru.capital.range24 },
  { label: ru.capital.rangeAll },
];

/** The extra line under an account: its type and whatever dates it carries. */
function accountDetails(account: Account): string {
  const parts: string[] = [ru.accounts.types[account.type]];
  if (account.bankName) parts.push(account.bankName);
  if (account.paymentDay) parts.push(`платёж ${account.paymentDay} числа`);
  if (account.maturityDate) parts.push(`${ru.accounts.maturityDate.toLowerCase()} ${account.maturityDate}`);
  if (account.gracePeriodEnd)
    parts.push(`${ru.accounts.gracePeriodEnd.toLowerCase()} ${account.gracePeriodEnd}`);
  if (account.endDate) parts.push(`${ru.accounts.endDate.toLowerCase()} ${account.endDate}`);
  return parts.join(' · ');
}

function AccountRow({
  account,
  balanceMinor,
  onEdit,
  onDelete,
}: {
  account: Account;
  balanceMinor: number;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {account.name}
          {account.archived ? (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {ru.accounts.archived}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{accountDetails(account)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span
          className={`mr-1 text-sm font-semibold tabular-nums ${account.side === 'liability' ? 'text-destructive' : ''}`}
          data-testid={`balance-${account.name}`}
        >
          {formatForecast(balanceMinor)}
        </span>

        <Button variant="ghost" size="icon" aria-label={ru.common.edit} onClick={() => onEdit(account)}>
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={account.archived ? ru.common.unarchive : ru.common.archive}
          onClick={() => void setAccountArchived(account.id, !account.archived)}
        >
          {account.archived ? (
            <ArchiveRestore className="size-4" aria-hidden />
          ) : (
            <Archive className="size-4" aria-hidden />
          )}
        </Button>
        <Button variant="ghost" size="icon" aria-label={ru.common.delete} onClick={() => onDelete(account)}>
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}

function CapitalCard({ data }: { data: BalanceData }) {
  const [months, setMonths] = useState<number | undefined>(12);
  const points = months ? data.series.slice(-months) : data.series;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{ru.capital.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{ru.capital.subtitle}</p>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="mb-2 flex gap-1">
          {RANGES.map((range) => (
            <Button
              key={range.label}
              size="sm"
              variant={range.months === months ? 'default' : 'outline'}
              data-testid={`capital-range-${range.months ?? 'all'}`}
              onClick={() => setMonths(range.months)}
            >
              {range.label}
            </Button>
          ))}
        </div>

        {points.length > 1 ? (
          <ErrorBoundary
            fallback={() => <p className="py-4 text-xs text-muted-foreground">{ru.capital.empty}</p>}
          >
            <Suspense fallback={<p className="py-6 text-xs text-muted-foreground">{ru.common.loading}</p>}>
              <CapitalChart points={points} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <p className="py-4 text-sm text-muted-foreground" data-testid="capital-empty">
            {ru.capital.empty}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function InsuranceCard({ data }: { data: BalanceData }) {
  const limit = data.insuranceLimit;

  return (
    <Card data-testid="insurance-card">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">
          <ShieldCheck className="mr-1 inline size-4" aria-hidden />
          {ru.insurance.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{ru.insurance.subtitle}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-3">
        <p className="text-sm">
          {ru.insurance.limit}: <span className="font-semibold">{formatForecast(limit.value)}</span>
        </p>

        {data.banks.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="insurance-empty">
            {ru.insurance.empty}
          </p>
        ) : (
          <ul>
            {data.banks.map((bank) => (
              <li
                key={bank.bankName}
                className="flex items-center justify-between gap-2 border-b border-border/60 py-2 last:border-b-0"
              >
                <span className="truncate text-sm">{bank.bankName}</span>
                <span
                  className={`shrink-0 text-sm tabular-nums ${bank.overLimit ? 'text-destructive' : ''}`}
                  data-testid={`insurance-${bank.bankName}`}
                >
                  {formatForecast(bank.amountMinor)}
                  {bank.overLimit ? ` · ${ru.insurance.overLimit} ${formatForecast(bank.excessMinor)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}

        {data.banks.length > 0 && data.banks.every((bank) => !bank.overLimit) ? (
          <p className="text-xs text-muted-foreground">{ru.insurance.ok}</p>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          {limit.note} {ru.insurance.source}:{' '}
          <a href={limit.source} target="_blank" rel="noreferrer noopener" className="underline">
            {new URL(limit.source).hostname}
          </a>
          , {ru.insurance.checkedAt} {limit.checkedAt}.
        </p>
      </CardContent>
    </Card>
  );
}

export default function BalancePage() {
  const dataVersion = useDataVersion();
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const data = useLiveQuery(
    () => loadBalance({ includeArchived: showArchived }),
    [showArchived, dataVersion],
  );

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAccount(pendingDelete.id);
      setPendingDelete(null);
      setDeleteError(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : ru.common.error);
    }
  };

  if (!data) {
    return <p className="text-sm text-muted-foreground">{ru.common.loading}</p>;
  }

  const assets = data.accounts.filter((account) => account.side === 'asset');
  const liabilities = data.accounts.filter((account) => account.side === 'liability');
  const balanceOf = (account: Account): number =>
    data.balances.get(account.id) ?? account.openingBalanceMinor;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{ru.accounts.title}</h1>
          <p className="text-sm text-muted-foreground">{ru.accounts.subtitle}</p>
        </div>
        <Button onClick={openCreate} data-testid="add-account">
          <Plus className="size-4" aria-hidden />
          {ru.accounts.add}
        </Button>
      </div>

      {data.accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <p className="text-sm text-muted-foreground">{ru.accounts.empty}</p>
            <Button size="sm" onClick={openCreate}>
              {ru.accounts.emptyAction}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">{ru.accounts.netWorth}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-2">
              <p
                className={`text-2xl font-semibold tabular-nums ${data.netWorthMinor < 0 ? 'text-destructive' : ''}`}
                data-testid="net-worth"
              >
                {formatForecast(data.netWorthMinor)}
              </p>
              <p className="text-xs text-muted-foreground">
                {ru.capital.assets}: {formatForecast(data.assetsMinor)} · {ru.capital.liabilities}:{' '}
                {formatForecast(data.liabilitiesMinor)}
              </p>
            </CardContent>
          </Card>

          <CapitalCard data={data} />
        </>
      )}

      <PaydayCard />

      {assets.length > 0 ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">{ru.accounts.assets}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {assets.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  balanceMinor={balanceOf(account)}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {liabilities.length > 0 ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">{ru.accounts.liabilities}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {liabilities.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  balanceMinor={balanceOf(account)}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <InsuranceCard data={data} />

      <PoliciesCard policies={data.policies} />

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={showArchived}
          className="size-4 accent-[var(--color-primary)]"
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        {ru.accounts.showArchived}
      </label>

      {formOpen ? (
        <AccountForm
          key={editing?.id ?? 'new'}
          account={editing}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={ru.accounts.deleteConfirmTitle}
        description={deleteError ?? ru.accounts.deleteConfirmText}
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
