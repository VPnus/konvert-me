import { formatForecast } from '@/core/money';
import type { IsoDate, IsoMonth } from '@/core/time';
import { monthLabel } from '@/features/budget/month-label';
import { dateOfYear } from '@/features/deductions/dates';
import type { PlanAction } from '@/features/plan/actions';
import type { Benchmark, DebtInQueue } from '@/features/plan/debts';
import { fill, strings } from '@/i18n';
import { percentLabel } from '@/i18n/format';

export const t = strings.plan;

/** A forecast in whole rubles: every number of the plan is an estimate. */
export const rubles = (minor: number): string => formatForecast(minor);

export function percentOf(rate: number): string {
  return percentLabel(rate * 100, 2);
}

/** "2034-09" → "сентябрь 2034", to sit in the middle of a sentence. */
export function monthInText(month: IsoMonth): string {
  const label = monthLabel(month);
  return label.charAt(0).toLocaleLowerCase('ru') + label.slice(1);
}

/** "2026-12-16" → "16 декабря 2026 года". */
export function dateInText(date: IsoDate): string {
  return dateOfYear(date.slice(5), Number(date.slice(0, 4)));
}

/** A percent field of a form: "8,83" → 0.0883. */
export function rateText(rate: number): string {
  return String(Math.round(rate * 10_000) / 100);
}

/** What an action of step 7 says, on the screen and in the PDF alike. */
export function actionText(action: PlanAction): string {
  switch (action.kind) {
    case 'statement':
      return fill(t.actions.statement, {
        name: action.name,
        amount: rubles(action.amountMinor),
        date: dateInText(action.dueDate),
      });
    case 'reserve':
      return fill(t.actions.reserve, { amount: rubles(action.amountMinor) });
    case 'insurance':
      return t.actions.insurance;
    case 'account':
      return fill(t.actions.account, { name: action.name });
    case 'contribution':
      return fill(t.actions.contribution, { name: action.name, amount: rubles(action.amountMinor) });
    case 'debt':
      return fill(t.actions.debt, { name: action.name, rate: percentOf(action.rate) });
    case 'deductions':
      return t.actions.deductions;
  }
}

/** What the plan says of a debt in the queue: pay the statement, it is free, it is dear, or nothing. */
export function debtAdvice(debt: DebtInQueue, benchmark: Benchmark): string | null {
  if (debt.statement) {
    return fill(t.optimization.statement, {
      date: dateInText(debt.statement.dueDate),
      amount: rubles(debt.statement.remainingMinor),
    });
  }
  if (debt.free) return t.optimization.free;
  if (debt.grace.kind === 'missed' || debt.grace.kind === 'grace-ended') {
    return debt.dear ? `${t.optimization.lost} ${adviceOfDear(benchmark)}` : t.optimization.lost;
  }
  return debt.dear ? adviceOfDear(benchmark) : null;
}

function adviceOfDear(benchmark: Benchmark): string {
  return benchmark.accountName
    ? fill(t.optimization.dearAccount, { rate: percentOf(benchmark.rate), account: benchmark.accountName })
    : fill(t.optimization.dear, { rate: percentOf(benchmark.rate) });
}
