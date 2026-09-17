import type { Account } from '@/db/models';
import { monthsLabel } from '@/features/goals/months-label';
import type { PlanData } from '@/features/plan/plan-data';
import { percentOf, rubles, t } from '@/features/plan/plan-format';
import { Muted, PlanCard, Row } from '@/features/plan/plan-parts';
import { fill, strings } from '@/i18n';

const d = t.diagnosis;

/** "Дебетовая карта ×2, Вклад": what the family holds, by kind. */
function productsOf(accounts: readonly Account[]): string {
  const counts = new Map<Account['type'], number>();
  for (const account of accounts) {
    if (account.archived) continue;
    counts.set(account.type, (counts.get(account.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) =>
      count > 1 ? `${strings.accounts.types[type]} ×${count}` : strings.accounts.types[type],
    )
    .join(', ');
}

/** Step 1 of lesson 2.7: where the family stands, from the other tabs. */
export function DiagnosisStep({ data }: { data: PlanData }) {
  const { overview, budget, policies } = data;
  const reserve = overview.reserve;
  const products = productsOf(overview.accounts);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PlanCard
        title={d.budget}
        link={{ to: '/budget', label: strings.nav.budget }}
        testId="diagnosis-budget"
      >
        <p className="font-medium" data-testid="diagnosis-balance">
          {budget.debtsShort ? d.balance.debtsShort : d.balance[budget.balance]}
        </p>
        <Row label={d.income} value={rubles(budget.incomeMinor)} />
        <Row label={d.expense} value={rubles(budget.expenseMinor)} />
        <Row label={d.free} value={rubles(budget.freeCashMinor)} strong testId="diagnosis-free" />
        {budget.principalDueMinor > 0 ? (
          <Row label={d.afterDebts} value={rubles(budget.afterDebtsMinor)} testId="diagnosis-after-debts" />
        ) : null}
        <Muted>
          {budget.source === 'fact'
            ? fill(d.budgetFromFact, { months: monthsLabel(budget.months) })
            : budget.source === 'plan'
              ? d.budgetFromPlan
              : d.budgetFromMonth}
        </Muted>
      </PlanCard>

      <PlanCard title={d.capital} link={{ to: '/balance', label: strings.nav.balance }}>
        <Row label={d.assets} value={rubles(overview.assetsMinor)} />
        <Row label={d.liabilities} value={rubles(overview.liabilitiesMinor)} />
        <Row label={d.capital} value={rubles(overview.netWorthMinor)} strong testId="diagnosis-net-worth" />
      </PlanCard>

      <PlanCard title={d.debt} link={{ to: '/balance', label: strings.nav.balance }}>
        {!overview.hasDebts ? (
          <Muted>{d.debtStatus.none}</Muted>
        ) : (
          <>
            {overview.debtBurden.ratio !== null ? (
              <p className="font-medium" data-testid="diagnosis-debt">
                {fill(d.debtRatio, { percent: percentOf(overview.debtBurden.ratio) })}
              </p>
            ) : null}
            <Muted>{d.debtStatus[overview.debtBurden.status]}</Muted>
          </>
        )}
      </PlanCard>

      <PlanCard title={d.reserve} link={{ to: '/goals', label: strings.nav.goals }}>
        {reserve.months === null ? (
          <Muted>{d.reserveUnknown}</Muted>
        ) : (
          <p className="font-medium" data-testid="diagnosis-reserve">
            {fill(d.reserveMonths, {
              months: `${reserve.months.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} мес.`,
            })}
          </p>
        )}
        <Row label={t.protection.reserveNow} value={rubles(reserve.reserveMinor)} />
        <Muted>{d.reserveNorm}</Muted>
      </PlanCard>

      <PlanCard title={d.protection} link={{ to: '/balance', label: strings.nav.balance }}>
        <p className="font-medium">
          {policies.length > 0 ? fill(d.policies, { count: policies.length }) : d.noPolicies}
        </p>
        {policies.length > 0 ? <Muted>{policies.map((policy) => policy.name).join(', ')}</Muted> : null}
      </PlanCard>

      <PlanCard title={d.products} link={{ to: '/balance', label: strings.nav.balance }}>
        <Muted>{products || d.noAccounts}</Muted>
      </PlanCard>
    </div>
  );
}
