import * as Dialog from '@radix-ui/react-dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { CreditCard } from 'lucide-react';
import { useState } from 'react';

import { minorToRubles, rublesToMinor } from '@/core/money';
import { todayIso } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import type { Account, Category, Transaction } from '@/db/models';
import { createTransaction, updateTransaction } from '@/db/repositories/transactions';
import { cardTransferWarning, loadCardTransfer } from '@/features/budget/card-transfer';
import { ru } from '@/i18n/ru';
import { parseNumericInput } from '@/lib/numeric-input';

type Kind = Transaction['kind'];

const KINDS: readonly Kind[] = ['expense', 'income', 'refund', 'transfer', 'adjustment', 'revaluation'];

/** Which kinds need a category, a second account or a direction. */
function needsCategory(kind: Kind): boolean {
  return kind === 'income' || kind === 'expense' || kind === 'refund';
}

function needsSecondAccount(kind: Kind): boolean {
  return kind === 'transfer';
}

function needsDirection(kind: Kind): boolean {
  return kind === 'adjustment' || kind === 'revaluation';
}

function categoryKindOf(kind: Kind): Category['kind'] {
  return kind === 'income' ? 'income' : 'expense';
}

interface FormState {
  kind: Kind;
  date: string;
  amount: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  direction: 'increase' | 'decrease';
  note: string;
}

/** A new operation filled in advance, for the person to check and save: the interest of an account. */
export interface TransactionDraft {
  readonly kind: Kind;
  readonly date: string;
  readonly amountMinor: number;
  readonly accountId: string;
  readonly categoryId?: string;
  readonly note?: string;
}

function initialState(
  accounts: readonly Account[],
  transaction?: Transaction,
  draft?: TransactionDraft,
): FormState {
  if (draft) {
    return {
      kind: draft.kind,
      date: draft.date,
      amount: String(minorToRubles(draft.amountMinor)),
      accountId: draft.accountId,
      toAccountId: '',
      categoryId: draft.categoryId ?? '',
      direction: 'increase',
      note: draft.note ?? '',
    };
  }

  if (transaction) {
    return {
      kind: transaction.kind,
      date: transaction.date,
      amount: String(minorToRubles(transaction.amountMinor)),
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId ?? '',
      categoryId: transaction.categoryId ?? '',
      direction: transaction.direction ?? 'increase',
      note: transaction.note ?? '',
    };
  }

  return {
    kind: 'expense',
    date: todayIso(),
    amount: '',
    accountId: accounts[0]?.id ?? '',
    toAccountId: accounts[1]?.id ?? '',
    categoryId: '',
    direction: 'increase',
    note: '',
  };
}

interface TransactionFormProps {
  readonly transaction?: Transaction;
  readonly draft?: TransactionDraft;
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** One dialog for all six kinds of operation: the fields follow the kind. */
export function TransactionForm({
  transaction,
  draft,
  accounts,
  categories,
  open,
  onOpenChange,
}: TransactionFormProps) {
  const [state, setState] = useState<FormState>(() => initialState(accounts, transaction, draft));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (next: Partial<FormState>) => setState((current) => ({ ...current, ...next }));

  const visibleCategories = categories.filter((category) => category.kind === categoryKindOf(state.kind));
  const chosenCategory = needsCategory(state.kind)
    ? state.categoryId || (visibleCategories[0]?.id ?? '')
    : '';
  const otherAccounts = accounts.filter((account) => account.id !== state.accountId);
  const chosenToAccount = needsSecondAccount(state.kind)
    ? state.toAccountId && state.toAccountId !== state.accountId
      ? state.toAccountId
      : (otherAccounts[0]?.id ?? '')
    : '';

  // A new transfer from a credit card is money borrowed: the form says when it has to come back.
  const source = accounts.find((account) => account.id === state.accountId);
  const fromCard =
    !transaction &&
    state.kind === 'transfer' &&
    source?.side === 'liability' &&
    source.type === 'credit_card';
  const cardContext = useLiveQuery(
    () => (fromCard && state.date ? loadCardTransfer(state.accountId, state.date) : Promise.resolve(null)),
    [fromCard, state.accountId, state.date],
  );
  const cardWarning =
    fromCard && cardContext && state.date
      ? cardTransferWarning(
          cardContext,
          state.amount ? rublesToMinor(parseNumericInput(state.amount)) : 0,
          accounts.find((account) => account.id === chosenToAccount),
          state.date,
        )
      : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      date: state.date,
      amountMinor: rublesToMinor(parseNumericInput(state.amount)),
      kind: state.kind,
      accountId: state.accountId,
      toAccountId: needsSecondAccount(state.kind) ? chosenToAccount : undefined,
      categoryId: needsCategory(state.kind) ? chosenCategory : undefined,
      direction: needsDirection(state.kind) ? state.direction : undefined,
      note: state.note.trim() || undefined,
    };

    try {
      if (transaction) await updateTransaction(transaction.id, payload);
      else await createTransaction(payload);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
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
            {transaction ? ru.operations.editTitle : ru.operations.addTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {ru.operations.kindHints[state.kind]}
          </Dialog.Description>

          <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <Field label={ru.operations.kind}>
              {(id) => (
                <Select
                  id={id}
                  value={state.kind}
                  data-testid="transaction-kind"
                  onChange={(event) => patch({ kind: event.target.value as Kind, categoryId: '' })}
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {ru.operations.kinds[kind]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={ru.operations.amount}>
                {(id) => (
                  <NumberInput
                    id={id}
                    required
                    value={state.amount}
                    data-testid="transaction-amount"
                    onValueChange={(amount) => patch({ amount })}
                  />
                )}
              </Field>

              <Field label={ru.operations.date}>
                {(id) => (
                  <Input
                    id={id}
                    required
                    type="date"
                    value={state.date}
                    data-testid="transaction-date"
                    onChange={(event) => patch({ date: event.target.value })}
                  />
                )}
              </Field>
            </div>

            <Field label={needsSecondAccount(state.kind) ? ru.operations.accountFrom : ru.operations.account}>
              {(id) => (
                <Select
                  id={id}
                  value={state.accountId}
                  required
                  data-testid="transaction-account"
                  onChange={(event) => patch({ accountId: event.target.value })}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {needsSecondAccount(state.kind) ? (
              <Field label={ru.operations.accountTo}>
                {(id) => (
                  <Select
                    id={id}
                    value={chosenToAccount}
                    required
                    data-testid="transaction-to-account"
                    onChange={(event) => patch({ toAccountId: event.target.value })}
                  >
                    {otherAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}

            {cardWarning ? (
              <div
                role="note"
                data-testid="card-transfer-warning"
                className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
              >
                <CreditCard className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{ru.cards.transfer.title}</p>
                  {cardWarning.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ) : null}

            {needsCategory(state.kind) ? (
              <Field
                label={ru.operations.category}
                error={visibleCategories.length === 0 ? ru.operations.noCategories : undefined}
              >
                {(id) => (
                  <Select
                    id={id}
                    value={chosenCategory}
                    required
                    data-testid="transaction-category"
                    onChange={(event) => patch({ categoryId: event.target.value })}
                  >
                    {visibleCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}

            {needsDirection(state.kind) ? (
              <Field label={ru.operations.direction}>
                {(id) => (
                  <Select
                    id={id}
                    value={state.direction}
                    data-testid="transaction-direction"
                    onChange={(event) => patch({ direction: event.target.value as FormState['direction'] })}
                  >
                    <option value="increase">{ru.operations.directionIncrease}</option>
                    <option value="decrease">{ru.operations.directionDecrease}</option>
                  </Select>
                )}
              </Field>
            ) : null}

            <Field label={`${ru.operations.note} (${ru.common.optional})`}>
              {(id) => (
                <Input
                  id={id}
                  value={state.note}
                  maxLength={200}
                  placeholder={ru.operations.notePlaceholder}
                  data-testid="transaction-note"
                  onChange={(event) => patch({ note: event.target.value })}
                />
              )}
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-destructive" data-testid="transaction-error">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" size="sm">
                  {ru.common.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" size="sm" disabled={busy} data-testid="transaction-save">
                {ru.common.save}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
