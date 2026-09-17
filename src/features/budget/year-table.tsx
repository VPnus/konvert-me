import { formatMinor } from '@/core/money';
import { monthsOfYear } from '@/core/time';
import type { MonthTotals } from '@/core/budget';
import type { BudgetYearData } from '@/features/budget/budget-data';
import { shortMonthLabel } from '@/features/budget/month-label';
import { strings } from '@/i18n';

function money(minor: number): string {
  return formatMinor(minor, { withCurrency: false, fractionDigits: 0 });
}

const EMPTY: MonthTotals = { incomeMinor: 0, expenseMinor: 0, freeCashMinor: 0 };

interface CellProps {
  readonly factMinor: number;
  readonly planMinor: number;
  readonly negativeIsBad?: boolean;
  readonly testId?: string;
}

/** The fact on top, the plan of the same month underneath in grey. */
function Cell({ factMinor, planMinor, negativeIsBad = false, testId }: CellProps) {
  return (
    <td className="py-1.5 pl-2 text-right align-top tabular-nums">
      <span
        className={`block ${negativeIsBad && factMinor < 0 ? 'text-destructive' : ''}`}
        data-testid={testId}
      >
        {money(factMinor)}
      </span>
      {planMinor === 0 ? null : (
        <span className="block text-[10px] text-muted-foreground">
          {strings.budget.year.planned} {money(planMinor)}
        </span>
      )}
    </td>
  );
}

/** Twelve months and the total, the way the template of the course lays out a year. */
export function YearTable({ data }: { data: BudgetYearData }) {
  const months = monthsOfYear(data.year);

  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[320px] border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border text-right text-[11px] text-muted-foreground sm:text-xs">
              <th className="py-2 text-left font-medium">{strings.budget.year.month}</th>
              <th className="py-2 pl-2 font-medium">{strings.budget.year.income}</th>
              <th className="py-2 pl-2 font-medium">{strings.budget.year.expense}</th>
              <th className="py-2 pl-2 font-medium">{strings.budget.year.free}</th>
            </tr>
          </thead>

          <tbody>
            {months.map((month) => {
              const fact = data.fact.byMonth[month] ?? EMPTY;
              const plan = data.plan.byMonth[month] ?? EMPTY;
              const untouched =
                fact.incomeMinor === 0 &&
                fact.expenseMinor === 0 &&
                plan.incomeMinor === 0 &&
                plan.expenseMinor === 0;

              return (
                <tr
                  key={month}
                  className={`border-b border-border/40 ${untouched ? 'text-muted-foreground' : ''}`}
                  data-testid={`year-row-${month}`}
                >
                  <td className="py-1.5 pr-2 capitalize">{shortMonthLabel(month)}</td>
                  <Cell factMinor={fact.incomeMinor} planMinor={plan.incomeMinor} />
                  <Cell factMinor={fact.expenseMinor} planMinor={plan.expenseMinor} />
                  <Cell factMinor={fact.freeCashMinor} planMinor={plan.freeCashMinor} negativeIsBad />
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-2">{strings.budget.year.total}</td>
              <Cell
                factMinor={data.fact.incomeMinor}
                planMinor={data.plan.incomeMinor}
                testId="year-income"
              />
              <Cell
                factMinor={data.fact.expenseMinor}
                planMinor={data.plan.expenseMinor}
                testId="year-expense"
              />
              <Cell
                factMinor={data.fact.freeCashMinor}
                planMinor={data.plan.freeCashMinor}
                negativeIsBad
                testId="year-free"
              />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="pt-3 text-xs text-muted-foreground">{strings.budget.year.hint}</p>
    </div>
  );
}
