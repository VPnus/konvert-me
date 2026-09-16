import { describe, expect, it } from 'vitest';

import { decodeStatement } from '@/lib/statement/decode';
import { guessMapping, isMappingReady } from '@/lib/statement/mapping';
import { applyRules, buildRows, markDuplicates } from '@/lib/statement/rows';
import { parseCsv, toTable } from '@/lib/statement/table';
import { parseAmount, parseStatementDate } from '@/lib/statement/values';

/** Windows-1251 bytes of a Russian string — that is what the banks hand out. */
function toCp1251(text: string): Uint8Array {
  return new Uint8Array(
    [...text].map((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code < 0x80) return code;
      if (char === 'Ё') return 0xa8;
      if (char === 'ё') return 0xb8;
      if (code >= 0x410 && code <= 0x44f) return code - 0x410 + 0xc0;
      if (char === '№') return 0xb9;
      throw new Error(`нет в 1251: ${char}`);
    }),
  );
}

describe('statement: reading the file', () => {
  it('reads a statement written in Windows-1251', () => {
    const text = 'Дата;Сумма;Назначение\r\n05.09.2026;-1 234,56;Кофе на Ленина';
    const decoded = decodeStatement(toCp1251(text));

    expect(decoded).toBe(text);
  });

  it('reads UTF-8, with a byte order mark and without', () => {
    const text = 'Дата;Сумма\n05.09.2026;100';
    const utf8 = new TextEncoder().encode(text);

    expect(decodeStatement(utf8)).toBe(text);
    expect(decodeStatement(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe(text);
  });
});

describe('statement: sums the way banks write them', () => {
  it('understands a decimal comma, spaces and a currency sign', () => {
    expect(parseAmount('1 234,56')).toBe(1234.56);
    expect(parseAmount('1 234,56 ₽')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('2000')).toBe(2000);
    expect(parseAmount('1 000 000')).toBe(1000000);
  });

  it('understands every way of writing a minus', () => {
    expect(parseAmount('-1234,56')).toBe(-1234.56);
    expect(parseAmount('−1234,56')).toBe(-1234.56);
    expect(parseAmount('(1 234,56)')).toBe(-1234.56);
  });

  it('says plainly when a cell is not a sum', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('Итого за период')).toBeNull();
    expect(parseAmount('—')).toBeNull();
  });
});

describe('statement: dates the way banks write them', () => {
  const now = new Date('2026-09-16T12:00:00Z');

  it('reads the usual formats', () => {
    expect(parseStatementDate('05.09.2026')).toBe('2026-09-05');
    expect(parseStatementDate('5/9/2026')).toBe('2026-09-05');
    expect(parseStatementDate('2026-09-05 12:30:00')).toBe('2026-09-05');
    expect(parseStatementDate('05.09.26', now)).toBe('2026-09-05');
  });

  it('refuses what is not a date', () => {
    expect(parseStatementDate('')).toBeNull();
    expect(parseStatementDate('Остаток')).toBeNull();
    expect(parseStatementDate('32.13.2026')).toBeNull();
  });
});

describe('statement: finding the table and the columns', () => {
  const csv = [
    'Выписка по счёту 40817',
    'за период с 01.09.2026 по 30.09.2026',
    'Дата операции;Сумма операции;Назначение платежа',
    '05.09.2026;-1 234,56;Кофейня на Ленина',
    '06.09.2026;120 000,00;Зарплата за август',
    'Итого;118 765,44;',
  ].join('\n');

  it('skips what a bank writes above the table', () => {
    const table = parseCsv(csv);

    expect(table.headers).toEqual(['Дата операции', 'Сумма операции', 'Назначение платежа']);
    expect(table.rows).toHaveLength(3);
  });

  it('guesses which column is which', () => {
    const mapping = guessMapping(parseCsv(csv));

    expect(mapping).toMatchObject({ date: 0, amount: 1, note: 2 });
    expect(isMappingReady(mapping)).toBe(true);
  });

  it('understands two columns instead of one signed', () => {
    const table = parseCsv('Дата;Приход;Расход;Описание\n05.09.2026;;1 500,00;Продукты');
    const mapping = guessMapping(table);

    expect(mapping).toMatchObject({ date: 0, amount: null, income: 1, expense: 2, note: 3 });

    const { rows } = buildRows(table, mapping);
    expect(rows[0]).toMatchObject({ kind: 'expense', amountMinor: 150_000 });
  });

  it('falls back to the content when the headers say nothing', () => {
    const table = toTable([
      ['a', 'b', 'c'],
      ['05.09.2026', '-100,00', 'Что-то'],
      ['06.09.2026', '-200,00', 'Что-то ещё'],
    ]);
    const mapping = guessMapping(table);

    expect(mapping.date).toBe(0);
    expect(mapping.amount).toBe(1);
  });
});

describe('statement: rows, duplicates and rules', () => {
  const table = parseCsv(
    [
      'Дата;Сумма;Назначение',
      '05.09.2026;-1 234,56;Кофейня на Ленина',
      '05.09.2026;-1 234,56;Кофейня на Ленина',
      '06.09.2026;120 000,00;Зарплата за август',
      'Итого;;',
    ].join('\n'),
  );
  const mapping = guessMapping(table);

  it('turns a row into an operation and counts what it could not read', () => {
    const { rows, skipped } = buildRows(table, mapping);

    expect(rows).toHaveLength(3);
    expect(skipped).toBe(1);
    expect(rows[0]).toMatchObject({
      date: '2026-09-05',
      amountMinor: 123_456,
      kind: 'expense',
      note: 'Кофейня на Ленина',
    });
    expect(rows[2].kind).toBe('income');
  });

  it('keeps two identical purchases of one day apart', () => {
    const { rows } = buildRows(table, mapping);

    // the same text twice, so the second one is told apart by its position
    expect(rows[0].hash).not.toBe(rows[1].hash);
  });

  it('finds the same file on a second import, and lets a lookalike through', () => {
    const { rows } = buildRows(table, mapping);
    const alreadySaved = rows.map((row) => ({
      date: row.date,
      amountMinor: row.amountMinor,
      importRowHash: row.hash,
    }));

    const again = markDuplicates(rows, alreadySaved);
    expect([...again.values()]).toEqual(['exact', 'exact', 'exact']);

    // an operation typed by hand on the same day for the same sum is only a maybe
    const byHand = markDuplicates(rows, [{ date: '2026-09-05', amountMinor: 123_456 }]);
    expect(byHand.get(0)).toBe('possible');
    expect(byHand.get(2)).toBe('none');
  });

  it('puts a category on a row by a word in its note', () => {
    const rules = [
      { keyword: 'кофейня', categoryId: 'cafe' },
      { keyword: 'зарплата', categoryId: 'salary' },
    ];

    expect(applyRules('Кофейня на Ленина', rules)).toBe('cafe');
    expect(applyRules('Зарплата за август', rules)).toBe('salary');
    expect(applyRules('Перевод другу', rules)).toBeNull();
    expect(applyRules('Кофейня', [{ keyword: '   ', categoryId: 'cafe' }])).toBeNull();
  });
});
