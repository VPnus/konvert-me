import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { formatMinor, minorToRubles, rublesToMinor } from '@/core/money';
import type { PaydayOf } from '@/core/payday';
import { todayIso } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import type { IncomeSource } from '@/db/models';
import {
  createIncomeSource,
  deleteIncomeSource,
  listNextPaydays,
  updateIncomeSource,
} from '@/db/repositories/income-sources';
import { useDataVersion } from '@/hooks/use-data-version';
import { ru } from '@/i18n/ru';
import { parseNumericInput } from '@/lib/numeric-input';

/** "через 2 дня" — the Russian plural of a number of days. */
function daysLabel(days: number): string {
  if (days === 0) return ru.income.today;
  if (days === 1) return ru.income.tomorrow;

  const [many, one, few] = ru.income.days;
  const tail = days % 100;
  const last = days % 10;
  const word = tail >= 11 && tail <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;

  return ru.income.inDays.replace('{days}', `${days} ${word}`);
}

const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

function humanDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  // Noon UTC: no time zone can drag the date to the day before.
  return DATE_FORMAT.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

interface FormState {
  name: string;
  day: string;
  amount: string;
}

const EMPTY_FORM: FormState = { name: '', day: '', amount: '' };

function formOf(source: IncomeSource): FormState {
  return {
    name: source.name,
    day: String(source.dayOfMonth),
    amount: source.amountMinor ? String(minorToRubles(source.amountMinor)) : '',
  };
}

/**
 * How long until the money comes in. A source repeats on the same day of every month,
 * so the card shows the nearest payment first and counts the days down to it.
 */
export function PaydayCard() {
  const dataVersion = useDataVersion();
  const paydays = useLiveQuery(() => listNextPaydays(todayIso()), [dataVersion], []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<IncomeSource | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setAdding(true);
  };

  const openEdit = (source: IncomeSource) => {
    setAdding(false);
    setForm(formOf(source));
    setError(null);
    setEditingId(source.id);
  };

  const close = () => {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload = {
      name: form.name,
      dayOfMonth: Number(form.day),
      amountMinor: form.amount ? rublesToMinor(parseNumericInput(form.amount)) : undefined,
    };

    try {
      if (editingId) await updateIncomeSource(editingId, payload);
      else await createIncomeSource(payload);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteIncomeSource(pendingDelete.id);
    setPendingDelete(null);
  };

  const monthTotalMinor = paydays.reduce((total, payday) => total + (payday.source.amountMinor ?? 0), 0);

  const renderForm = () => (
    <form
      className="flex flex-col gap-3 border-t border-border pt-3"
      onSubmit={(event) => void submit(event)}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={ru.income.name}>
          {(id) => (
            <Input
              id={id}
              required
              value={form.name}
              maxLength={60}
              placeholder={ru.income.namePlaceholder}
              data-testid="income-name"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          )}
        </Field>

        <Field label={ru.income.day} hint={ru.income.dayHint}>
          {(id) => (
            <NumberInput
              id={id}
              required
              integer
              value={form.day}
              inputMode="numeric"
              data-testid="income-day"
              onValueChange={(day) => setForm({ ...form, day })}
            />
          )}
        </Field>

        <Field label={ru.income.amount} hint={ru.income.amountHint}>
          {(id) => (
            <NumberInput
              id={id}
              value={form.amount}
              data-testid="income-amount"
              onValueChange={(amount) => setForm({ ...form, amount })}
            />
          )}
        </Field>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive" data-testid="income-error">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" data-testid="income-save">
          {ru.common.save}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={close}>
          {ru.common.cancel}
        </Button>
      </div>
    </form>
  );

  return (
    <Card data-testid="payday-card">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{ru.income.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{ru.income.subtitle}</p>
        </div>
        <Button size="sm" onClick={openAdd} data-testid="add-income-source">
          <Plus className="size-4" aria-hidden />
          {ru.common.add}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {paydays.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground" data-testid="payday-empty">
            {ru.income.empty}
          </p>
        ) : null}

        {paydays.length > 0 ? (
          <ul>
            {paydays.map((payday: PaydayOf<IncomeSource>) => (
              <li
                key={payday.source.id}
                className="flex flex-col gap-2 border-b border-border py-2 last:border-b-0"
                data-testid="payday-row"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payday.source.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {humanDate(payday.date)}
                      {payday.source.amountMinor
                        ? ` · ${formatMinor(payday.source.amountMinor, { fractionDigits: 0 })}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={`mr-1 text-sm font-semibold ${payday.inDays === 0 ? 'text-success' : ''}`}
                      data-testid={`payday-${payday.source.name}`}
                    >
                      {daysLabel(payday.inDays)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${ru.common.edit}: ${payday.source.name}`}
                      data-testid={`edit-income-${payday.source.name}`}
                      onClick={() => openEdit(payday.source)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${ru.income.remove}: ${payday.source.name}`}
                      onClick={() => setPendingDelete(payday.source)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>

                {editingId === payday.source.id ? renderForm() : null}
              </li>
            ))}
          </ul>
        ) : null}

        {monthTotalMinor > 0 ? (
          <p className="text-sm" data-testid="payday-total">
            {ru.income.monthTotal}:{' '}
            <span className="font-semibold tabular-nums">
              {formatMinor(monthTotalMinor, { fractionDigits: 0 })}
            </span>
          </p>
        ) : null}

        {adding ? renderForm() : null}
      </CardContent>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={ru.income.deleteConfirmTitle}
        description={ru.income.deleteConfirmText}
        confirmLabel={ru.common.delete}
        destructive
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />
    </Card>
  );
}
