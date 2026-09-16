import { formatMinor, roundToMinor } from '@/core/money';
import { monthsLabel } from '@/features/goals/months-label';
import { ru } from '@/i18n/ru';
import { BigNumber, ProgressBar, WidgetEmpty, WidgetFrame } from '@/features/overview/widgets/widget-shell';
import type { WidgetProps } from '@/features/overview/widgets/types';

export function FreeCashWidget({ data }: WidgetProps) {
  if (!data.hasPlan && !data.hasTransactions) {
    return (
      <WidgetFrame title={ru.widgets.freeCash.title}>
        <WidgetEmpty
          text={ru.widgets.freeCash.empty}
          actionLabel={ru.widgets.freeCash.emptyAction}
          to="/budget"
        />
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={ru.widgets.freeCash.title}>
      <BigNumber
        value={formatMinor(data.fact.freeCashMinor, { fractionDigits: 0 })}
        tone={data.fact.freeCashMinor < 0 ? 'negative' : 'default'}
      />
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>{ru.widgets.freeCash.fact}:</dt>
          <dd className="tabular-nums">{formatMinor(data.fact.freeCashMinor, { fractionDigits: 0 })}</dd>
        </div>
        <div className="flex gap-1">
          <dt>{ru.widgets.freeCash.plan}:</dt>
          <dd className="tabular-nums">{formatMinor(data.plan.freeCashMinor, { fractionDigits: 0 })}</dd>
        </div>
      </dl>
    </WidgetFrame>
  );
}

export function ReserveWidget({ data }: WidgetProps) {
  const { reserve, averageExpenses } = data;

  if (reserve.status === 'unknown') {
    return (
      <WidgetFrame title={ru.widgets.reserve.title}>
        <WidgetEmpty
          text={ru.widgets.reserve.empty}
          actionLabel={ru.widgets.reserve.emptyAction}
          to="/budget"
        />
      </WidgetFrame>
    );
  }

  const months = reserve.months ?? 0;
  const target = data.settings.reserveTargetMonths;
  const basis =
    averageExpenses.source === 'plan'
      ? ru.widgets.reserve.basisPlan
      : ru.widgets.reserve.basisFact.replace('{months}', monthsLabel(averageExpenses.months));

  return (
    <WidgetFrame title={ru.widgets.reserve.title} hint={basis}>
      <BigNumber value={`${months.toFixed(1).replace('.', ',')} ${ru.widgets.reserve.months}`} />
      <ProgressBar value={months / target} tone={months < 3 ? 'warning' : 'primary'} />
      <p className="text-xs text-muted-foreground">
        {formatMinor(roundToMinor(reserve.reserveMinor), { fractionDigits: 0 })}
        {reserve.targetMinor !== null
          ? ` · ${ru.widgets.reserve.target}: ${formatMinor(roundToMinor(reserve.targetMinor), { fractionDigits: 0 })}`
          : ''}
      </p>
    </WidgetFrame>
  );
}

export function NetWorthWidget({ data }: WidgetProps) {
  if (data.accounts.length === 0) {
    return (
      <WidgetFrame title={ru.widgets.netWorth.title}>
        <WidgetEmpty
          text={ru.widgets.netWorth.empty}
          actionLabel={ru.widgets.netWorth.emptyAction}
          to="/balance"
        />
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={ru.widgets.netWorth.title}>
      <BigNumber
        value={formatMinor(data.netWorthMinor, { fractionDigits: 0 })}
        tone={data.netWorthMinor < 0 ? 'negative' : 'default'}
      />
      <p className="text-xs text-muted-foreground">
        {ru.widgets.netWorth.assets}: {formatMinor(data.assetsMinor, { fractionDigits: 0 })} ·{' '}
        {ru.widgets.netWorth.liabilities}: {formatMinor(data.liabilitiesMinor, { fractionDigits: 0 })}
      </p>
    </WidgetFrame>
  );
}

export function DebtBurdenWidget({ data }: WidgetProps) {
  if (!data.hasDebts) {
    return (
      <WidgetFrame title={ru.widgets.debtBurden.title}>
        <WidgetEmpty
          text={ru.widgets.debtBurden.empty}
          actionLabel={ru.widgets.debtBurden.emptyAction}
          to="/balance"
        />
      </WidgetFrame>
    );
  }

  const { ratio, status } = data.debtBurden;
  const label =
    status === 'normal'
      ? ru.widgets.debtBurden.normal
      : status === 'attention'
        ? ru.widgets.debtBurden.attention
        : status === 'tense'
          ? ru.widgets.debtBurden.tense
          : ru.widgets.debtBurden.unknown;

  return (
    <WidgetFrame title={ru.widgets.debtBurden.title}>
      <BigNumber
        value={ratio === null ? '—' : `${(ratio * 100).toFixed(0)} %`}
        tone={status === 'tense' ? 'negative' : 'default'}
      />
      {ratio !== null ? (
        <ProgressBar
          value={ratio}
          tone={status === 'tense' ? 'destructive' : status === 'attention' ? 'warning' : 'primary'}
        />
      ) : null}
      <p className="text-xs text-muted-foreground">{label}</p>
    </WidgetFrame>
  );
}
