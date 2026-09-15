import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { formatMinor } from '@/core/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AccountForm } from '@/features/balance/account-form';
import { PaydayCard } from '@/features/balance/payday-card';
import { useDataVersion } from '@/hooks/use-data-version';
import type { Account } from '@/db/models';
import {
  deleteAccount,
  getAccountBalancesMinor,
  listAccounts,
  setAccountArchived,
} from '@/db/repositories/accounts';
import { ru } from '@/i18n/ru';

interface AccountsView {
  readonly accounts: Account[];
  readonly balances: Map<string, number>;
}

const EMPTY_VIEW: AccountsView = { accounts: [], balances: new Map() };

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
        <p className="truncate text-xs text-muted-foreground">
          {ru.accounts.types[account.type]}
          {account.paymentDay ? ` · платёж ${account.paymentDay} числа` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span
          className={`mr-1 text-sm font-semibold tabular-nums ${account.side === 'liability' ? 'text-destructive' : ''}`}
          data-testid={`balance-${account.name}`}
        >
          {formatMinor(balanceMinor, { fractionDigits: 0 })}
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

export default function BalancePage() {
  const dataVersion = useDataVersion();
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const view: AccountsView =
    useLiveQuery(
      async () => ({
        accounts: await listAccounts({ includeArchived: showArchived }),
        balances: await getAccountBalancesMinor(),
      }),
      [showArchived, dataVersion],
    ) ?? EMPTY_VIEW;

  const assets = view.accounts.filter((account) => account.side === 'asset');
  const liabilities = view.accounts.filter((account) => account.side === 'liability');
  const balanceOf = (account: Account): number =>
    view.balances.get(account.id) ?? account.openingBalanceMinor;
  const sum = (list: Account[]): number => list.reduce((total, account) => total + balanceOf(account), 0);
  const netWorthMinor = sum(assets) - sum(liabilities);

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

      <PaydayCard />

      {view.accounts.length === 0 ? (
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
            <CardContent className="pt-2">
              <p
                className={`text-2xl font-semibold tabular-nums ${netWorthMinor < 0 ? 'text-destructive' : ''}`}
                data-testid="net-worth"
              >
                {formatMinor(netWorthMinor, { fractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>

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
        </>
      )}

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
