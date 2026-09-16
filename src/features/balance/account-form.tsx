import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { minorToRubles, rublesToMinor } from '@/core/money';
import { parseNumericInput } from '@/lib/numeric-input';
import { todayIso } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import { ASSET_TYPES, LIABILITY_TYPES, type Account, type AccountType } from '@/db/models';
import { createAccount, isLiquidByDefault, updateAccount } from '@/db/repositories/accounts';
import { ru } from '@/i18n/ru';

interface AccountFormProps {
  readonly account?: Account;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  side: Account['side'];
  type: AccountType;
  balance: string;
  openingDate: string;
  isLiquid: boolean;
  monthlyPayment: string;
  paymentDay: string;
  bankName: string;
  rate: string;
  maturityDate: string;
  endDate: string;
  creditLimit: string;
  gracePeriodEnd: string;
  note: string;
}

/** Deposits and savings are insured; a brokerage account or a flat is not. */
const INSURABLE_TYPES: readonly AccountType[] = ['debit', 'savings', 'deposit', 'cash'];

function percent(rate: number | undefined): string {
  return rate === undefined ? '' : String(Math.round(rate * 1000) / 10);
}

function initialState(account?: Account): FormState {
  if (account) {
    return {
      name: account.name,
      side: account.side,
      type: account.type,
      balance: String(minorToRubles(account.openingBalanceMinor)),
      openingDate: account.openingDate,
      isLiquid: account.isLiquid,
      monthlyPayment: account.monthlyPaymentMinor ? String(minorToRubles(account.monthlyPaymentMinor)) : '',
      paymentDay: account.paymentDay ? String(account.paymentDay) : '',
      bankName: account.bankName ?? '',
      rate: percent(account.rate),
      maturityDate: account.maturityDate ?? '',
      endDate: account.endDate ?? '',
      creditLimit: account.creditLimitMinor ? String(minorToRubles(account.creditLimitMinor)) : '',
      gracePeriodEnd: account.gracePeriodEnd ?? '',
      note: account.note ?? '',
    };
  }

  return {
    name: '',
    side: 'asset',
    type: 'debit',
    balance: '',
    openingDate: todayIso(),
    isLiquid: true,
    monthlyPayment: '',
    paymentDay: '',
    bankName: '',
    rate: '',
    maturityDate: '',
    endDate: '',
    creditLimit: '',
    gracePeriodEnd: '',
    note: '',
  };
}

export function AccountForm({ account, open, onOpenChange }: AccountFormProps) {
  const [state, setState] = useState<FormState>(() => initialState(account));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (next: Partial<FormState>) => setState((current) => ({ ...current, ...next }));

  const changeSide = (side: Account['side']) => {
    const type = side === 'asset' ? 'debit' : 'credit_card';
    patch({ side, type, isLiquid: isLiquidByDefault(type) });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      name: state.name,
      side: state.side,
      type: state.type,
      openingBalanceMinor: rublesToMinor(parseNumericInput(state.balance)),
      openingDate: state.openingDate,
      isLiquid: state.side === 'asset' ? state.isLiquid : false,
      monthlyPaymentMinor:
        state.side === 'liability' && state.monthlyPayment
          ? rublesToMinor(parseNumericInput(state.monthlyPayment))
          : undefined,
      paymentDay: state.side === 'liability' && state.paymentDay ? Number(state.paymentDay) : undefined,
      bankName: state.bankName.trim() || undefined,
      rate: state.rate ? parseNumericInput(state.rate) / 100 : undefined,
      maturityDate: state.side === 'asset' && state.maturityDate ? state.maturityDate : undefined,
      endDate: state.side === 'liability' && state.endDate ? state.endDate : undefined,
      creditLimitMinor:
        state.side === 'liability' && state.creditLimit
          ? rublesToMinor(parseNumericInput(state.creditLimit))
          : undefined,
      gracePeriodEnd: state.side === 'liability' && state.gracePeriodEnd ? state.gracePeriodEnd : undefined,
      note: state.note.trim() || undefined,
    };

    try {
      if (account) await updateAccount(account.id, payload);
      else await createAccount(payload);
      onOpenChange(false);
      setState(initialState());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    } finally {
      setBusy(false);
    }
  };

  const types = state.side === 'asset' ? ASSET_TYPES : LIABILITY_TYPES;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
          <Dialog.Title className="text-base font-semibold">
            {account ? ru.accounts.editTitle : ru.accounts.addTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {ru.accounts.openingBalanceHint}
          </Dialog.Description>

          <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <Field label={ru.accounts.name}>
              {(id) => (
                <Input
                  id={id}
                  value={state.name}
                  required
                  autoFocus
                  placeholder={ru.accounts.namePlaceholder}
                  data-testid="account-name"
                  onChange={(event) => patch({ name: event.target.value })}
                />
              )}
            </Field>

            <Field label={ru.accounts.side}>
              {(id) => (
                <Select
                  id={id}
                  value={state.side}
                  data-testid="account-side"
                  onChange={(event) => changeSide(event.target.value as Account['side'])}
                >
                  <option value="asset">{ru.accounts.sideAsset}</option>
                  <option value="liability">{ru.accounts.sideLiability}</option>
                </Select>
              )}
            </Field>

            <Field label={ru.accounts.type}>
              {(id) => (
                <Select
                  id={id}
                  value={state.type}
                  data-testid="account-type"
                  onChange={(event) => {
                    const type = event.target.value as AccountType;
                    patch({ type, isLiquid: state.side === 'asset' ? isLiquidByDefault(type) : false });
                  }}
                >
                  {types.map((type) => (
                    <option key={type} value={type}>
                      {ru.accounts.types[type]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={state.side === 'asset' ? ru.accounts.openingBalance : ru.accounts.debtBalance}>
                {(id) => (
                  <NumberInput
                    id={id}
                    value={state.balance}
                    required
                    data-testid="account-balance"
                    onValueChange={(balance) => patch({ balance })}
                  />
                )}
              </Field>

              <Field label={ru.accounts.openingDate} hint={ru.accounts.openingDateHint}>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={state.openingDate}
                    required
                    data-testid="account-date"
                    onChange={(event) => patch({ openingDate: event.target.value })}
                  />
                )}
              </Field>
            </div>

            {state.side === 'asset' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.isLiquid}
                  className="size-4 accent-[var(--color-primary)]"
                  data-testid="account-liquid"
                  onChange={(event) => patch({ isLiquid: event.target.checked })}
                />
                {ru.accounts.isLiquid}
              </label>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`${ru.accounts.rate} (${ru.common.optional})`} hint={ru.accounts.debtRateHint}>
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={state.rate}
                      data-testid="account-rate"
                      onValueChange={(rate) => patch({ rate })}
                    />
                  )}
                </Field>

                <Field label={`${ru.accounts.monthlyPayment} (${ru.common.optional})`}>
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={state.monthlyPayment}
                      data-testid="account-payment"
                      onValueChange={(monthlyPayment) => patch({ monthlyPayment })}
                    />
                  )}
                </Field>

                <Field label={ru.accounts.paymentDay} hint={ru.accounts.paymentDayHint}>
                  {(id) => (
                    <NumberInput
                      id={id}
                      integer
                      maxLength={2}
                      value={state.paymentDay}
                      placeholder={ru.accounts.paymentDayNone}
                      data-testid="account-payment-day"
                      onValueChange={(paymentDay) => patch({ paymentDay })}
                    />
                  )}
                </Field>
              </div>
            )}

            {state.side === 'asset' && INSURABLE_TYPES.includes(state.type) ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={`${ru.accounts.bankName} (${ru.common.optional})`}
                  hint={ru.accounts.bankNameHint}
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={state.bankName}
                      data-testid="account-bank"
                      onChange={(event) => patch({ bankName: event.target.value })}
                    />
                  )}
                </Field>

                <Field label={`${ru.accounts.rate} (${ru.common.optional})`}>
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={state.rate}
                      data-testid="account-rate"
                      onValueChange={(rate) => patch({ rate })}
                    />
                  )}
                </Field>
              </div>
            ) : null}

            {state.type === 'deposit' ? (
              <Field
                label={`${ru.accounts.maturityDate} (${ru.common.optional})`}
                hint={ru.accounts.maturityHint}
              >
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={state.maturityDate}
                    data-testid="account-maturity"
                    onChange={(event) => patch({ maturityDate: event.target.value })}
                  />
                )}
              </Field>
            ) : null}

            {state.type === 'credit_card' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`${ru.accounts.creditLimit} (${ru.common.optional})`}>
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={state.creditLimit}
                      data-testid="account-credit-limit"
                      onValueChange={(creditLimit) => patch({ creditLimit })}
                    />
                  )}
                </Field>

                <Field
                  label={`${ru.accounts.gracePeriodEnd} (${ru.common.optional})`}
                  hint={ru.accounts.graceHint}
                >
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={state.gracePeriodEnd}
                      data-testid="account-grace"
                      onChange={(event) => patch({ gracePeriodEnd: event.target.value })}
                    />
                  )}
                </Field>
              </div>
            ) : null}

            {state.side === 'liability' && state.type !== 'credit_card' ? (
              <Field label={`${ru.accounts.endDate} (${ru.common.optional})`} hint={ru.accounts.endDateHint}>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={state.endDate}
                    data-testid="account-end-date"
                    onChange={(event) => patch({ endDate: event.target.value })}
                  />
                )}
              </Field>
            ) : null}

            <Field label={`${ru.accounts.note} (${ru.common.optional})`}>
              {(id) => (
                <Input
                  id={id}
                  value={state.note}
                  maxLength={200}
                  data-testid="account-note"
                  onChange={(event) => patch({ note: event.target.value })}
                />
              )}
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-destructive" data-testid="account-error">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" size="sm">
                  {ru.common.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" size="sm" disabled={busy} data-testid="account-submit">
                {ru.common.save}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
