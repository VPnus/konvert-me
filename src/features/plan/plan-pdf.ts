/**
 * The financial plan as a PDF to print or to keep. The document is built from the same
 * data and the same words as the screen; pdfmake and its font are loaded only when the
 * button is pressed, so the app does not carry a megabyte for a file made once a quarter.
 *
 * The font is the Roboto that comes with pdfmake: it has Cyrillic, the ruble sign and the
 * no-break space the ruble amounts are formatted with.
 */

import type { Content, TDocumentDefinitions, TVirtualFileSystem } from 'pdfmake/interfaces';

import { horizonBand, strategicAllocation, ASSET_CLASSES } from '@/core/portfolio';
import { monthsBetween, todayIso, type IsoDate } from '@/core/time';
import { RESERVE_GOAL_ID } from '@/db/repositories/goals';
import type { PlanData } from '@/features/plan/plan-data';
import { debtQueue, savingsBenchmark } from '@/features/plan/debts';
import {
  actionText,
  dateInText,
  debtAdvice,
  monthInText,
  percentOf,
  rubles,
  t,
} from '@/features/plan/plan-format';
import { fill, strings } from '@/i18n';
import { percentLabel } from '@/i18n/format';
import { downloadBlob } from '@/lib/download';
import { monthsLabel } from '@/features/goals/months-label';

/** Roboto has no narrow no-break space; the plain one looks the same in print. */
function clean(value: string): string {
  return value.replace(/\u202F/g, '\u00A0');
}

function heading(step: number): Content {
  return { text: clean(`${step}. ${t.steps[step - 1].title}`), style: 'heading' };
}

function subheading(value: string): Content {
  return { text: clean(value), style: 'subheading' };
}

function paragraph(value: string): Content {
  return { text: clean(value), margin: [0, 0, 0, 6] };
}

function rows(pairs: readonly (readonly [string, string])[]): Content {
  return {
    table: {
      widths: ['*', 'auto'],
      body: pairs.map(([label, value]) => [
        { text: clean(label), color: '#555555' },
        { text: clean(value), alignment: 'right' },
      ]),
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 8],
  };
}

function note(value: string): Content[] {
  return value.trim() ? [subheading(t.note), paragraph(value.trim())] : [];
}

function diagnosis(data: PlanData): Content[] {
  const d = t.diagnosis;
  const { overview, budget } = data;
  return [
    heading(1),
    subheading(d.budget),
    paragraph(budget.debtsShort ? d.balance.debtsShort : d.balance[budget.balance]),
    rows([
      [d.income, rubles(budget.incomeMinor)],
      [d.expense, rubles(budget.expenseMinor)],
      [d.free, rubles(budget.freeCashMinor)],
      ...(budget.principalDueMinor > 0
        ? ([[d.afterDebts, rubles(budget.afterDebtsMinor)]] as [string, string][])
        : []),
    ]),
    paragraph(
      budget.source === 'fact'
        ? fill(d.budgetFromFact, { months: monthsLabel(budget.months) })
        : budget.source === 'plan'
          ? d.budgetFromPlan
          : d.budgetFromMonth,
    ),
    subheading(d.capital),
    rows([
      [d.assets, rubles(overview.assetsMinor)],
      [d.liabilities, rubles(overview.liabilitiesMinor)],
      [d.capital, rubles(overview.netWorthMinor)],
    ]),
    subheading(d.debt),
    paragraph(
      !overview.hasDebts
        ? d.debtStatus.none
        : overview.debtBurden.ratio === null
          ? d.debtStatus.unknown
          : `${fill(d.debtRatio, { percent: percentOf(overview.debtBurden.ratio) })}. ${d.debtStatus[overview.debtBurden.status]}`,
    ),
    subheading(d.reserve),
    rows([[t.protection.reserveNow, rubles(overview.reserve.reserveMinor)]]),
    subheading(d.protection),
    paragraph(
      data.policies.length > 0
        ? `${fill(d.policies, { count: data.policies.length })}: ${data.policies.map((policy) => policy.name).join(', ')}`
        : d.noPolicies,
    ),
  ];
}

function goals(data: PlanData): Content[] {
  const g = t.goals;
  const pdf = t.pdf;
  const views = data.goals.goals.filter(
    (view) => view.goal.status !== 'done' && view.goal.id !== RESERVE_GOAL_ID,
  );
  const content: Content[] = [heading(2)];

  content.push(
    views.length === 0
      ? paragraph(pdf.goalsNone)
      : {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: [
              [t.mechanisms.goal, pdf.goalTerm, pdf.goalMonthly].map((text) => ({ text, color: '#555555' })),
              ...views.map((view) => [
                clean(view.goal.name),
                view.goal.targetMonth ? monthInText(view.goal.targetMonth) : '—',
                {
                  text: clean(
                    view.plan?.status === 'active'
                      ? rubles(view.plan.contributionMinor)
                      : view.plan?.status === 'funded'
                        ? g.funded
                        : view.plan?.status === 'overdue'
                          ? g.overdue
                          : g.paused,
                  ),
                  alignment: 'right' as const,
                },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 8],
        },
  );

  for (const view of data.education) {
    const e = t.education;
    content.push(subheading(fill(pdf.childTitle, { name: view.item.name })));
    content.push(
      rows([
        [e.startMonth, monthInText(view.item.startMonth)],
        [e.capital, rubles(view.capitalMinor)],
        ...(view.contributionMinor === null
          ? []
          : ([
              [e.contribution, rubles(view.contributionMinor)],
              [
                e.course,
                fill(e.courseValue, {
                  sum: rubles(view.courseSumMinor),
                  amount: rubles(view.courseContributionMinor ?? 0),
                }),
              ],
            ] as const)),
      ]),
    );
  }

  const pension = data.pension;
  if (pension) {
    const p = t.pension;
    content.push(subheading(pdf.pensionTitle));
    content.push(
      rows([
        [p.retirement.replace(': {month}', ''), monthInText(pension.retirementMonth)],
        [p.desired, rubles(pension.need.desiredMonthlyMinor)],
        [p.state, rubles(pension.pension.statePensionMinor)],
        [
          fill(p.gapAtRetirement, { year: pension.retirementMonth.slice(0, 4) }),
          rubles(pension.need.gapAtRetirementMinor),
        ],
        [fill(p.spendCapital, { age: pension.pension.lifeAge }), rubles(pension.spendCapitalMinor)],
        [p.keepCapital, pension.keepCapitalMinor === null ? '—' : rubles(pension.keepCapitalMinor)],
        ...(pension.contributionMinor === null
          ? []
          : ([[p.contribution, rubles(pension.contributionMinor)]] as const)),
      ]),
    );
    if (pension.keepCapitalMinor === null) content.push(paragraph(p.keepImpossible));
  }
  return content;
}

function mechanisms(data: PlanData): Content[] {
  const m = t.mechanisms;
  const { goals: g } = data;
  const needed = g.allocations.reduce((total, allocation) => total + allocation.requiredMinor, 0);
  return [
    heading(3),
    rows([
      [m.free, rubles(g.freeCashMinor)],
      ...(g.principalDueMinor > 0
        ? ([
            [m.principal, rubles(g.principalDueMinor)],
            [m.available, rubles(g.availableMinor)],
          ] as [string, string][])
        : []),
      [m.needed, rubles(needed)],
    ]),
    paragraph(
      g.allocations.length === 0
        ? m.noGoals
        : g.totalDeficitMinor > 0
          ? fill(m.short, { amount: rubles(g.totalDeficitMinor) })
          : fill(m.enough, { amount: rubles(g.leftoverMinor) }),
    ),
    ...note(data.plan.notes.mechanisms),
  ];
}

function protection(data: PlanData): Content[] {
  const p = t.protection;
  const reserve = data.goals.reserve;
  const pairs: [string, string][] = [[p.reserveNow, rubles(reserve.reserveMinor)]];
  if (reserve.targetMinor !== null) {
    pairs.push([p.reserveShort, rubles(Math.max(reserve.targetMinor - reserve.reserveMinor, 0))]);
  }
  const lifePolicies = data.policies.filter((policy) => policy.type === 'life' || policy.type === 'health');
  const propertyPolicies = data.policies.filter(
    (policy) => policy.type === 'property' || policy.type === 'vehicle',
  );

  return [
    heading(4),
    subheading(p.reserveTitle),
    rows(pairs),
    subheading(p.insuranceTitle),
    rows([
      [p.risks.life, lifePolicies.map((policy) => policy.name).join(', ') || p.notCovered],
      [p.risks.property, propertyPolicies.map((policy) => policy.name).join(', ') || p.notCovered],
    ]),
    ...note(data.plan.notes.protection),
  ];
}

function optimization(data: PlanData): Content[] {
  const o = t.optimization;
  const benchmark = savingsBenchmark(
    data.overview.accounts,
    data.overview.balances,
    data.goals.settings.defaultReturnRate,
  );
  const debts = debtQueue({
    accounts: data.overview.accounts,
    balances: data.overview.balances,
    cards: data.overview.cards,
    benchmark,
  });
  const reserve = data.goals.reserve;
  const idle = reserve.targetMinor === null ? 0 : Math.max(reserve.reserveMinor - reserve.targetMinor, 0);

  return [
    heading(5),
    subheading(o.debtsTitle),
    debts.length === 0
      ? paragraph(o.noDebts)
      : rows(
          debts.map((debt) => {
            const rate =
              debt.account.rate === undefined
                ? o.noRate
                : fill(o.rate, { rate: percentOf(debt.account.rate) });
            const advice = debtAdvice(debt, benchmark);
            return [debt.account.name, advice ? `${rate}. ${advice}` : rate];
          }),
        ),
    paragraph(idle > 0 ? fill(o.idle, { amount: rubles(idle) }) : o.noIdle),
    ...note(data.plan.notes.optimization),
  ];
}

function strategy(data: PlanData): Content[] {
  const s = t.strategy;
  const profile = data.plan.riskProfile;
  const content: Content[] = [
    heading(6),
    rows([[t.pdf.riskProfile, profile ? s.profiles[profile].title : t.pdf.riskNotChosen]]),
    paragraph(s.reserve),
  ];

  if (profile) {
    for (const view of data.goals.goals) {
      if (view.goal.id === RESERVE_GOAL_ID || view.goal.status !== 'active' || !view.goal.targetMonth)
        continue;
      const months = monthsBetween(data.goals.month, view.goal.targetMonth);
      const shares = strategicAllocation(months, profile);
      content.push(
        paragraph(
          `${fill(t.pdf.allocation, { name: view.goal.name, term: s.horizon[horizonBand(months)] })}: ${ASSET_CLASSES.filter(
            (asset) => shares[asset] > 0,
          )
            .map((asset) => `${s.classes[asset]} ${percentLabel(shares[asset])}`)
            .join(', ')}`,
        ),
      );
    }
  }
  content.push(paragraph(s.rebalance), paragraph(`${s.example} ${strings.app.disclaimer}`));
  return content;
}

function actions(data: PlanData): Content[] {
  const done = new Set(data.plan.doneActions);
  return [
    heading(7),
    {
      ul: data.actions.map((action) =>
        clean(`${actionText(action)} — ${done.has(action.key) ? t.pdf.done : t.pdf.notDone}`),
      ),
      margin: [0, 0, 0, 8],
    },
  ];
}

function review(data: PlanData): Content[] {
  const r = t.review;
  return [
    heading(8),
    paragraph(fill(r.nextQuarterly, { date: dateInText(data.review.nextQuarterly) })),
    paragraph(fill(r.nextYearly, { date: dateInText(data.review.nextYearly) })),
    paragraph(r.quarterlyLead),
    paragraph(r.yearlyLead),
    paragraph(r.alsoWhen),
  ];
}

export function buildPlanDocument(data: PlanData, today: IsoDate): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [48, 48, 48, 56],
    info: { title: t.pdf.title, creator: strings.app.name },
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.2 },
    styles: {
      title: { fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
      heading: { fontSize: 14, bold: true, margin: [0, 14, 0, 6] },
      subheading: { fontSize: 11, bold: true, margin: [0, 4, 0, 4] },
    },
    content: [
      { text: t.pdf.title, style: 'title' },
      { text: clean(fill(t.pdf.madeOn, { date: dateInText(today) })), color: '#555555' },
      ...diagnosis(data),
      ...goals(data),
      ...mechanisms(data),
      ...protection(data),
      ...optimization(data),
      ...strategy(data),
      ...actions(data),
      ...review(data),
    ],
    footer: (page, pages) => ({
      columns: [
        { text: strings.app.disclaimer, fontSize: 7, color: '#777777', width: '*' },
        {
          text: fill(t.pdf.page, { page, pages }),
          fontSize: 7,
          color: '#777777',
          alignment: 'right',
          width: 'auto',
        },
      ],
      margin: [48, 16, 48, 0],
    }),
  };
}

/** A module loaded as CommonJS keeps its export under default; one loaded as ESM does not. */
function unwrap<T>(loaded: T): T {
  return (loaded as { default?: T }).default ?? loaded;
}

export async function downloadPlanPdf(data: PlanData, today: IsoDate = todayIso()): Promise<void> {
  const [pdfMakeModule, fontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = unwrap(pdfMakeModule);
  pdfMake.addVirtualFileSystem(unwrap(fontsModule as unknown as TVirtualFileSystem));

  const blob = await pdfMake.createPdf(buildPlanDocument(data, today)).getBlob();
  downloadBlob(blob, fill(t.pdf.fileName, { date: today }));
}
