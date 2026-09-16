import { useState } from 'react';

import { minorToRubles, rublesToMinor } from '@/core/money';
import { currentMonth, isIsoMonth, type IsoMonth } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import type { AppSettings, EducationPlan } from '@/db/models';
import {
  removeEducationPlan,
  saveEducationAsGoal,
  saveEducationPlan,
} from '@/db/repositories/financial-plan';
import { fill } from '@/features/deductions/fill';
import { educationView, type EducationView } from '@/features/plan/calculations';
import { monthInText, rateText, rubles, t } from '@/features/plan/plan-format';
import { Muted, Row } from '@/features/plan/plan-parts';
import { ru } from '@/i18n/ru';
import { parseNumericInput } from '@/lib/numeric-input';

const e = t.education;

interface EducationForm {
  name: string;
  startMonth: string;
  years: string;
  yearlyCost: string;
  returnRate: string;
  inflationRate: string;
}

function initialForm(settings: AppSettings, item?: EducationPlan): EducationForm {
  if (item) {
    return {
      name: item.name,
      startMonth: item.startMonth,
      years: String(item.years),
      yearlyCost: String(minorToRubles(item.yearlyCostMinor)),
      returnRate: rateText(item.returnRate),
      inflationRate: rateText(item.inflationRate),
    };
  }
  return {
    name: '',
    startMonth: '',
    years: '4',
    yearlyCost: '',
    returnRate: rateText(settings.defaultReturnRate),
    inflationRate: rateText(settings.inflationRate),
  };
}

/** The form as a calculation, or null while something is missing. The cost is in today's prices. */
function planOf(form: EducationForm, month: IsoMonth, item?: EducationPlan): EducationPlan | null {
  const years = parseNumericInput(form.years);
  const yearlyCostMinor = rublesToMinor(parseNumericInput(form.yearlyCost));
  if (!form.name.trim() || !isIsoMonth(form.startMonth)) return null;
  if (!Number.isInteger(years) || years < 1 || years > 10 || yearlyCostMinor <= 0) return null;

  return {
    id: item?.id ?? 'draft',
    name: form.name.trim(),
    yearlyCostMinor,
    years,
    costAsOf: month,
    startMonth: form.startMonth,
    returnRate: parseNumericInput(form.returnRate) / 100,
    inflationRate: parseNumericInput(form.inflationRate) / 100,
    goalId: item?.goalId ?? null,
  };
}

function Results({ view }: { view: EducationView }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
      <Row label={e.capital} value={rubles(view.capitalMinor)} strong testId="education-capital" />
      {view.contributionMinor === null ? (
        <Muted>{e.started}</Muted>
      ) : (
        <>
          <Row
            label={e.contribution}
            value={rubles(view.contributionMinor)}
            strong
            testId="education-contribution"
          />
          <Row
            label={e.course}
            value={fill(e.courseValue, {
              sum: rubles(view.courseSumMinor),
              amount: rubles(view.courseContributionMinor ?? 0),
            })}
            testId="education-course"
          />
        </>
      )}
      {view.savedMinor > 0 ? <Muted>{fill(e.saved, { amount: rubles(view.savedMinor) })}</Muted> : null}

      <details>
        <summary className="cursor-pointer text-sm">{e.yearsTable}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-normal">{e.year}</th>
                <th className="py-1 pr-3 text-right font-normal">{e.yearCost}</th>
                <th className="py-1 text-right font-normal">{e.yearAtStart}</th>
              </tr>
            </thead>
            <tbody>
              {view.years.map((year) => (
                <tr key={year.index}>
                  <td className="py-1 pr-3">{monthInText(year.month)}</td>
                  <td className="py-1 pr-3 text-right">{rubles(year.costMinor)}</td>
                  <td className="py-1 text-right">{rubles(year.atStartMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

interface EducationCardProps {
  readonly item?: EducationPlan;
  /** What the linked goal already holds. */
  readonly savedMinor: number;
  readonly goalName?: string;
  readonly settings: AppSettings;
  /** A new card closes itself once saved: the saved calculation takes its place. */
  readonly onDone?: () => void;
}

export function EducationCard({ item, savedMinor, goalName, settings, onDone }: EducationCardProps) {
  const [form, setForm] = useState<EducationForm>(() => initialForm(settings, item));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const patch = (next: Partial<EducationForm>) => {
    setForm((current) => ({ ...current, ...next }));
    setMessage(null);
  };

  const month = currentMonth();
  const draft = planOf(form, month, item);
  const view = draft ? educationView(draft, month, savedMinor) : null;
  const testId = item ? `education-${item.id}` : 'education-new';

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      setMessage(await action());
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : ru.common.error);
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<EducationPlan> => {
    if (!draft) throw new Error(t.calculator.invalid);
    return saveEducationPlan({
      id: item?.id,
      name: draft.name,
      yearlyCostMinor: draft.yearlyCostMinor,
      years: draft.years,
      costAsOf: draft.costAsOf,
      startMonth: draft.startMonth,
      returnRate: draft.returnRate,
      inflationRate: draft.inflationRate,
    });
  };

  const saveAsGoal = async () => {
    const saved = await save();
    const name = fill(e.goalName, { name: saved.name });
    await saveEducationAsGoal(saved.id, {
      name,
      costMinor: Math.round(view?.capitalMinor ?? 0),
      costAsOf: saved.startMonth,
      targetMonth: saved.startMonth,
      returnRate: saved.returnRate,
      inflationRate: saved.inflationRate,
    });
    onDone?.();
    return fill(t.calculator.goalSaved, { name });
  };

  return (
    <Card data-testid={testId}>
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={e.name}>
            {(id) => (
              <Input
                id={id}
                value={form.name}
                maxLength={60}
                placeholder={e.namePlaceholder}
                data-testid="education-name"
                onChange={(event) => patch({ name: event.target.value })}
              />
            )}
          </Field>
          <Field label={e.startMonth}>
            {(id) => (
              <Input
                id={id}
                type="month"
                value={form.startMonth}
                data-testid="education-start"
                onChange={(event) => patch({ startMonth: event.target.value })}
              />
            )}
          </Field>
          <Field label={e.years} hint={e.yearsHint}>
            {(id) => (
              <NumberInput
                id={id}
                integer
                value={form.years}
                data-testid="education-years"
                onValueChange={(years) => patch({ years })}
              />
            )}
          </Field>
          <Field label={e.yearlyCost} hint={e.yearlyCostHint}>
            {(id) => (
              <NumberInput
                id={id}
                value={form.yearlyCost}
                data-testid="education-cost"
                onValueChange={(yearlyCost) => patch({ yearlyCost })}
              />
            )}
          </Field>
          <Field label={e.returnRate}>
            {(id) => (
              <NumberInput
                id={id}
                value={form.returnRate}
                data-testid="education-return"
                onValueChange={(returnRate) => patch({ returnRate })}
              />
            )}
          </Field>
          <Field label={e.inflationRate}>
            {(id) => (
              <NumberInput
                id={id}
                value={form.inflationRate}
                data-testid="education-inflation"
                onValueChange={(inflationRate) => patch({ inflationRate })}
              />
            )}
          </Field>
        </div>

        {view ? <Results view={view} /> : <Muted>{t.calculator.invalid}</Muted>}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={!draft || busy}
            data-testid="education-save"
            onClick={() =>
              void run(async () => {
                await save();
                onDone?.();
                return t.calculator.saved;
              })
            }
          >
            {t.calculator.save}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!view || view.months <= 0 || busy}
            data-testid="education-goal"
            onClick={() => void run(saveAsGoal)}
          >
            {goalName ? t.calculator.updateGoal : t.calculator.saveAsGoal}
          </Button>
          {item ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              data-testid="education-remove"
              onClick={() =>
                void run(async () => {
                  await removeEducationPlan(item.id);
                  return '';
                })
              }
            >
              {t.calculator.remove}
            </Button>
          ) : null}
        </div>
        {message ? (
          <p role="status" className="text-sm text-muted-foreground" data-testid="education-message">
            {message}
          </p>
        ) : goalName ? (
          <Muted>{fill(t.calculator.goalSaved, { name: goalName })}</Muted>
        ) : null}
      </CardContent>
    </Card>
  );
}
