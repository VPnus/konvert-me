import { useState } from 'react';

import { minorToRubles, rublesToMinor } from '@/core/money';
import { currentMonth, isIsoMonth, type IsoMonth } from '@/core/time';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import type { AppSettings, PensionPlan } from '@/db/models';
import { savePensionAsGoal, savePensionPlan } from '@/db/repositories/financial-plan';
import { fill } from '@/features/deductions/fill';
import { pensionView, type PensionView } from '@/features/plan/calculations';
import { monthInText, rateText, rubles, t } from '@/features/plan/plan-format';
import { Muted, Row } from '@/features/plan/plan-parts';
import { ru } from '@/i18n/ru';
import { parseNumericInput } from '@/lib/numeric-input';

const p = t.pension;
const STRATEGIES: readonly PensionPlan['strategy'][] = ['spend-capital', 'keep-capital'];

/** Lesson 7.4: the comfortable spending on retirement is 70 % of today's. */
const DEFAULT_REPLACEMENT_PERCENT = '70';
/** The family of lesson 7.4 plans to stop at 60 and to have enough until 80. */
const DEFAULT_RETIREMENT_AGE = '60';
const DEFAULT_LIFE_AGE = '80';

interface PensionForm {
  birthMonth: string;
  retirementAge: string;
  lifeAge: string;
  expenses: string;
  replacement: string;
  statePension: string;
  returnRate: string;
  inflationRate: string;
  strategy: PensionPlan['strategy'];
}

function initialForm(
  settings: AppSettings,
  averageExpensesMinor: number,
  pension: PensionPlan | null,
): PensionForm {
  if (pension) {
    return {
      birthMonth: pension.birthMonth,
      retirementAge: String(pension.retirementAge),
      lifeAge: String(pension.lifeAge),
      expenses: String(minorToRubles(pension.monthlyExpensesMinor)),
      replacement: rateText(pension.replacementRate),
      statePension: String(minorToRubles(pension.statePensionMinor)),
      returnRate: rateText(pension.returnRate),
      inflationRate: rateText(pension.inflationRate),
      strategy: pension.strategy,
    };
  }
  return {
    birthMonth: '',
    retirementAge: DEFAULT_RETIREMENT_AGE,
    lifeAge: DEFAULT_LIFE_AGE,
    expenses: averageExpensesMinor > 0 ? String(Math.round(minorToRubles(averageExpensesMinor))) : '',
    replacement: DEFAULT_REPLACEMENT_PERCENT,
    statePension: '0',
    returnRate: rateText(settings.defaultReturnRate),
    inflationRate: rateText(settings.inflationRate),
    strategy: 'spend-capital',
  };
}

/** The form as a calculation in today's prices, or null while something is missing. */
function planOf(form: PensionForm, month: IsoMonth, goalId: string | null): PensionPlan | null {
  const retirementAge = parseNumericInput(form.retirementAge);
  const lifeAge = parseNumericInput(form.lifeAge);
  const monthlyExpensesMinor = rublesToMinor(parseNumericInput(form.expenses));
  if (!isIsoMonth(form.birthMonth) || monthlyExpensesMinor <= 0) return null;
  if (!Number.isInteger(retirementAge) || retirementAge < 18 || retirementAge > 100) return null;
  if (!Number.isInteger(lifeAge) || lifeAge <= retirementAge || lifeAge > 120) return null;

  return {
    birthMonth: form.birthMonth,
    retirementAge,
    lifeAge,
    monthlyExpensesMinor,
    replacementRate: parseNumericInput(form.replacement) / 100,
    statePensionMinor: rublesToMinor(parseNumericInput(form.statePension)),
    costAsOf: month,
    returnRate: parseNumericInput(form.returnRate) / 100,
    inflationRate: parseNumericInput(form.inflationRate) / 100,
    strategy: form.strategy,
    goalId,
  };
}

function Results({ view }: { view: PensionView }) {
  const { pension, need } = view;
  const retirementYear = view.retirementMonth.slice(0, 4);

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
      <Muted testId="pension-retirement">
        {fill(p.retirement, { month: monthInText(view.retirementMonth) })}
      </Muted>
      <Row label={p.desired} value={rubles(need.desiredMonthlyMinor)} />
      <Row label={p.state} value={rubles(pension.statePensionMinor)} />
      <Row label={p.gapToday} value={rubles(need.gapTodayMinor)} />
      <Row
        label={fill(p.gapAtRetirement, { year: retirementYear })}
        value={rubles(need.gapAtRetirementMinor)}
        testId="pension-gap"
      />

      {need.annualSpendingMinor === 0 ? (
        <Muted>{p.covered}</Muted>
      ) : (
        <>
          <Row
            label={fill(p.spendCapital, { age: pension.lifeAge })}
            value={rubles(view.spendCapitalMinor)}
            strong={pension.strategy === 'spend-capital'}
            testId="pension-capital-spend"
          />
          {view.keepCapitalMinor === null ? (
            <Muted testId="pension-capital-keep">{p.keepImpossible}</Muted>
          ) : (
            <Row
              label={p.keepCapital}
              value={rubles(view.keepCapitalMinor)}
              strong={pension.strategy === 'keep-capital'}
              testId="pension-capital-keep"
            />
          )}

          {view.months <= 0 ? (
            <Muted>{p.retired}</Muted>
          ) : view.contributionMinor !== null ? (
            <Row
              label={p.contribution}
              value={rubles(view.contributionMinor)}
              strong
              testId="pension-contribution"
            />
          ) : null}
          {view.savedMinor > 0 ? <Muted>{fill(p.saved, { amount: rubles(view.savedMinor) })}</Muted> : null}

          {view.courseCapitalMinor !== null ? (
            <Muted testId="pension-course">
              {view.courseRunsOutAge === null
                ? fill(p.courseLasts, { amount: rubles(view.courseCapitalMinor) })
                : fill(p.course, { amount: rubles(view.courseCapitalMinor), age: view.courseRunsOutAge })}
            </Muted>
          ) : null}

          {view.drawdown.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm">{p.drawdown}</summary>
              <div className="mt-2 max-h-72 overflow-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-normal">{p.age}</th>
                      <th className="py-1 pr-3 text-right font-normal">{p.payment}</th>
                      <th className="py-1 text-right font-normal">{p.end}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.drawdown.map((year) => (
                      <tr key={year.index}>
                        <td className="py-1 pr-3">{pension.retirementAge + year.index}</td>
                        <td className="py-1 pr-3 text-right">{rubles(year.paymentMinor)}</td>
                        <td className="py-1 text-right">{rubles(Math.max(year.endMinor, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}

interface PensionCardProps {
  readonly pension: PensionPlan | null;
  readonly savedMinor: number;
  readonly goalName?: string;
  readonly settings: AppSettings;
  readonly averageExpensesMinor: number;
}

export function PensionCard({
  pension,
  savedMinor,
  goalName,
  settings,
  averageExpensesMinor,
}: PensionCardProps) {
  const [form, setForm] = useState<PensionForm>(() => initialForm(settings, averageExpensesMinor, pension));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const patch = (next: Partial<PensionForm>) => {
    setForm((current) => ({ ...current, ...next }));
    setMessage(null);
  };

  const month = currentMonth();
  const draft = planOf(form, month, pension?.goalId ?? null);
  const view = draft ? pensionView(draft, month, savedMinor) : null;

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

  const save = async (): Promise<PensionPlan> => {
    if (!draft) throw new Error(t.calculator.invalid);
    return savePensionPlan({
      birthMonth: draft.birthMonth,
      retirementAge: draft.retirementAge,
      lifeAge: draft.lifeAge,
      monthlyExpensesMinor: draft.monthlyExpensesMinor,
      replacementRate: draft.replacementRate,
      statePensionMinor: draft.statePensionMinor,
      costAsOf: draft.costAsOf,
      returnRate: draft.returnRate,
      inflationRate: draft.inflationRate,
      strategy: draft.strategy,
    });
  };

  const saveAsGoal = async () => {
    const saved = await save();
    if (!view || view.capitalMinor === null) throw new Error(p.keepImpossible);
    await savePensionAsGoal({
      name: p.goalName,
      costMinor: Math.round(view.capitalMinor),
      costAsOf: view.retirementMonth,
      targetMonth: view.retirementMonth,
      returnRate: saved.returnRate,
      inflationRate: saved.inflationRate,
    });
    return fill(t.calculator.goalSaved, { name: p.goalName });
  };

  const number = (
    key: keyof PensionForm,
    label: string,
    testId: string,
    options: { hint?: string; integer?: boolean } = {},
  ) => (
    <Field label={label} hint={options.hint}>
      {(id) => (
        <NumberInput
          id={id}
          integer={options.integer}
          value={form[key]}
          data-testid={testId}
          onValueChange={(value) => patch({ [key]: value })}
        />
      )}
    </Field>
  );

  return (
    <Card data-testid="pension-card">
      <CardContent className="flex flex-col gap-4 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={p.birthMonth}>
            {(id) => (
              <Input
                id={id}
                type="month"
                value={form.birthMonth}
                data-testid="pension-birth"
                onChange={(event) => patch({ birthMonth: event.target.value })}
              />
            )}
          </Field>
          {number('retirementAge', p.retirementAge, 'pension-retirement-age', { integer: true })}
          {number('lifeAge', p.lifeAge, 'pension-life-age', { integer: true, hint: p.lifeAgeHint })}
          {number('expenses', p.expenses, 'pension-expenses', { hint: p.expensesHint })}
          {number('replacement', p.replacement, 'pension-replacement', { hint: p.replacementHint })}
          {number('statePension', p.statePension, 'pension-state', { hint: p.statePensionHint })}
          {number('returnRate', p.returnRate, 'pension-return')}
          {number('inflationRate', p.inflationRate, 'pension-inflation')}
          <Field label={p.strategy} className="sm:col-span-2">
            {(id) => (
              <Select
                id={id}
                value={form.strategy}
                data-testid="pension-strategy"
                onChange={(event) => patch({ strategy: event.target.value as PensionPlan['strategy'] })}
              >
                {STRATEGIES.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {p.strategies[strategy]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {view ? <Results view={view} /> : <Muted>{t.calculator.invalid}</Muted>}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={!draft || busy}
            data-testid="pension-save"
            onClick={() =>
              void run(async () => {
                await save();
                return t.calculator.saved;
              })
            }
          >
            {t.calculator.save}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!view || view.capitalMinor === null || view.months <= 0 || busy}
            data-testid="pension-goal"
            onClick={() => void run(saveAsGoal)}
          >
            {goalName ? t.calculator.updateGoal : t.calculator.saveAsGoal}
          </Button>
        </div>
        {message ? (
          <p role="status" className="text-sm text-muted-foreground" data-testid="pension-message">
            {message}
          </p>
        ) : goalName ? (
          <Muted>{fill(t.calculator.goalSaved, { name: goalName })}</Muted>
        ) : null}
      </CardContent>
    </Card>
  );
}
