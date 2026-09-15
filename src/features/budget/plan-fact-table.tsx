import { useState } from 'react';

import { formatMinor, rublesToMinor, minorToRubles } from '@/core/money';
import type { IsoMonth } from '@/core/time';
import { NumberInput } from '@/components/ui/number-input';
import type { Category } from '@/db/models';
import { setPlan } from '@/db/repositories/budget-plans';
import type { BudgetMonthData } from '@/features/budget/budget-data';
import { ru } from '@/i18n/ru';
import { parseNumericInput } from '@/lib/numeric-input';

/** Money without the currency sign: the sign lives in the column heading. */
function money(minor: number): string {
  return formatMinor(minor, { withCurrency: false, fractionDigits: 0 });
}

/**
 * What is left of the plan. A plus sign in front of an untouched plan read as if the
 * money had arrived, so the figure is bare and only an overspend carries a minus.
 */
function remainingMoney(minor: number): string {
  return money(minor);
}

interface PlanCellProps {
  readonly month: IsoMonth;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly planMinor: number;
}

/**
 * The plan of one category. It is saved when the field loses focus, so typing never
 * fights with a re-render of the whole table.
 */
function PlanCell({ month, categoryId, categoryName, planMinor }: PlanCellProps) {
  const stored = planMinor === 0 ? '' : String(minorToRubles(planMinor));
  // While nobody is typing the field shows the stored plan, so a copied plan or a
  // change made in another tab appears without any synchronising of its own.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? stored;

  const save = () => {
    setDraft(null);
    const next = value.trim() === '' ? 0 : rublesToMinor(parseNumericInput(value));
    if (next === planMinor) return;
    void setPlan(month, categoryId, next);
  };

  return (
    <NumberInput
      value={value}
      aria-label={`${ru.budget.plan}: ${categoryName}`}
      data-testid={`plan-${categoryId}`}
      className="h-8 px-2 text-right text-xs tabular-nums sm:text-sm"
      onValueChange={setDraft}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

interface GroupRow {
  readonly key: string;
  readonly title: string;
  /** Money already recorded is "получено" for income and "потрачено" for expenses. */
  readonly factLabel: string;
  readonly categories: Category[];
}

function groupsOf(categories: readonly Category[]): GroupRow[] {
  const pick = (test: (category: Category) => boolean): Category[] => categories.filter(test);

  return [
    {
      key: 'income',
      title: ru.budget.incomeGroup,
      factLabel: ru.budget.factIncome,
      categories: pick((c) => c.kind === 'income'),
    },
    {
      key: 'mandatory',
      title: ru.budget.mandatoryGroup,
      factLabel: ru.budget.fact,
      categories: pick((c) => c.kind === 'expense' && c.group === 'mandatory'),
    },
    {
      key: 'variable',
      title: ru.budget.variableGroup,
      factLabel: ru.budget.fact,
      categories: pick((c) => c.kind === 'expense' && c.group === 'variable'),
    },
    {
      key: 'other',
      title: ru.budget.otherGroup,
      factLabel: ru.budget.fact,
      categories: pick((c) => c.kind === 'expense' && !c.group),
    },
  ];
}

interface PlanFactTableProps {
  readonly data: BudgetMonthData;
}

/** The month as the template of lesson 2.9 shows it: the plan, the fact and what is left. */
export function PlanFactTable({ data }: PlanFactTableProps) {
  const byId = new Map(data.rows.map((row) => [row.categoryId, row]));
  const visible = data.categories.filter((category) => byId.has(category.id));
  const groups = groupsOf(visible).filter((group) => group.categories.length > 0);

  const sumOf = (
    categories: readonly Category[],
    field: 'planMinor' | 'factMinor' | 'remainingMinor',
  ): number => categories.reduce((total, category) => total + (byId.get(category.id)?.[field] ?? 0), 0);

  const freeFactMinor = data.fact.freeCashMinor;
  const freePlanMinor = data.plan.freeCashMinor;

  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
        <colgroup>
          <col />
          <col className="w-[78px] sm:w-32" />
          <col className="w-[62px] sm:w-32" />
          <col className="w-[66px] sm:w-32" />
        </colgroup>

        {/* The visible captions live in every group, because the middle one is named
            differently for income and for expenses; this one is for screen readers. */}
        <thead className="sr-only">
          <tr>
            <th>{ru.budget.category}</th>
            <th>{ru.budget.plan}</th>
            <th>{ru.budget.fact}</th>
            <th>{ru.budget.remaining}</th>
          </tr>
        </thead>

        {groups.map((group) => (
          <tbody key={group.key} data-testid={`group-${group.key}`}>
            <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
              <th className="pt-5 pb-1 text-left font-semibold uppercase tracking-wide">{group.title}</th>
              <th className="pt-5 pr-1 pb-1 text-right font-medium">{ru.budget.plan}, ₽</th>
              <th className="pt-5 pr-1 pb-1 text-right font-medium">{group.factLabel}, ₽</th>
              <th className="pt-5 pb-1 text-right font-medium">{ru.budget.remaining}, ₽</th>
            </tr>

            {group.categories.map((category) => {
              const row = byId.get(category.id);
              if (!row) return null;

              return (
                <tr key={category.id} className="border-b border-border/40">
                  <td className="py-1 pr-2">
                    <span className="block truncate" title={category.name}>
                      {category.name}
                    </span>
                  </td>
                  <td className="py-1 pr-1">
                    <PlanCell
                      month={data.month}
                      categoryId={category.id}
                      categoryName={category.name}
                      planMinor={row.planMinor}
                    />
                  </td>
                  <td className="py-1 pr-1 text-right tabular-nums" data-testid={`fact-${category.id}`}>
                    {money(row.factMinor)}
                  </td>
                  <td
                    className={`py-1 text-right tabular-nums ${row.remainingMinor < 0 ? 'text-destructive' : 'text-muted-foreground'}`}
                    data-testid={`remaining-${category.id}`}
                    title={row.remainingMinor < 0 ? ru.budget.overspent : undefined}
                  >
                    {remainingMoney(row.remainingMinor)}
                  </td>
                </tr>
              );
            })}

            <tr className="border-b border-border font-medium">
              <td className="py-1.5 pr-2">{ru.budget.total}</td>
              <td className="py-1.5 pr-1 text-right tabular-nums">
                {money(sumOf(group.categories, 'planMinor'))}
              </td>
              <td className="py-1.5 pr-1 text-right tabular-nums">
                {money(sumOf(group.categories, 'factMinor'))}
              </td>
              <td
                className={`py-1.5 text-right tabular-nums ${sumOf(group.categories, 'remainingMinor') < 0 ? 'text-destructive' : ''}`}
              >
                {remainingMoney(sumOf(group.categories, 'remainingMinor'))}
              </td>
            </tr>
          </tbody>
        ))}

        <tfoot>
          <tr className="border-b border-border">
            <td className="py-2 pr-2 font-medium">{ru.budget.totalIncome}</td>
            <td className="py-2 pr-1 text-right tabular-nums">{money(data.plan.incomeMinor)}</td>
            <td className="py-2 pr-1 text-right tabular-nums" data-testid="total-income">
              {money(data.fact.incomeMinor)}
            </td>
            <td className="py-2 text-right tabular-nums text-muted-foreground">
              {remainingMoney(data.plan.incomeMinor - data.fact.incomeMinor)}
            </td>
          </tr>
          <tr className="border-b border-border">
            <td className="py-2 pr-2 font-medium">{ru.budget.totalExpense}</td>
            <td className="py-2 pr-1 text-right tabular-nums">{money(data.plan.expenseMinor)}</td>
            <td className="py-2 pr-1 text-right tabular-nums" data-testid="total-expense">
              {money(data.fact.expenseMinor)}
            </td>
            <td
              className={`py-2 text-right tabular-nums ${data.plan.expenseMinor - data.fact.expenseMinor < 0 ? 'text-destructive' : 'text-muted-foreground'}`}
              data-testid="total-remaining"
            >
              {remainingMoney(data.plan.expenseMinor - data.fact.expenseMinor)}
            </td>
          </tr>
          <tr>
            <td className="py-2 pr-2 text-sm font-semibold">{ru.budget.freeCash}</td>
            <td className="py-2 pr-1 text-right font-semibold tabular-nums">{money(freePlanMinor)}</td>
            <td
              className={`py-2 pr-1 text-right font-semibold tabular-nums ${freeFactMinor < 0 ? 'text-destructive' : ''}`}
              data-testid="free-cash"
            >
              {money(freeFactMinor)}
            </td>
            <td className="py-2" />
          </tr>
        </tfoot>
      </table>

      <p className="pt-3 text-xs text-muted-foreground">{ru.budget.legend}</p>
      <p className="pt-1 text-xs text-muted-foreground">{ru.budget.freeCashHint}</p>
    </div>
  );
}
