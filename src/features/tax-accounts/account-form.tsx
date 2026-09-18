import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { GROUP_OF_KIND, TAX_ACCOUNT_KINDS, type CatchUp, type TaxAccountKind } from '@/core/tax-accounts';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import type { TaxAccount } from '@/db/models';
import { createTaxAccount, updateTaxAccount } from '@/db/repositories/tax-accounts';
import { strings } from '@/i18n';
import { parseNumericInput } from '@/lib/numeric-input';

const t = strings.taxAccounts;

interface FormState {
  name: string;
  kind: TaxAccountKind;
  catchUp: CatchUp;
  familyCoverage: boolean;
  matchShare: string;
  matchUpTo: string;
}

const EMPTY: FormState = {
  name: '',
  kind: '401k',
  catchUp: 'none',
  familyCoverage: false,
  matchShare: '',
  matchUpTo: '',
};

function percent(rate: number | undefined): string {
  return rate === undefined ? '' : String(Math.round(rate * 1000) / 10);
}

function formOf(account: TaxAccount): FormState {
  return {
    name: account.name,
    kind: account.kind,
    catchUp: account.catchUp,
    familyCoverage: account.familyCoverage,
    matchShare: percent(account.matchShare),
    matchUpTo: percent(account.matchUpToShareOfPay),
  };
}

interface AccountFormProps {
  readonly account?: TaxAccount;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** A tax advantaged account: what it is, and what the employer adds to it. */
export function TaxAccountForm({ account, open, onOpenChange }: AccountFormProps) {
  const [state, setState] = useState<FormState>(() => (account ? formOf(account) : EMPTY));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (change: Partial<FormState>) => setState((current) => ({ ...current, ...change }));
  const group = GROUP_OF_KIND[state.kind];
  const rate = (value: string) => (value ? parseNumericInput(value) / 100 : undefined);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const payload = {
      name: state.name,
      kind: state.kind,
      catchUp: state.catchUp,
      familyCoverage: group === 'hsa' ? state.familyCoverage : false,
      matchShare: group === 'deferral' ? rate(state.matchShare) : undefined,
      matchUpToShareOfPay: group === 'deferral' ? rate(state.matchUpTo) : undefined,
    };

    try {
      if (account) await updateTaxAccount(account.id, payload);
      else await createTaxAccount(payload);
      onOpenChange(false);
      setState(EMPTY);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
          <Dialog.Title className="text-base font-semibold">
            {account ? t.editTitle : t.addTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">{t.formHint}</Dialog.Description>

          <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <Field label={t.name}>
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={60}
                  value={state.name}
                  placeholder={t.namePlaceholder}
                  data-testid="tax-account-name"
                  onChange={(event) => patch({ name: event.target.value })}
                />
              )}
            </Field>

            <Field label={t.kind}>
              {(id) => (
                <Select
                  id={id}
                  value={state.kind}
                  data-testid="tax-account-kind"
                  onChange={(event) => patch({ kind: event.target.value as TaxAccountKind })}
                >
                  {TAX_ACCOUNT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t.kinds[kind]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={t.catchUp} hint={t.catchUpHint}>
              {(id) => (
                <Select
                  id={id}
                  value={state.catchUp}
                  data-testid="tax-account-catch-up"
                  onChange={(event) => patch({ catchUp: event.target.value as CatchUp })}
                >
                  <option value="none">{t.catchUps.none}</option>
                  <option value="standard">{t.catchUps.standard}</option>
                  {group === 'deferral' ? <option value="enhanced">{t.catchUps.enhanced}</option> : null}
                </Select>
              )}
            </Field>

            {group === 'hsa' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={state.familyCoverage}
                  data-testid="tax-account-family"
                  onChange={(event) => patch({ familyCoverage: event.target.checked })}
                />
                {t.familyCoverage}
              </label>
            ) : null}

            {group === 'deferral' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t.matchShare} hint={t.matchHint}>
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={state.matchShare}
                      data-testid="tax-account-match-share"
                      onValueChange={(matchShare) => patch({ matchShare })}
                    />
                  )}
                </Field>
                <Field label={t.matchUpTo}>
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={state.matchUpTo}
                      data-testid="tax-account-match-up-to"
                      onValueChange={(matchUpTo) => patch({ matchUpTo })}
                    />
                  )}
                </Field>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-destructive" data-testid="tax-account-error">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={busy} data-testid="tax-account-save">
                {strings.common.save}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {strings.common.cancel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
