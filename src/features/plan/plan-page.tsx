import { useLiveQuery } from 'dexie-react-hooks';
import { FileDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { loadPlan, type PlanData } from '@/features/plan/plan-data';
import { t } from '@/features/plan/plan-format';
import { ActionsStep } from '@/features/plan/steps/actions-step';
import { DiagnosisStep } from '@/features/plan/steps/diagnosis-step';
import { GoalsStep } from '@/features/plan/steps/goals-step';
import { MechanismsStep } from '@/features/plan/steps/mechanisms-step';
import { OptimizationStep } from '@/features/plan/steps/optimization-step';
import { ProtectionStep } from '@/features/plan/steps/protection-step';
import { ReviewStep } from '@/features/plan/steps/review-step';
import { StrategyStep } from '@/features/plan/steps/strategy-step';
import { useDataVersion } from '@/hooks/use-data-version';
import { fill, strings } from '@/i18n';
import { cn } from '@/lib/utils';

const STEPS: readonly ((props: { data: PlanData }) => ReactNode)[] = [
  DiagnosisStep,
  GoalsStep,
  MechanismsStep,
  ProtectionStep,
  OptimizationStep,
  StrategyStep,
  ActionsStep,
  ReviewStep,
];

/** The step lives in the address, so a reload, a link from the reminder and the back button all keep it. */
function stepOf(value: string | null): number {
  const step = Number(value);
  return Number.isInteger(step) && step >= 1 && step <= STEPS.length ? step : 1;
}

export default function PlanPage() {
  const dataVersion = useDataVersion();
  const data = useLiveQuery(() => loadPlan(), [dataVersion]);
  const [params, setParams] = useSearchParams();
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | string>('idle');
  const step = stepOf(params.get('step'));
  const Step = STEPS[step - 1];
  const go = (next: number) => {
    setParams({ step: String(next) });
    window.scrollTo({ top: 0 });
  };

  const downloadPdf = async () => {
    if (!data) return;
    setPdfState('busy');
    try {
      // pdfmake and its font weigh a megabyte: they come only with the first press.
      const { downloadPlanPdf } = await import('@/features/plan/plan-pdf');
      await downloadPlanPdf(data);
      setPdfState('idle');
    } catch (cause) {
      setPdfState(
        fill(t.pdf.failed, { reason: cause instanceof Error ? cause.message : strings.common.error }),
      );
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{strings.pages.plan.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button
          variant="outline"
          disabled={!data || pdfState === 'busy'}
          data-testid="plan-pdf"
          onClick={() => void downloadPdf()}
        >
          <FileDown className="size-4" aria-hidden />
          {pdfState === 'busy' ? t.pdf.preparing : t.pdf.download}
        </Button>
      </div>
      {pdfState !== 'idle' && pdfState !== 'busy' ? (
        <p role="alert" className="text-sm text-destructive" data-testid="plan-pdf-error">
          {pdfState}
        </p>
      ) : null}

      <ol className="flex flex-wrap gap-2" aria-label={t.stepsLabel}>
        {t.steps.map((item, index) => {
          const number = index + 1;
          const current = number === step;
          return (
            <li key={item.title}>
              <Button
                size="sm"
                variant={current ? 'default' : 'outline'}
                aria-current={current ? 'step' : undefined}
                data-testid={`plan-step-${number}`}
                onClick={() => go(number)}
              >
                <span className={cn('tabular-nums', !current && 'text-muted-foreground')}>{number}</span>
                {item.title}
              </Button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{fill(t.stepOf, { n: step })}</p>
        <h2 className="text-xl font-semibold" data-testid="plan-step-title">
          {t.steps[step - 1].title}
        </h2>
        <p className="text-sm text-muted-foreground">{t.steps[step - 1].lead}</p>
      </div>

      {data ? (
        <Step data={data} />
      ) : (
        <p className="text-sm text-muted-foreground">{strings.common.loading}</p>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={step === 1} data-testid="plan-back" onClick={() => go(step - 1)}>
          {t.back}
        </Button>
        <Button disabled={step === STEPS.length} data-testid="plan-next" onClick={() => go(step + 1)}>
          {t.next}
        </Button>
      </div>
    </section>
  );
}
