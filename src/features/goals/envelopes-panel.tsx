import { useState } from 'react';

import { formatForecast, minorToRubles, rublesToMinor } from '@/core/money';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import type { Account, Envelope } from '@/db/models';
import { holdsMoney } from '@/db/repositories/accounts';
import { deleteEnvelope, setEnvelope } from '@/db/repositories/goals';
import { strings } from '@/i18n';
import { parseNumericInput } from '@/lib/numeric-input';

interface EnvelopesPanelProps {
  readonly goalId: string;
  readonly envelopes: readonly Envelope[];
  readonly accounts: readonly Account[];
  readonly balances: Map<string, number>;
}

/**
 * Which accounts hold the money of this goal. The invariant lives in the repository —
 * the panel only has to show plainly when it says no.
 */
export function EnvelopesPanel({ goalId, envelopes, accounts, balances }: EnvelopesPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const amountOf = (accountId: string): number =>
    envelopes.find((envelope) => envelope.accountId === accountId)?.amountMinor ?? 0;
  // Money accounts, and a thing only while an envelope of this goal still lies on it, to be emptied.
  const shown = accounts.filter((account) => holdsMoney(account) || amountOf(account.id) > 0);

  const save = async (accountId: string) => {
    const draft = drafts[accountId];
    if (draft === undefined) return;

    const next = draft.trim() === '' ? 0 : rublesToMinor(parseNumericInput(draft));
    setDrafts((current) => {
      const rest = { ...current };
      delete rest[accountId];
      return rest;
    });

    if (next === amountOf(accountId)) return;

    setError(null);
    try {
      if (next === 0) await deleteEnvelope(goalId, accountId);
      else await setEnvelope(goalId, accountId, next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    }
  };

  return (
    <section className="flex flex-col gap-2" data-testid="envelopes">
      <div>
        <h3 className="text-sm font-semibold">{strings.goals.envelopes}</h3>
        <p className="text-xs text-muted-foreground">{strings.goals.envelopesHint}</p>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.goals.envelopeEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((account) => {
            const stored = amountOf(account.id);
            const value = drafts[account.id] ?? (stored === 0 ? '' : String(minorToRubles(stored)));

            return (
              <li
                key={account.id}
                className="flex items-center justify-between gap-2 border-b border-border/60 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{account.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {strings.accounts.balance}: {formatForecast(balances.get(account.id) ?? 0)}
                  </p>
                  {holdsMoney(account) ? null : (
                    <p className="text-xs text-warning" data-testid={`envelope-not-money-${account.name}`}>
                      {strings.goals.envelopeNotMoney}
                    </p>
                  )}
                </div>

                <NumberInput
                  value={value}
                  aria-label={`${strings.goals.envelopeAmount}: ${account.name}`}
                  data-testid={`envelope-${account.name}`}
                  className="h-9 w-32 text-right tabular-nums"
                  onValueChange={(next) => setDrafts((current) => ({ ...current, [account.id]: next }))}
                  onBlur={() => void save(account.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p role="alert" className="text-xs text-destructive" data-testid="envelope-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

interface ContributeFormProps {
  readonly accounts: readonly Account[];
  readonly onContribute: (input: {
    amountMinor: number;
    accountId: string;
    fromAccountId?: string;
  }) => Promise<void>;
}

/** Putting money in: a transfer plus a bigger envelope, never an expense. Only between accounts of money. */
export function ContributeForm({ accounts: all, onContribute }: ContributeFormProps) {
  const accounts = all.filter(holdsMoney);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [fromAccountId, setFromAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await onContribute({
        amountMinor: rublesToMinor(parseNumericInput(amount)),
        accountId: accountId || (accounts[0]?.id ?? ''),
        fromAccountId: fromAccountId || undefined,
      });
      setAmount('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  if (accounts.length === 0) return null;

  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => void submit(event)} data-testid="contribute">
      <div>
        <h3 className="text-sm font-semibold">{strings.goals.contribute}</h3>
        <p className="text-xs text-muted-foreground">{strings.goals.contributeHint}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <NumberInput
          required
          value={amount}
          aria-label={strings.goals.contributeAmount}
          placeholder={strings.goals.contributeAmount}
          data-testid="contribute-amount"
          onValueChange={setAmount}
        />

        <select
          value={accountId}
          aria-label={strings.goals.contributeTo}
          data-testid="contribute-to"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(event) => setAccountId(event.target.value)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>

        <select
          value={fromAccountId}
          aria-label={strings.goals.contributeFrom}
          data-testid="contribute-from"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          onChange={(event) => setFromAccountId(event.target.value)}
        >
          <option value="">{strings.goals.contributeFromNone}</option>
          {accounts
            .filter((account) => account.id !== accountId)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive" data-testid="contribute-error">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="sm" className="w-fit" disabled={busy} data-testid="contribute-save">
        {strings.goals.contribute}
      </Button>
    </form>
  );
}
