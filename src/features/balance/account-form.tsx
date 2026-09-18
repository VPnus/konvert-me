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
import { LIABILITY_TYPES, assetTypesFor, type Account, type AccountType } from '@/db/models';
import { createAccount, isLiquidByDefault, updateAccount } from '@/db/repositories/accounts';
import { strings } from '@/i18n';
import { currentCountry } from '@/i18n/country';
import { inCurrency } from '@/i18n/format';

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
  statementDay: string;
  minPaymentRate: string;
  freeTransfers: string;
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
      statementDay: account.statementDay ? String(account.statementDay) : '',
      minPaymentRate: percent(account.minPaymentRate),
      freeTransfers: account.freeTransfersMinor ? String(minorToRubles(account.freeTransfersMinor)) : '',
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
    statementDay: '',
    minPaymentRate: '',
    freeTransfers: '',
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

    const card = state.side === 'liability' && state.type === 'credit_card';
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
      // a card with a statement every month has no one date of grace
      gracePeriodEnd:
        state.side === 'liability' && state.gracePeriodEnd && !(card && state.statementDay)
          ? state.gracePeriodEnd
          : undefined,
      statementDay: card && state.statementDay ? Number(state.statementDay) : undefined,
      minPaymentRate:
        card && state.minPaymentRate ? parseNumericInput(state.minPaymentRate) / 100 : undefined,
      freeTransfersMinor:
        card && state.freeTransfers ? rublesToMinor(parseNumericInput(state.freeTransfers)) : undefined,
      note: state.note.trim() || undefined,
    };

    try {
      if (account) await updateAccount(account.id, payload);
      else await createAccount(payload);
      onOpenChange(false);
      setState(initialState());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  const types = state.side === 'asset' ? assetTypesFor(currentCountry()) : LIABILITY_TYPES;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
          <Dialog.Title className="text-base font-semibold">
            {account ? strings.accounts.editTitle : strings.accounts.addTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {strings.accounts.openingBalanceHint}
          </Dialog.Description>

          <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <Field label={strings.accounts.name}>
              {(id) => (
                <Input
                  id={id}
                  value={state.name}
                  required
                  autoFocus
                  placeholder={strings.accounts.namePlaceholder}
                  data-testid="account-name"
                  onChange={(event) => patch({ name: event.target.value })}
                />
              )}
            </Field>

            <Field label={strings.accounts.side}>
              {(id) => (
                <Select
                  id={id}
                  value={state.side}
                  data-testid="account-side"
                  onChange={(event) => changeSide(event.target.value as Account['side'])}
                >
                  <option value="asset">{strings.accounts.sideAsset}</option>
                  <option value="liability">{strings.accounts.sideLiability}</option>
                </Select>
              )}
            </Field>

            <Field label={strings.accounts.type}>
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
                      {strings.accounts.types[type]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={inCurrency(
                  state.side === 'asset' ? strings.accounts.openingBalance : strings.accounts.debtBalance,
                )}
              >
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

              <Field label={strings.accounts.openingDate} hint={strings.accounts.openingDateHint}>
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
                {strings.accounts.isLiquid}
              </label>
            ) : state.type === 'credit_card' ? (
              <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-medium">{strings.accounts.cardTerms}</legend>
                <p className="text-xs text-muted-foreground">{strings.accounts.cardTermsHint}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={strings.accounts.cardRate} hint={strings.accounts.cardRateHint}>
                    {(id) => (
                      <NumberInput
                        id={id}
                        value={state.rate}
                        data-testid="account-rate"
                        onValueChange={(rate) => patch({ rate })}
                      />
                    )}
                  </Field>

                  <Field label={inCurrency(strings.accounts.creditLimit)}>
                    {(id) => (
                      <NumberInput
                        id={id}
                        value={state.creditLimit}
                        data-testid="account-credit-limit"
                        onValueChange={(creditLimit) => patch({ creditLimit })}
                      />
                    )}
                  </Field>

                  <Field label={strings.accounts.statementDay} hint={strings.accounts.statementDayHint}>
                    {(id) => (
                      <NumberInput
                        id={id}
                        integer
                        maxLength={2}
                        value={state.statementDay}
                        placeholder={strings.accounts.statementDayNone}
                        data-testid="account-statement-day"
                        onValueChange={(statementDay) => patch({ statementDay })}
                      />
                    )}
                  </Field>

                  <Field label={strings.accounts.cardPaymentDay} hint={strings.accounts.cardPaymentDayHint}>
                    {(id) => (
                      <NumberInput
                        id={id}
                        integer
                        maxLength={2}
                        value={state.paymentDay}
                        placeholder={strings.accounts.paymentDayNone}
                        data-testid="account-payment-day"
                        onValueChange={(paymentDay) => patch({ paymentDay })}
                      />
                    )}
                  </Field>

                  <Field
                    label={strings.accounts.minPaymentRate}
                    hint={strings.accounts.minPaymentHint[currentCountry()]}
                  >
                    {(id) => (
                      <NumberInput
                        id={id}
                        value={state.minPaymentRate}
                        data-testid="account-min-payment-rate"
                        onValueChange={(minPaymentRate) => patch({ minPaymentRate })}
                      />
                    )}
                  </Field>

                  <Field label={inCurrency(strings.accounts.minPaymentFloor)}>
                    {(id) => (
                      <NumberInput
                        id={id}
                        value={state.monthlyPayment}
                        data-testid="account-payment"
                        onValueChange={(monthlyPayment) => patch({ monthlyPayment })}
                      />
                    )}
                  </Field>

                  <Field
                    label={inCurrency(strings.accounts.freeTransfers)}
                    hint={strings.accounts.freeTransfersHint}
                  >
                    {(id) => (
                      <NumberInput
                        id={id}
                        value={state.freeTransfers}
                        data-testid="account-free-transfers"
                        onValueChange={(freeTransfers) => patch({ freeTransfers })}
                      />
                    )}
                  </Field>

                  {state.statementDay ? null : (
                    <Field label={strings.accounts.gracePeriodEnd} hint={strings.accounts.graceHint}>
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
                  )}
                </div>
              </fieldset>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={`${strings.accounts.rate} (${strings.common.optional})`}
                  hint={strings.accounts.debtRateHint}
                >
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={state.rate}
                      data-testid="account-rate"
                      onValueChange={(rate) => patch({ rate })}
                    />
                  )}
                </Field>

                <Field label={`${inCurrency(strings.accounts.monthlyPayment)} (${strings.common.optional})`}>
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={state.monthlyPayment}
                      data-testid="account-payment"
                      onValueChange={(monthlyPayment) => patch({ monthlyPayment })}
                    />
                  )}
                </Field>

                <Field label={strings.accounts.paymentDay} hint={strings.accounts.paymentDayHint}>
                  {(id) => (
                    <NumberInput
                      id={id}
                      integer
                      maxLength={2}
                      value={state.paymentDay}
                      placeholder={strings.accounts.paymentDayNone}
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
                  label={`${strings.accounts.bankName} (${strings.common.optional})`}
                  hint={strings.accounts.bankNameHint}
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

                <Field label={`${strings.accounts.rate} (${strings.common.optional})`}>
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
                label={`${strings.accounts.maturityDate} (${strings.common.optional})`}
                hint={strings.accounts.maturityHint}
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

            {state.side === 'liability' && state.type !== 'credit_card' ? (
              <Field
                label={`${strings.accounts.endDate} (${strings.common.optional})`}
                hint={strings.accounts.endDateHint}
              >
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

            <Field label={`${strings.accounts.note} (${strings.common.optional})`}>
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
                  {strings.common.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" size="sm" disabled={busy} data-testid="account-submit">
                {strings.common.save}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
