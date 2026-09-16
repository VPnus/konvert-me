/**
 * A statement file as a table: a header row and the rows under it. CSV is parsed
 * here; XLSX is read by ExcelJS, which is loaded only when such a file is opened.
 */

import Papa from 'papaparse';

export interface RawTable {
  readonly headers: string[];
  readonly rows: string[][];
}

/** Words that mark the header row of a Russian bank statement. */
const HEADER_WORDS = [
  'дата',
  'сумма',
  'описание',
  'назначение',
  'операц',
  'приход',
  'расход',
  'дебет',
  'кредит',
  'категор',
  'date',
  'amount',
  'description',
];

function looksLikeHeader(cells: readonly string[]): boolean {
  const filled = cells.filter((cell) => cell.trim()).length;
  if (filled < 2) return false;

  const text = cells.join(' ').toLocaleLowerCase('ru');
  return HEADER_WORDS.some((word) => text.includes(word));
}

/**
 * Banks like to put a few lines about the account before the table itself, so the
 * header is looked for rather than assumed to be the first row.
 */
export function toTable(rows: string[][]): RawTable {
  // No recognisable header: the first row is taken as one.
  const headerIndex = Math.max(0, rows.findIndex(looksLikeHeader));
  const headers = (rows[headerIndex] ?? []).map((cell) => cell.trim());

  const body = rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => row.map((cell) => cell.trim()));

  return { headers, rows: body };
}

export function parseCsv(text: string): RawTable {
  const result = Papa.parse<string[]>(text, {
    delimitersToGuess: [';', ',', '\t', '|'],
    skipEmptyLines: 'greedy',
  });

  return toTable(result.data.filter(Array.isArray));
}

/** ExcelJS is a heavy library and lands in its own chunk: it is imported here only. */
export async function parseXlsx(buffer: ArrayBuffer): Promise<RawTable> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      if (value === null || value === undefined) cells.push('');
      else if (value instanceof Date) cells.push(value.toISOString().slice(0, 10));
      else if (typeof value === 'object' && 'result' in value) cells.push(String(value.result ?? ''));
      else if (typeof value === 'object' && 'text' in value) cells.push(String(value.text ?? ''));
      else cells.push(String(value));
    });
    rows.push(cells);
  });

  return toTable(rows);
}
