import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';

import { rublesToMinor } from '@/core/money';
import { todayIso } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { listCategories } from '@/db/repositories/categories';
import { createTransaction } from '@/db/repositories/transactions';
import { ru } from '@/i18n/ru';
import { WidgetEmpty, WidgetFrame } from '@/features/overview/widgets/widget-shell';
import type { WidgetProps } from '@/features/overview/widgets/types';

/** Two taps: an amount and a category. Everything else has a sensible default. */
export function QuickAddWidget({ data }: WidgetProps) {
  const categories = useLiveQuery(() => listCategories(), [], []);
  const accounts = data.accounts.filter((account) => !account.archived && account.side === 'asset');

  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleCategories = categories.filter((category) => category.kind === kind);
  const chosenCategory = categoryId || visibleCategories[0]?.id || '';
  const chosenAccount = accountId || accounts[0]?.id || '';

  if (accounts.length === 0 || categories.length === 0) {
    return (
      <WidgetFrame title={ru.widgets.quickAdd.title}>
        <WidgetEmpty
          text={ru.widgets.quickAdd.empty}
          actionLabel={ru.widgets.quickAdd.emptyAction}
          to="/balance"
        />
      </WidgetFrame>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await createTransaction({
        date: todayIso(),
        amountMinor: rublesToMinor(Number(amount.replace(',', '.'))),
        kind,
        accountId: chosenAccount,
        categoryId: chosenCategory,
      });
      setAmount('');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    }
  };

  return (
    <WidgetFrame title={ru.widgets.quickAdd.title}>
      <form className="flex flex-col gap-2" onSubmit={(event) => void submit(event)}>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={kind === 'expense' ? 'default' : 'outline'}
            aria-pressed={kind === 'expense'}
            onClick={() => {
              setKind('expense');
              setCategoryId('');
            }}
          >
            {ru.widgets.quickAdd.expense}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === 'income' ? 'default' : 'outline'}
            aria-pressed={kind === 'income'}
            onClick={() => {
              setKind('income');
              setCategoryId('');
            }}
          >
            {ru.widgets.quickAdd.income}
          </Button>
        </div>

        <Input
          inputMode="decimal"
          required
          value={amount}
          aria-label={ru.widgets.quickAdd.amount}
          placeholder={ru.widgets.quickAdd.amount}
          data-testid="quick-amount"
          onChange={(event) => setAmount(event.target.value)}
        />

        <Select
          value={chosenCategory}
          aria-label={ru.widgets.quickAdd.category}
          data-testid="quick-category"
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {visibleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        {accounts.length > 1 ? (
          <Select
            value={chosenAccount}
            aria-label={ru.widgets.quickAdd.account}
            data-testid="quick-account"
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        ) : null}

        <Button type="submit" size="sm" data-testid="quick-submit">
          {ru.widgets.quickAdd.submit}
        </Button>

        {saved ? (
          <p role="status" className="text-xs text-success" data-testid="quick-saved">
            {ru.widgets.quickAdd.saved}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </WidgetFrame>
  );
}
