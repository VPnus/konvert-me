import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { minorToRubles, rublesToMinor } from '@/core/money';
import { GROUP_OF_KIND } from '@/core/tax-accounts';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { NumberInput } from '@/components/ui/number-input';
import type { TaxAccount } from '@/db/models';
import { contributionOfYear, setTaxAccountYear } from '@/db/repositories/tax-accounts';
import { strings } from '@/i18n';
import { parseNumericInput } from '@/lib/numeric-input';
import { inCurrency } from '@/i18n/format';

const t = strings.taxAccounts;

/** An employer puts money into a plan at work and sometimes into an HSA; nowhere else. */
function takesEmployerMoney(account: TaxAccount): boolean {
  const group = GROUP_OF_KIND[account.kind];
  return group === 'deferral' || group === 'hsa';
}

interface AccountRowProps {
  readonly account: TaxAccount;
  readonly year: number;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

/** One account inside a limit: what went into it this year, and who put it there. */
export function AccountRow({ account, year, onEdit, onDelete }: AccountRowProps) {
  const saved = contributionOfYear(account, year);
  const [own, setOwn] = useState(() => (saved.ownMinor ? String(minorToRubles(saved.ownMinor)) : ''));
  const [employer, setEmployer] = useState(() =>
    saved.employerMinor ? String(minorToRubles(saved.employerMinor)) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const amount = (value: string) => (value ? rublesToMinor(parseNumericInput(value)) : 0);
  const changed =
    amount(own) !== saved.ownMinor ||
    (takesEmployerMoney(account) && amount(employer) !== saved.employerMinor);

  const save = async () => {
    setError(null);
    try {
      await setTaxAccountYear(account.id, year, {
        ownMinor: amount(own),
        employerMinor: takesEmployerMoney(account) ? amount(employer) : 0,
      });
      setSavedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 border-t border-border pt-3"
      data-testid={`tax-account-${account.name}`}
      data-saved={savedAt ?? undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{account.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t.kinds[account.kind]}
            {account.catchUp === 'none' ? '' : ` · ${t.catchUps[account.catchUp]}`}
            {account.familyCoverage ? ` · ${t.familyCoverage}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`${strings.common.edit}: ${account.name}`}
            data-testid={`edit-tax-account-${account.name}`}
            onClick={onEdit}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`${t.remove}: ${account.name}`}
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={inCurrency(t.ownAmount)}>
          {(id) => (
            <NumberInput id={id} value={own} data-testid={`tax-own-${account.name}`} onValueChange={setOwn} />
          )}
        </Field>

        {takesEmployerMoney(account) ? (
          <Field label={inCurrency(t.fromEmployer)}>
            {(id) => (
              <NumberInput
                id={id}
                value={employer}
                data-testid={`tax-employer-${account.name}`}
                onValueChange={setEmployer}
              />
            )}
          </Field>
        ) : null}

        <div className="flex items-end">
          <Button
            size="sm"
            disabled={!changed}
            data-testid={`tax-save-${account.name}`}
            onClick={() => void save()}
          >
            {strings.common.save}
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
