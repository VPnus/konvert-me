import type { DeductionSummary } from '@/core/deductions';
import { formatMinor } from '@/core/money';
import type { YearRules } from '@/core/rules';
import { todayIso, type IsoDate } from '@/core/time';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dateOfYear } from '@/features/deductions/dates';
import type { DeductionYearView } from '@/features/deductions/deductions-data';
import { fill } from '@/features/deductions/fill';
import { ru } from '@/i18n/ru';

const t = ru.deductions;

const rubles = (minor: number) => formatMinor(minor, { fractionDigits: 0 });

/**
 * When the return for a sale is due, and its tax. A year still open may have its dates behind
 * it already: then the note says they were, instead of naming a day that is gone.
 */
function saleDeadlineNote(
  year: number,
  rules: Pick<YearRules, 'declarationDeadline' | 'taxPaymentDeadline'>,
  taxMinor: number,
  today: IsoDate,
): string {
  const next = year + 1;
  const fileBy = rules.declarationDeadline.value;
  const payBy = rules.taxPaymentDeadline.value;
  const fileDate = dateOfYear(fileBy, next);
  const fileLate = today > `${next}-${fileBy}`;

  if (taxMinor === 0) return fill(fileLate ? t.saleFileLate : t.saleFile, { year, date: fileDate });

  const values = { year, fileDate, payDate: dateOfYear(payBy, next) };
  if (today > `${next}-${payBy}`) return fill(t.salePayLate, values);
  return fill(fileLate ? t.salePayFileLate : t.salePay, values);
}

function RefundRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="shrink-0 text-right tabular-nums" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

interface RefundCardProps {
  readonly view: DeductionYearView;
  readonly summary: DeductionSummary | undefined;
  /** The employer already gave the child deduction: there is nothing of it to give back. */
  readonly childrenAtWork: boolean;
  /** What earlier returns took of the home, as the answers say now. */
  readonly usedBeforeMinor: number;
  /** The day the deadlines are measured from. */
  readonly today?: IsoDate;
}

/**
 * What the year comes to: the tax back, less the tax on a home sold. Each part says what it
 * gives, so the rows add up to the number on top.
 */
export function RefundCard({
  view,
  summary,
  childrenAtWork,
  usedBeforeMinor,
  today = todayIso(),
}: RefundCardProps) {
  const notes: string[] = [];
  if (view.stage === 'current') notes.push(fill(t.currentHint, { next: view.year + 1 }));
  if (view.stage === 'expired') notes.push(fill(t.expiredHint, { year: view.year }));
  if (!view.rules) notes.push(fill(t.rulesMissing, { year: view.year }));
  else if (view.rules.year !== view.year)
    notes.push(fill(t.rulesBorrowed, { year: view.year, rulesYear: view.rules.year }));

  const rules = view.rules;
  const property = summary?.property;
  const sale = summary?.sale;
  const toPay = summary !== undefined && summary.balanceMinor < 0;
  const next = view.year + 1;

  return (
    <Card data-testid="refund-card">
      <CardHeader className="pb-0">
        <CardTitle className="text-base" data-testid="refund-title">
          {toPay ? t.toPayTitle : t.refundTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-3">
        {notes.map((note) => (
          <p key={note} className="text-sm text-muted-foreground" data-testid="year-note">
            {note}
          </p>
        ))}

        {summary && rules && (summary.taxPaidMinor > 0 || sale) ? (
          <>
            <p className="text-3xl font-semibold tabular-nums" data-testid="refund-total">
              {rubles(Math.abs(summary.balanceMinor))}
            </p>
            <div className="flex flex-col gap-1.5">
              <RefundRow label={t.taxPaid} value={rubles(summary.taxPaidMinor)} testId="refund-tax-paid" />
              {summary.childRefundMinor > 0 ? (
                <RefundRow
                  label={t.partChildren}
                  value={rubles(summary.childRefundMinor)}
                  testId="refund-children"
                />
              ) : summary.childDeductionMinor > 0 && childrenAtWork ? (
                <RefundRow label={t.partChildren} value={t.partChildrenAtWork} testId="refund-children" />
              ) : null}
              {summary.socialRefundMinor > 0 ? (
                <RefundRow
                  label={t.partSocial}
                  value={rubles(summary.socialRefundMinor)}
                  testId="refund-social"
                />
              ) : null}
              {summary.longTermSavingsRefundMinor > 0 ? (
                <RefundRow
                  label={t.partSavings}
                  value={rubles(summary.longTermSavingsRefundMinor)}
                  testId="refund-savings"
                />
              ) : null}
              {property ? (
                <RefundRow
                  label={t.partProperty}
                  value={rubles(property.refundMinor)}
                  testId="refund-property"
                />
              ) : null}
              {sale && sale.taxBeforeMinor > 0 ? (
                <RefundRow label={t.partSale} value={rubles(-sale.taxBeforeMinor)} testId="refund-sale" />
              ) : null}
            </div>

            {property && property.availableMinor === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="refund-property-left">
                {t.propertyUsedUp}
              </p>
            ) : null}
            {property && property.leftMinor > 0 ? (
              <p className="text-sm" data-testid="refund-property-left">
                {fill(t.propertyLeft, { amount: rubles(property.leftMinor) })}{' '}
                {fill(t.propertyNext, { year: next, amount: rubles(usedBeforeMinor + property.usedMinor) })}
              </p>
            ) : null}

            {sale ? (
              <div className="flex flex-col gap-1.5 text-sm" data-testid="refund-sale-notes">
                {sale.exempt ? <p>{t.saleExempt}</p> : null}
                {!sale.exempt && !sale.declarationRequired ? (
                  <p>
                    {fill(t.saleNoDeclaration, { limit: rubles(rules.homeSale.value.deductionLimitMinor) })}
                  </p>
                ) : null}
                {sale.taxBeforeMinor > sale.taxMinor ? (
                  <p>{fill(t.saleOffset, { amount: rubles(sale.taxBeforeMinor - sale.taxMinor) })}</p>
                ) : null}
                {sale.declarationRequired ? (
                  <p data-testid="refund-sale-deadline">
                    {saleDeadlineNote(view.year, rules, sale.taxMinor, today)}
                  </p>
                ) : null}
                {sale.taxMinor > 0 && summary.refundMinor > 0 ? (
                  <p className="text-muted-foreground">{t.saleBalanceHint}</p>
                ) : null}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">{t.refundHint}</p>
          </>
        ) : rules ? (
          <p className="text-sm text-muted-foreground" data-testid="refund-empty">
            {t.refundEmpty}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
