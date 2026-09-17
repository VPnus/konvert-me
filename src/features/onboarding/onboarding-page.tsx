import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { formatMinor, rublesToMinor } from '@/core/money';
import { parseNumericInput } from '@/lib/numeric-input';
import { addMonths, currentMonth } from '@/core/time';
import { CatLogo } from '@/components/brand/cat-logo';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import {
  completeOnboarding,
  EMPTY_ANSWERS,
  skipOnboarding,
  type OnboardingAnswers,
} from '@/features/onboarding/complete-onboarding';
import { useSettingsState } from '@/hooks/use-settings';
import { ru } from '@/i18n/ru';

const STEPS = 5;

type NumericKey =
  | 'incomeRub'
  | 'mandatoryRub'
  | 'variableRub'
  | 'savingsRub'
  | 'debtBalanceRub'
  | 'debtPaymentRub'
  | 'goalCostRub';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { settings, loading } = useSettingsState();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => ({
    ...EMPTY_ANSWERS,
    // A default the user can keep: three years from now.
    goalTargetMonth: addMonths(currentMonth(), 36),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The fields keep their own text so a half-typed "12," is not thrown away.
  const [debtRate, setDebtRate] = useState('');
  const [numbers, setNumbers] = useState<Record<NumericKey, string>>({
    incomeRub: '',
    mandatoryRub: '',
    variableRub: '',
    savingsRub: '',
    debtBalanceRub: '',
    debtPaymentRub: '',
    goalCostRub: '',
  });

  const setNumber = (key: NumericKey, value: string) => {
    setNumbers((current) => ({ ...current, [key]: value }));
    setAnswers((current) => ({ ...current, [key]: parseNumericInput(value) }));
  };

  const freeCashMinor =
    rublesToMinor(answers.incomeRub) -
    rublesToMinor(answers.mandatoryRub) -
    rublesToMinor(answers.variableRub);

  const finish = async (skip: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (skip) await skipOnboarding();
      else await completeOnboarding(answers);
      navigate('/overview', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  // Once is enough: going through it again would add a second set of accounts and goals.
  if (settings.onboardingDone && !busy) return <Navigate to="/overview" replace />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center gap-3">
        <CatLogo className="size-12 shrink-0" />
        <div>
          <p className="text-lg font-semibold">{ru.app.name}</p>
          <p className="text-sm text-muted-foreground">{ru.onboarding.intro}</p>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / STEPS) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {ru.onboarding.step} {step} {ru.onboarding.of} {STEPS}
        </span>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        {step === 1 ? (
          <>
            <h1 className="text-xl font-semibold">{ru.onboarding.incomeTitle}</h1>
            <p className="text-sm text-muted-foreground">{ru.onboarding.incomeText}</p>
            <Field label={ru.onboarding.incomeLabel}>
              {(id) => (
                <NumberInput
                  id={id}
                  autoFocus
                  value={numbers.incomeRub}
                  data-testid="onboarding-income"
                  onValueChange={(value) => setNumber('incomeRub', value)}
                />
              )}
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-xl font-semibold">{ru.onboarding.mandatoryTitle}</h1>
            <p className="text-sm text-muted-foreground">{ru.onboarding.mandatoryText}</p>
            <Field label={ru.onboarding.mandatoryLabel}>
              {(id) => (
                <NumberInput
                  id={id}
                  autoFocus
                  value={numbers.mandatoryRub}
                  data-testid="onboarding-mandatory"
                  onValueChange={(value) => setNumber('mandatoryRub', value)}
                />
              )}
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-xl font-semibold">{ru.onboarding.variableTitle}</h1>
            <p className="text-sm text-muted-foreground">{ru.onboarding.variableText}</p>
            <Field label={ru.onboarding.variableLabel}>
              {(id) => (
                <NumberInput
                  id={id}
                  autoFocus
                  value={numbers.variableRub}
                  data-testid="onboarding-variable"
                  onValueChange={(value) => setNumber('variableRub', value)}
                />
              )}
            </Field>
            <p className="text-sm" data-testid="onboarding-free-cash">
              {ru.onboarding.freeCash}: <strong>{formatMinor(freeCashMinor, { fractionDigits: 0 })}</strong>
            </p>
            {freeCashMinor < 0 ? (
              <p className="text-xs text-destructive">{ru.onboarding.freeCashNegative}</p>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h1 className="text-xl font-semibold">{ru.onboarding.accountsTitle}</h1>
            <p className="text-sm text-muted-foreground">{ru.onboarding.accountsText}</p>
            <Field label={ru.onboarding.savingsLabel}>
              {(id) => (
                <NumberInput
                  id={id}
                  autoFocus
                  value={numbers.savingsRub}
                  data-testid="onboarding-savings"
                  onValueChange={(value) => setNumber('savingsRub', value)}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={ru.onboarding.debtBalanceLabel}>
                {(id) => (
                  <NumberInput
                    id={id}
                    autoFocus
                    value={numbers.debtBalanceRub}
                    data-testid="onboarding-debt"
                    onValueChange={(value) => setNumber('debtBalanceRub', value)}
                  />
                )}
              </Field>
              <Field label={ru.onboarding.debtPaymentLabel}>
                {(id) => (
                  <NumberInput
                    id={id}
                    autoFocus
                    value={numbers.debtPaymentRub}
                    data-testid="onboarding-debt-payment"
                    onValueChange={(value) => setNumber('debtPaymentRub', value)}
                  />
                )}
              </Field>
              <Field label={ru.onboarding.debtRateLabel}>
                {(id) => (
                  <NumberInput
                    id={id}
                    value={debtRate}
                    data-testid="onboarding-debt-rate"
                    onValueChange={(value) => {
                      setDebtRate(value);
                      setAnswers((current) => ({
                        ...current,
                        debtRatePercent: value.trim() ? parseNumericInput(value) : undefined,
                      }));
                    }}
                  />
                )}
              </Field>
            </div>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h1 className="text-xl font-semibold">{ru.onboarding.goalTitle}</h1>
            <p className="text-sm text-muted-foreground">{ru.onboarding.goalText}</p>
            <Field label={ru.onboarding.goalNameLabel}>
              {(id) => (
                <Input
                  id={id}
                  autoFocus
                  placeholder={ru.onboarding.goalNamePlaceholder}
                  defaultValue={answers.goalName}
                  data-testid="onboarding-goal-name"
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, goalName: event.target.value }))
                  }
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={ru.onboarding.goalCostLabel}>
                {(id) => (
                  <NumberInput
                    id={id}
                    autoFocus
                    value={numbers.goalCostRub}
                    data-testid="onboarding-goal-cost"
                    onValueChange={(value) => setNumber('goalCostRub', value)}
                  />
                )}
              </Field>
              <Field label={ru.onboarding.goalMonthLabel}>
                {(id) => (
                  <Input
                    id={id}
                    type="month"
                    value={answers.goalTargetMonth ?? ''}
                    data-testid="onboarding-goal-month"
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, goalTargetMonth: event.target.value }))
                    }
                  />
                )}
              </Field>
            </div>
            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                  checked={answers.goalExactSum ?? false}
                  data-testid="onboarding-goal-exact"
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, goalExactSum: event.target.checked }))
                  }
                />
                {ru.onboarding.goalExactLabel}
              </label>
              {answers.goalExactSum ? null : (
                <p className="pl-6 text-xs text-muted-foreground">{ru.onboarding.goalInflationNote}</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{ru.onboarding.summaryTitle}</p>
              <p className="mt-1">{ru.onboarding.summaryPlan}</p>
              <p className="mt-1">{ru.onboarding.summaryReserve}</p>
            </div>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void finish(true)}
          data-testid="onboarding-skip"
        >
          {ru.onboarding.skip}
        </Button>

        <div className="flex gap-2">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep((current) => current - 1)}
              data-testid="onboarding-back"
            >
              {ru.onboarding.back}
            </Button>
          ) : null}

          {step < STEPS ? (
            <Button onClick={() => setStep((current) => current + 1)} data-testid="onboarding-next">
              {ru.onboarding.next}
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void finish(false)} data-testid="onboarding-finish">
              {ru.onboarding.finish}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {ru.onboarding.privacyNote}{' '}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
          {ru.site.privacyLink}
        </Link>
      </p>
    </main>
  );
}
