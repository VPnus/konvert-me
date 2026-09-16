import { Plus, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { summarizeDeductionYear, type DeductionSummary } from '@/core/deductions';
import { formatMinor, minorToRubles, rublesToMinor } from '@/core/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import { DEDUCTION_STATUSES, type DeductionStatus, type DeductionYear } from '@/db/models';
import {
  deleteDeductionYear,
  saveDeductionYear,
  toDeductionClaim,
  type DeductionYearInput,
} from '@/db/repositories/deductions';
import type { DeductionYearView } from '@/features/deductions/deductions-data';
import { ru } from '@/i18n/ru';
import { parseNumericInput } from '@/lib/numeric-input';

const t = ru.deductions;

type HadKey =
  'treatment' | 'education' | 'sport' | 'insurance' | 'children' | 'expensive' | 'savings' | 'property';

interface FormState {
  income: string;
  had: Record<HadKey, boolean>;
  treatment: string;
  education: string;
  sport: string;
  insurance: string;
  children: string[];
  expensive: string;
  savings: string;
  purchase: string;
  interest: string;
  loanBefore2014: boolean;
  usedBefore: string;
  status: DeductionStatus;
}

/** A stored sum as the field shows it: nothing typed rather than a zero to erase. */
function field(minor: number | undefined): string {
  return minor ? String(minorToRubles(minor)) : '';
}

function formOf(saved: DeductionYear | undefined): FormState {
  const spending = saved?.spending;
  const property = saved?.property;

  return {
    income: field(saved?.incomeMinor),
    had: {
      treatment: Boolean(spending?.treatmentMinor),
      education: Boolean(spending?.educationMinor),
      sport: Boolean(spending?.sportMinor),
      insurance: Boolean(spending?.insuranceMinor),
      children: Boolean(spending?.childEducationMinor.length),
      expensive: Boolean(spending?.expensiveTreatmentMinor),
      savings: Boolean(saved?.longTermSavingsMinor),
      property: Boolean(property),
    },
    treatment: field(spending?.treatmentMinor),
    education: field(spending?.educationMinor),
    sport: field(spending?.sportMinor),
    insurance: field(spending?.insuranceMinor),
    children: spending?.childEducationMinor.map(field) ?? [],
    expensive: field(spending?.expensiveTreatmentMinor),
    savings: field(saved?.longTermSavingsMinor),
    purchase: field(property?.purchaseMinor),
    interest: field(property?.mortgageInterestMinor),
    loanBefore2014: property?.loanBefore2014 ?? false,
    usedBefore: field(property?.usedBeforeMinor),
    status: saved?.status ?? 'draft',
  };
}

const minor = (value: string): number => rublesToMinor(parseNumericInput(value));

/** What is saved is what is ticked: a question left unticked counts as nothing spent. */
function inputOf(year: number, form: FormState): DeductionYearInput {
  const when = (key: HadKey, value: string) => (form.had[key] ? minor(value) : 0);

  return {
    year,
    incomeMinor: minor(form.income),
    spending: {
      treatmentMinor: when('treatment', form.treatment),
      educationMinor: when('education', form.education),
      sportMinor: when('sport', form.sport),
      insuranceMinor: when('insurance', form.insurance),
      childEducationMinor: form.had.children ? form.children.map(minor) : [],
      expensiveTreatmentMinor: when('expensive', form.expensive),
    },
    longTermSavingsMinor: when('savings', form.savings),
    property: form.had.property
      ? {
          purchaseMinor: minor(form.purchase),
          mortgageInterestMinor: minor(form.interest),
          loanBefore2014: form.loanBefore2014,
          usedBeforeMinor: minor(form.usedBefore),
        }
      : undefined,
    status: form.status,
  };
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function RefundRow({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular-nums" data-testid={testId}>
        {formatMinor(value, { fractionDigits: 0 })}
      </span>
    </div>
  );
}

function RefundCard({ view, summary }: { view: DeductionYearView; summary: DeductionSummary | undefined }) {
  const notes: string[] = [];
  if (view.stage === 'current') notes.push(fill(t.currentHint, { next: view.year + 1 }));
  if (view.stage === 'expired') notes.push(fill(t.expiredHint, { year: view.year }));
  if (!view.rules) notes.push(fill(t.rulesMissing, { year: view.year }));
  else if (view.rules.year !== view.year)
    notes.push(fill(t.rulesBorrowed, { year: view.year, rulesYear: view.rules.year }));

  const property = summary?.property;
  const usedBefore = view.saved?.property?.usedBeforeMinor ?? 0;

  return (
    <Card data-testid="refund-card">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{t.refundTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-3">
        {notes.map((note) => (
          <p key={note} className="text-sm text-muted-foreground" data-testid="year-note">
            {note}
          </p>
        ))}

        {summary && summary.taxPaidMinor > 0 ? (
          <>
            <p className="text-3xl font-semibold tabular-nums" data-testid="refund-total">
              {formatMinor(summary.refundMinor, { fractionDigits: 0 })}
            </p>
            <div className="flex flex-col gap-1.5">
              <RefundRow label={t.taxPaid} value={summary.taxPaidMinor} testId="refund-tax-paid" />
              {summary.socialRefundMinor > 0 ? (
                <RefundRow label={t.partSocial} value={summary.socialRefundMinor} testId="refund-social" />
              ) : null}
              {summary.longTermSavingsRefundMinor > 0 ? (
                <RefundRow
                  label={t.partSavings}
                  value={summary.longTermSavingsRefundMinor}
                  testId="refund-savings"
                />
              ) : null}
              {property ? (
                <RefundRow label={t.partProperty} value={property.refundMinor} testId="refund-property" />
              ) : null}
            </div>

            {property && property.availableMinor === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="refund-property-left">
                {t.propertyUsedUp}
              </p>
            ) : null}
            {property && property.leftMinor > 0 ? (
              <p className="text-sm" data-testid="refund-property-left">
                {fill(t.propertyLeft, { amount: formatMinor(property.leftMinor, { fractionDigits: 0 }) })}{' '}
                {fill(t.propertyNext, {
                  year: view.year + 1,
                  amount: formatMinor(usedBefore + property.usedMinor, { fractionDigits: 0 }),
                })}
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground">{t.refundHint}</p>
          </>
        ) : view.rules ? (
          <p className="text-sm text-muted-foreground" data-testid="refund-empty">
            {t.refundEmpty}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Tick({
  checked,
  label,
  testId,
  onChange,
}: {
  checked: boolean;
  label: string;
  testId: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
        data-testid={testId}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/** A question and, once it is ticked, what it asks for. */
function Question({
  had,
  label,
  testId,
  onToggle,
  children,
}: {
  had: boolean;
  label: string;
  testId: string;
  onToggle: (had: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Tick checked={had} label={label} testId={testId} onChange={onToggle} />
      {had ? <div className="flex flex-col gap-3 border-l-2 border-border pl-4">{children}</div> : null}
    </div>
  );
}

function MoneyField({
  label,
  hint,
  value,
  testId,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  testId: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <NumberInput id={id} value={value} data-testid={testId} onValueChange={onChange} />}
    </Field>
  );
}

/**
 * One year: what can come back, and the questions it comes from. The refund follows the
 * answers as they are typed; saving only keeps them.
 */
export function YearPanel({ view }: { view: DeductionYearView }) {
  const [form, setForm] = useState<FormState>(() => formOf(view.saved));
  const [savedNote, setSavedNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setSavedNote(false);
  };
  const toggle = (key: HadKey, had: boolean) => {
    setForm((current) => ({
      ...current,
      had: { ...current.had, [key]: had },
      // a first child appears with the question, so there is somewhere to type
      children: key === 'children' && had && current.children.length === 0 ? [''] : current.children,
    }));
    setSavedNote(false);
  };

  const input = inputOf(view.year, form);
  let summary: DeductionSummary | undefined;
  try {
    summary = view.rules ? summarizeDeductionYear(toDeductionClaim(input), view.rules) : undefined;
  } catch {
    // a number too large to be money yet: the refund waits until it is one
    summary = undefined;
  }

  const rules = view.rules;
  const limit = (value: number | undefined) =>
    value === undefined ? '' : formatMinor(value, { fractionDigits: 0 });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await saveDeductionYear(input);
      setSavedNote(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <RefundCard view={view} summary={summary} />

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t.formTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.formHint}</p>
        </CardHeader>
        <CardContent className="pt-3">
          <form className="flex flex-col gap-4" onSubmit={(event) => void save(event)}>
            <MoneyField
              label={t.income}
              hint={t.incomeHint}
              value={form.income}
              testId="deduction-income"
              onChange={(income) => update({ income })}
            />

            <div className="flex flex-col gap-3">
              <Question
                had={form.had.treatment}
                label={t.had.treatment}
                testId="had-treatment"
                onToggle={(had) => toggle('treatment', had)}
              >
                <MoneyField
                  label={t.treatment}
                  value={form.treatment}
                  testId="deduction-treatment"
                  onChange={(treatment) => update({ treatment })}
                />
              </Question>

              <Question
                had={form.had.education}
                label={t.had.education}
                testId="had-education"
                onToggle={(had) => toggle('education', had)}
              >
                <MoneyField
                  label={t.education}
                  value={form.education}
                  testId="deduction-education"
                  onChange={(education) => update({ education })}
                />
              </Question>

              <Question
                had={form.had.sport}
                label={t.had.sport}
                testId="had-sport"
                onToggle={(had) => toggle('sport', had)}
              >
                <MoneyField
                  label={t.sport}
                  value={form.sport}
                  testId="deduction-sport"
                  onChange={(sport) => update({ sport })}
                />
              </Question>

              <Question
                had={form.had.insurance}
                label={t.had.insurance}
                testId="had-insurance"
                onToggle={(had) => toggle('insurance', had)}
              >
                <MoneyField
                  label={t.insurance}
                  value={form.insurance}
                  testId="deduction-insurance"
                  onChange={(insurance) => update({ insurance })}
                />
              </Question>

              {form.had.treatment || form.had.education || form.had.sport || form.had.insurance ? (
                <p className="text-xs text-muted-foreground">
                  {fill(t.commonHint, { limit: limit(rules?.socialDeductionLimitMinor.value) })}
                </p>
              ) : null}

              <Question
                had={form.had.children}
                label={t.had.children}
                testId="had-children"
                onToggle={(had) => toggle('children', had)}
              >
                {form.children.map((value, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <MoneyField
                      label={fill(t.child, { n: index + 1 })}
                      value={value}
                      testId={`deduction-child-${index}`}
                      onChange={(next) =>
                        update({ children: form.children.map((item, at) => (at === index ? next : item)) })
                      }
                    />
                    {form.children.length > 1 ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="mb-0.5 shrink-0"
                        aria-label={fill(t.childRemove, { n: index + 1 })}
                        onClick={() => update({ children: form.children.filter((_, at) => at !== index) })}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {fill(t.childHint, { limit: limit(rules?.childEducationLimitMinor.value) })}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  data-testid="deduction-child-add"
                  onClick={() => update({ children: [...form.children, ''] })}
                >
                  <Plus className="size-4" aria-hidden />
                  {t.childAdd}
                </Button>
              </Question>

              <Question
                had={form.had.expensive}
                label={t.had.expensive}
                testId="had-expensive"
                onToggle={(had) => toggle('expensive', had)}
              >
                <MoneyField
                  label={t.expensive}
                  hint={t.expensiveHint}
                  value={form.expensive}
                  testId="deduction-expensive"
                  onChange={(expensive) => update({ expensive })}
                />
              </Question>

              <Question
                had={form.had.savings}
                label={t.had.savings}
                testId="had-savings"
                onToggle={(had) => toggle('savings', had)}
              >
                <MoneyField
                  label={t.savings}
                  hint={fill(t.savingsHint, { limit: limit(rules?.longTermSavingsLimitMinor.value) })}
                  value={form.savings}
                  testId="deduction-savings"
                  onChange={(savings) => update({ savings })}
                />
              </Question>

              <Question
                had={form.had.property}
                label={t.had.property}
                testId="had-property"
                onToggle={(had) => toggle('property', had)}
              >
                <MoneyField
                  label={t.purchase}
                  hint={fill(t.purchaseHint, { limit: limit(rules?.propertyPurchaseLimitMinor.value) })}
                  value={form.purchase}
                  testId="deduction-purchase"
                  onChange={(purchase) => update({ purchase })}
                />
                <MoneyField
                  label={t.interest}
                  hint={fill(t.interestHint, { limit: limit(rules?.mortgageInterestLimitMinor.value) })}
                  value={form.interest}
                  testId="deduction-interest"
                  onChange={(interest) => update({ interest })}
                />
                <Tick
                  checked={form.loanBefore2014}
                  label={t.loanBefore2014}
                  testId="deduction-loan-before-2014"
                  onChange={(loanBefore2014) => update({ loanBefore2014 })}
                />
                <MoneyField
                  label={t.usedBefore}
                  hint={t.usedBeforeHint}
                  value={form.usedBefore}
                  testId="deduction-used-before"
                  onChange={(usedBefore) => update({ usedBefore })}
                />
              </Question>
            </div>

            <Field label={t.status}>
              {(id) => (
                <Select
                  id={id}
                  value={form.status}
                  data-testid="deduction-status"
                  onChange={(event) => update({ status: event.target.value as DeductionStatus })}
                >
                  {DEDUCTION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t.statuses[status]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-destructive" data-testid="deduction-error">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" data-testid="deduction-save">
                {t.save}
              </Button>
              {savedNote ? (
                <span role="status" className="text-sm text-muted-foreground" data-testid="deduction-saved">
                  {t.saved}
                </span>
              ) : null}
              {view.saved ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive"
                  data-testid="deduction-delete"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t.deleteYear}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title={fill(t.deleteConfirmTitle, { year: view.year })}
        description={t.deleteConfirmText}
        confirmLabel={ru.common.delete}
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          void deleteDeductionYear(view.year).then(() => setForm(formOf(undefined)));
        }}
        onOpenChange={setConfirmDelete}
      />
    </div>
  );
}
