import { formatForecast } from '@/core/money';
import type { IsoDate, IsoMonth } from '@/core/time';
import { monthLabel } from '@/features/budget/month-label';
import { dateOfYear } from '@/features/deductions/dates';
import { fill } from '@/features/deductions/fill';
import type { PlanAction } from '@/features/plan/actions';
import { ru } from '@/i18n/ru';

export const t = ru.plan;

/** A forecast in whole rubles: every number of the plan is an estimate. */
export const rubles = (minor: number): string => formatForecast(minor);

export function percentOf(rate: number): string {
  return `${(rate * 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} %`;
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
