import { afterEach, describe, expect, it } from 'vitest';

import { formatMinor } from '@/core/money';
import { daysLabel } from '@/features/balance/days-label';
import { monthsLabel } from '@/features/goals/months-label';
import { strings } from '@/i18n';
import { en } from '@/i18n/en';
import { LANGUAGE_STORAGE_KEY, readLanguage, setLanguageForTests, writeLanguage } from '@/i18n/locale';
import { mergeDraft } from '@/i18n/merge';
import { pluralForm } from '@/i18n/plural';
import { ru } from '@/i18n/ru';

/** A storage of one test, so the language of the page is left alone. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

/** The rule the labels used before Intl: 11–14 many, 1 one, 2–4 few, the rest many. */
function oldRussianForm(count: number, [many, one, few]: readonly [string, string, string]): string {
  const tail = count % 100;
  const last = count % 10;
  return tail >= 11 && tail <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}

/** Every string of a dictionary with its path: "nav.budget" → "Бюджет". */
function wordsOf(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((item, index) => wordsOf(item, `${path}[${index}]`));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => wordsOf(value, path ? `${path}.${key}` : key));
  }
  return [];
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

afterEach(() => setLanguageForTests('ru'));

describe('the language of the page', () => {
  it('is Russian unless another one is saved on the device', () => {
    expect(readLanguage(memoryStorage())).toBe('ru');
    expect(readLanguage(memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'en' }))).toBe('en');
    expect(readLanguage(memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'de' }))).toBe('ru');
    expect(readLanguage(null)).toBe('ru');

    const refusing = {
      getItem: () => {
        throw new Error('private window');
      },
    } as unknown as Storage;
    expect(readLanguage(refusing)).toBe('ru');
  });

  it('is remembered for the next load', () => {
    const store = memoryStorage();
    writeLanguage('en', store);
    expect(readLanguage(store)).toBe('en');
  });

  it('gives the Russian words to the app of these tests', () => {
    expect(strings).toBe(ru);
  });
});

describe('the form of a word for a number', () => {
  it('in Russian is the same as before Intl, for every count up to 250', () => {
    for (let count = 0; count <= 250; count += 1) {
      expect(pluralForm(ru.goals.months, count)).toBe(oldRussianForm(count, ['месяцев', 'месяц', 'месяца']));
      expect(pluralForm(ru.income.days, count)).toBe(oldRussianForm(count, ['дней', 'день', 'дня']));
    }
    expect(monthsLabel(21)).toBe('21 месяц');
    expect(monthsLabel(112)).toBe('112 месяцев');
    expect(daysLabel(3)).toBe('через 3 дня');
  });

  it('in Russian takes the genitive for a fraction: 1,5 месяца', () => {
    expect(pluralForm(ru.goals.months, 1.5)).toBe('месяца');
  });

  it('in English is one or other', () => {
    setLanguageForTests('en');
    const forms = { one: 'month', few: 'months', many: 'months', other: 'months' };
    expect(pluralForm(forms, 1)).toBe('month');
    expect(pluralForm(forms, 0)).toBe('months');
    expect(pluralForm(forms, 22)).toBe('months');
  });
});

describe('the formats', () => {
  it('follow the language: a comma in Russian, a point in English', () => {
    expect(formatMinor(150_050, { withCurrency: false })).toMatch(/^1\s500,50$/);
    setLanguageForTests('en');
    expect(formatMinor(150_050, { withCurrency: false })).toBe('1,500.50');
  });
});

describe('the English draft', () => {
  it('has only words the Russian dictionary has, with the same placeholders', () => {
    const russian = new Map(wordsOf(ru));
    for (const [path, text] of wordsOf(en)) {
      expect(russian.has(path), path).toBe(true);
      expect(placeholders(text), path).toEqual(placeholders(russian.get(path) ?? ''));
    }
  });

  it('replaces the words it has and leaves the Russian ones it has not', () => {
    const merged = mergeDraft(ru, en);
    expect(merged.nav.budget).toBe('Budget');
    expect(merged.overview).toBe(ru.overview);
    expect(merged.budget.months).toBe(ru.budget.months);
  });

  it('replaces a list as a whole', () => {
    const merged = mergeDraft(ru, { budget: { monthsShort: ['Jan'] } });
    expect(merged.budget.monthsShort).toEqual(['Jan']);
    expect(merged.budget.months).toBe(ru.budget.months);
  });
});
