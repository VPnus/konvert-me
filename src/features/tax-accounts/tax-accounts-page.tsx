import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { yearOfMonth, currentMonth } from '@/core/time';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { TaxAccount } from '@/db/models';
import { deleteTaxAccount, loadTaxAccounts } from '@/db/repositories/tax-accounts';
import { TaxAccountForm } from '@/features/tax-accounts/account-form';
import { AccountRow } from '@/features/tax-accounts/account-row';
import { LimitCard } from '@/features/tax-accounts/limit-card';
import { useDataVersion } from '@/hooks/use-data-version';
import { fill, strings } from '@/i18n';

const t = strings.taxAccounts;

export default function TaxAccountsPage() {
  const dataVersion = useDataVersion();
  const thisYear = yearOfMonth(currentMonth());
  const [year, setYear] = useState(thisYear);
  const data = useLiveQuery(() => loadTaxAccounts(year), [dataVersion, year]);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TaxAccount | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaxAccount | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteTaxAccount(pendingDelete.id);
    setPendingDelete(null);
  };

  const byId = new Map((data?.accounts ?? []).map((account) => [account.id, account]));

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{strings.pages.taxAccounts.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button size="sm" data-testid="add-tax-account" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          {strings.common.add}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t.yearsLabel}>
        {[thisYear - 1, thisYear].map((item) => (
          <Button
            key={item}
            role="tab"
            aria-selected={item === year}
            variant={item === year ? 'default' : 'outline'}
            size="sm"
            data-testid={`tax-year-${item}`}
            onClick={() => setYear(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{t.yearHint}</p>

      {!data ? (
        <p className="text-sm text-muted-foreground">{strings.common.loading}</p>
      ) : data.accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="tax-accounts-empty">
          {t.empty}
        </p>
      ) : (
        <>
          {data.rulesYear !== year ? (
            <p className="text-sm text-muted-foreground" data-testid="tax-rules-borrowed">
              {fill(t.rulesBorrowed, { year, rules: data.rulesYear })}
            </p>
          ) : null}

          {data.limits.map((view) => {
            const accounts = view.accountIds.map((id) => byId.get(id)).filter((one) => one !== undefined);
            return (
              <LimitCard key={view.accountIds.join('+')} view={view} accounts={accounts} year={year}>
                {accounts.map((account) => (
                  <AccountRow
                    key={`${account.id}:${year}:${account.updatedAt}`}
                    account={account}
                    year={year}
                    onEdit={() => setEditing(account)}
                    onDelete={() => setPendingDelete(account)}
                  />
                ))}
              </LimitCard>
            );
          })}
        </>
      )}

      {adding ? <TaxAccountForm open onOpenChange={setAdding} /> : null}
      {editing ? (
        <TaxAccountForm
          key={editing.id}
          account={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.deleteConfirmTitle}
        description={t.deleteConfirmText}
        confirmLabel={strings.common.delete}
        destructive
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />
    </section>
  );
}
