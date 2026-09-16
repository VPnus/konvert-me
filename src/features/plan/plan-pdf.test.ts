import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import {
  saveEducationPlan,
  savePensionPlan,
  savePlanNote,
  setPlanActionDone,
  setRiskProfile,
} from '@/db/repositories/financial-plan';
import { createGoal } from '@/db/repositories/goals';
import { loadPlan } from '@/features/plan/plan-data';
import { buildPlanDocument } from '@/features/plan/plan-pdf';
import { ru } from '@/i18n/ru';

const RUB = 100;
const NOW = new Date(2026, 8, 16, 12);

/** Every string the document will print, in order. */
function textsOf(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsOf);
  if (node && typeof node === 'object') return Object.values(node).flatMap(textsOf);
  return [];
}

beforeEach(async () => {
  await clearAllData();
});

describe('plan: the PDF document', () => {
  it('is an A4 document in Roboto, the font that has Cyrillic and the ruble sign', async () => {
    const document = buildPlanDocument(await loadPlan(NOW), '2026-09-16');

    expect(document.pageSize).toBe('A4');
    expect(document.defaultStyle?.font).toBe('Roboto');
    expect(document.info?.title).toBe('Финансовый план');
  });

  it('goes through all eight steps and says on which day its numbers are', async () => {
    const texts = textsOf(buildPlanDocument(await loadPlan(NOW), '2026-09-16').content);

    ru.plan.steps.forEach((step, index) => expect(texts).toContain(`${index + 1}. ${step.title}`));
    expect(texts.some((text) => text.includes('16 сентября 2026 года'))).toBe(true);
  });

  it('carries the calculations, the choices and the notes of the plan', async () => {
    await createGoal({
      name: 'Квартира',
      kind: 'purchase',
      costMinor: 3_000_000 * RUB,
      targetMonth: '2033-09',
    });
    await saveEducationPlan({
      name: 'Маша',
      yearlyCostMinor: 600_000 * RUB,
      years: 6,
      costAsOf: '2026-09',
      startMonth: '2034-09',
      returnRate: 0.0883,
      inflationRate: 0.069,
    });
    await savePensionPlan({
      birthMonth: '1986-03',
      retirementAge: 60,
      lifeAge: 80,
      monthlyExpensesMinor: 100_000 * RUB,
      replacementRate: 0.7,
      statePensionMinor: 26_000 * RUB,
      costAsOf: '2026-09',
      returnRate: 0.0873,
      inflationRate: 0.069,
      strategy: 'spend-capital',
    });
    await setRiskProfile('moderate');
    await savePlanNote('mechanisms', 'Квартиру — в ипотеку');
    await setPlanActionDone('deductions', true);

    const data = await loadPlan(NOW);
    const texts = textsOf(buildPlanDocument(data, '2026-09-16').content);
    const all = texts.join('\n');

    expect(all).toContain('Квартира');
    expect(all).toContain('Образование: Маша');
    expect(all).toContain('Пенсия');
    expect(all).toContain('Умеренно');
    expect(all).toContain(
      'Квартира, до цели 5–10 лет: Акции 40 %, Облигации 50 %, Недвижимость 5 %, Золото 5 %',
    );
    expect(all).toContain('Квартиру — в ипотеку');
    expect(all).toContain(`${ru.plan.actions.deductions} — сделано`);
    expect(all).toContain(ru.app.disclaimer);
  });

  it('prints no narrow no-break space: Roboto has no glyph for it', async () => {
    const texts = textsOf(buildPlanDocument(await loadPlan(NOW), '2026-09-16').content);
    expect(texts.join('')).not.toMatch(/\u202F/);
  });

  it('numbers the pages under the disclaimer', async () => {
    const document = buildPlanDocument(await loadPlan(NOW), '2026-09-16');
    const footer = typeof document.footer === 'function' ? document.footer(2, 3, {} as never) : null;
    const columns = (footer as { columns: { text: string }[] } | null)?.columns ?? [];

    expect(columns.map((column) => column.text)).toEqual([ru.app.disclaimer, 'Страница 2 из 3']);
  });
});
