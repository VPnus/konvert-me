import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { minorToRubles, rublesToMinor } from '@/core/money';
import { addMonths, currentMonth } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import type { AppSettings, Goal } from '@/db/models';
import { createGoal, updateGoal } from '@/db/repositories/goals';
import { ru } from '@/i18n/ru';
import { parseNumericInput } from '@/lib/numeric-input';

/** Every kind but the reserve: the reserve is created once by the app itself. */
const KINDS: readonly Goal['kind'][] = ['purchase', 'education', 'pension', 'other'];

interface FormState {
  name: string;
  kind: Goal['kind'];
  cost: string;
  targetMonth: string;
  returnRate: string;
  inflationRate: string;
  /** Exactly the typed sum by the date: inflation is left out of the calculation. */
  exact: boolean;
  note: string;
}

function percent(rate: number): string {
  return String(Math.round(rate * 1000) / 10);
}

function initialState(settings: AppSettings, goal?: Goal): FormState {
  if (goal) {
    return {
      name: goal.name,
      kind: goal.kind,
      cost: String(minorToRubles(goal.costMinor)),
      targetMonth: goal.targetMonth ?? '',
      returnRate: percent(goal.returnRate),
      inflationRate: percent(goal.inflationRate),
      exact: goal.kind !== 'reserve' && goal.inflationRate === 0,
      note: goal.note ?? '',
    };
  }

  return {
    name: '',
    kind: 'purchase',
    cost: '',
    // Three years ahead is a sensible first guess for a large purchase.
    targetMonth: addMonths(currentMonth(), 36),
    returnRate: percent(settings.defaultReturnRate),
    inflationRate: percent(settings.inflationRate),
    exact: false,
    note: '',
  };
}

interface GoalFormProps {
  readonly goal?: Goal;
  readonly settings: AppSettings;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function GoalForm({ goal, settings, open, onOpenChange }: GoalFormProps) {
  const [state, setState] = useState<FormState>(() => initialState(settings, goal));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isReserve = goal?.kind === 'reserve';
  const patch = (next: Partial<FormState>) => setState((current) => ({ ...current, ...next }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      name: state.name,
      kind: state.kind,
      costMinor: rublesToMinor(parseNumericInput(state.cost)),
      targetMonth: isReserve ? undefined : state.targetMonth,
      returnRate: parseNumericInput(state.returnRate) / 100,
      inflationRate: state.exact ? 0 : parseNumericInput(state.inflationRate) / 100,
      note: state.note.trim() || undefined,
    };

    try {
      if (goal) await updateGoal(goal.id, payload);
      else await createGoal(payload);
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
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
          <Dialog.Title className="text-base font-semibold">
            {goal ? ru.goals.editTitle : ru.goals.addTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {isReserve ? ru.goals.reserveHint : ru.goals.costHint}
          </Dialog.Description>

          <form className="mt-4 flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
            <Field label={ru.goals.name}>
              {(id) => (
                <Input
                  id={id}
                  required
                  value={state.name}
                  maxLength={60}
                  placeholder={ru.goals.namePlaceholder}
                  data-testid="goal-name"
                  onChange={(event) => patch({ name: event.target.value })}
                />
              )}
            </Field>

            {isReserve ? null : (
              <Field label={ru.goals.kind}>
                {(id) => (
                  <Select
                    id={id}
                    value={state.kind}
                    data-testid="goal-kind"
                    onChange={(event) => patch({ kind: event.target.value as Goal['kind'] })}
                  >
                    {KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {ru.goals.kinds[kind]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={ru.goals.cost}>
                {(id) => (
                  <NumberInput
                    id={id}
                    required={!isReserve}
                    disabled={isReserve}
                    value={state.cost}
                    data-testid="goal-cost"
                    onValueChange={(cost) => patch({ cost })}
                  />
                )}
              </Field>

              {isReserve ? null : (
                <Field label={ru.goals.targetMonth}>
                  {(id) => (
                    <Input
                      id={id}
                      required
                      type="month"
                      value={state.targetMonth}
                      data-testid="goal-month"
                      onChange={(event) => patch({ targetMonth: event.target.value })}
                    />
                  )}
                </Field>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={ru.goals.returnRate}>
                {(id) => (
                  <NumberInput
                    id={id}
                    required
                    value={state.returnRate}
                    data-testid="goal-return"
                    onValueChange={(returnRate) => patch({ returnRate })}
                  />
                )}
              </Field>

              <Field label={ru.goals.inflationRate}>
                {(id) => (
                  <NumberInput
                    id={id}
                    required={!state.exact}
                    disabled={state.exact}
                    value={state.exact ? '0' : state.inflationRate}
                    data-testid="goal-inflation"
                    onValueChange={(inflationRate) => patch({ inflationRate })}
                  />
                )}
              </Field>
            </div>

            {isReserve ? null : (
              <div className="flex flex-col gap-1">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                    checked={state.exact}
                    data-testid="goal-exact"
                    onChange={(event) =>
                      patch({
                        exact: event.target.checked,
                        // Unticked again: back to the inflation of the settings, not to a zero.
                        inflationRate:
                          !event.target.checked && parseNumericInput(state.inflationRate) === 0
                            ? percent(settings.inflationRate)
                            : state.inflationRate,
                      })
                    }
                  />
                  {ru.goals.exactSum}
                </label>
                {state.exact ? (
                  <p className="pl-6 text-xs text-muted-foreground">{ru.goals.exactSumHint}</p>
                ) : null}
              </div>
            )}

            <Field label={`${ru.goals.note} (${ru.common.optional})`}>
              {(id) => (
                <Input
                  id={id}
                  value={state.note}
                  maxLength={200}
                  data-testid="goal-note"
                  onChange={(event) => patch({ note: event.target.value })}
                />
              )}
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-destructive" data-testid="goal-error">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" size="sm">
                  {ru.common.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" size="sm" disabled={busy} data-testid="goal-save">
                {ru.common.save}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
