import { Archive, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { formatForecast, minorToRubles, rublesToMinor } from '@/core/money';
import { daysBetween, todayIso } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import { POLICY_TYPES, type InsurancePolicy } from '@/db/models';
import { createPolicy, deletePolicy, updatePolicy } from '@/db/repositories/policies';
import { daysLabel } from '@/features/balance/days-label';
import { fullDateLabel } from '@/features/balance/card-view';
import { strings } from '@/i18n';
import { inCurrency } from '@/i18n/format';
import { parseNumericInput } from '@/lib/numeric-input';

interface FormState {
  name: string;
  type: InsurancePolicy['type'];
  insurer: string;
  sumInsured: string;
  premium: string;
  endDate: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'vehicle',
  insurer: '',
  sumInsured: '',
  premium: '',
  endDate: '',
};

function formOf(policy: InsurancePolicy): FormState {
  return {
    name: policy.name,
    type: policy.type,
    insurer: policy.insurer ?? '',
    sumInsured: policy.sumInsuredMinor ? String(minorToRubles(policy.sumInsuredMinor)) : '',
    premium: policy.premiumMinor ? String(minorToRubles(policy.premiumMinor)) : '',
    endDate: policy.endDate,
  };
}

interface PoliciesCardProps {
  readonly policies: readonly InsurancePolicy[];
}

/** What is covered and until when. Policies hold no money and touch no account. */
export function PoliciesCard({ policies }: PoliciesCardProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InsurancePolicy | null>(null);

  const today = todayIso();

  const close = () => {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload = {
      name: form.name,
      type: form.type,
      insurer: form.insurer.trim() || undefined,
      sumInsuredMinor: form.sumInsured ? rublesToMinor(parseNumericInput(form.sumInsured)) : undefined,
      premiumMinor: form.premium ? rublesToMinor(parseNumericInput(form.premium)) : undefined,
      endDate: form.endDate,
    };

    try {
      if (editingId) await updatePolicy(editingId, payload);
      else await createPolicy(payload);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    }
  };

  const renderForm = () => (
    <form
      className="flex flex-col gap-3 border-t border-border pt-3"
      onSubmit={(event) => void submit(event)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={strings.policies.name}>
          {(id) => (
            <Input
              id={id}
              required
              value={form.name}
              maxLength={60}
              placeholder={strings.policies.namePlaceholder}
              data-testid="policy-name"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          )}
        </Field>

        <Field label={strings.policies.type}>
          {(id) => (
            <Select
              id={id}
              value={form.type}
              data-testid="policy-type"
              onChange={(event) => setForm({ ...form, type: event.target.value as FormState['type'] })}
            >
              {POLICY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {strings.policies.types[type]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`${strings.policies.insurer} (${strings.common.optional})`}>
          {(id) => (
            <Input
              id={id}
              value={form.insurer}
              maxLength={60}
              data-testid="policy-insurer"
              onChange={(event) => setForm({ ...form, insurer: event.target.value })}
            />
          )}
        </Field>

        <Field label={strings.policies.endDate}>
          {(id) => (
            <Input
              id={id}
              required
              type="date"
              value={form.endDate}
              data-testid="policy-end"
              onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={`${inCurrency(strings.policies.sumInsured)} (${strings.common.optional})`}
          hint={strings.policies.sumInsuredHint}
        >
          {(id) => (
            <NumberInput
              id={id}
              value={form.sumInsured}
              data-testid="policy-sum"
              onValueChange={(sumInsured) => setForm({ ...form, sumInsured })}
            />
          )}
        </Field>

        <Field label={`${inCurrency(strings.policies.premium)} (${strings.common.optional})`}>
          {(id) => (
            <NumberInput
              id={id}
              value={form.premium}
              data-testid="policy-premium"
              onValueChange={(premium) => setForm({ ...form, premium })}
            />
          )}
        </Field>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive" data-testid="policy-error">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" data-testid="policy-save">
          {strings.common.save}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={close}>
          {strings.common.cancel}
        </Button>
      </div>
    </form>
  );

  return (
    <Card data-testid="policies-card">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{strings.policies.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{strings.policies.subtitle}</p>
        </div>
        <Button
          size="sm"
          data-testid="add-policy"
          onClick={() => {
            setEditingId(null);
            setForm({ ...EMPTY_FORM, endDate: '' });
            setAdding(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {strings.common.add}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {policies.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground" data-testid="policies-empty">
            {strings.policies.empty}
          </p>
        ) : null}

        {policies.length > 0 ? (
          <ul>
            {policies.map((policy) => {
              const left = daysBetween(today, policy.endDate);

              return (
                <li
                  key={policy.id}
                  className="flex flex-col gap-2 border-b border-border py-2 last:border-b-0"
                  data-testid="policy-row"
                >
                  {/* on a narrow page the date and the buttons move under the name rather than out of the card */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate text-sm font-medium">{policy.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {strings.policies.types[policy.type]}
                        {policy.insurer ? ` · ${policy.insurer}` : ''}
                        {policy.sumInsuredMinor ? ` · ${formatForecast(policy.sumInsuredMinor)}` : ''}
                      </p>
                    </div>

                    <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">
                      <span
                        className={`mr-1 text-xs ${left < 0 ? 'text-destructive' : left <= 30 ? 'text-warning' : 'text-muted-foreground'}`}
                        data-testid={`policy-left-${policy.name}`}
                      >
                        {left < 0
                          ? strings.policies.expired
                          : `${strings.policies.expires} ${fullDateLabel(policy.endDate)}`}
                        {left >= 0 ? ` · ${daysLabel(left)}` : ''}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`${strings.common.edit}: ${policy.name}`}
                        data-testid={`policy-edit-${policy.name}`}
                        onClick={() => {
                          setAdding(false);
                          setForm(formOf(policy));
                          setEditingId(policy.id);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`${strings.policies.archive}: ${policy.name}`}
                        onClick={() => void updatePolicy(policy.id, { archived: !policy.archived })}
                      >
                        <Archive className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`${strings.policies.remove}: ${policy.name}`}
                        onClick={() => setPendingDelete(policy)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  {editingId === policy.id ? renderForm() : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {adding ? renderForm() : null}
      </CardContent>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={strings.policies.deleteConfirmTitle}
        description={strings.policies.deleteConfirmText}
        confirmLabel={strings.common.delete}
        destructive
        onConfirm={() => {
          if (pendingDelete) void deletePolicy(pendingDelete.id);
          setPendingDelete(null);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />
    </Card>
  );
}
