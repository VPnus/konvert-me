/**
 * Keeps a text field numeric while the user types: letters, a second separator and the
 * exponent notation of <input type="number"> never get in. The comma stays as typed —
 * Russian keyboards give a comma — and is turned into a dot only when the value is read.
 */

export interface NumericInputOptions {
  readonly integer?: boolean;
  readonly allowNegative?: boolean;
}

export function sanitizeNumericInput(raw: string, options: NumericInputOptions = {}): string {
  const { integer = false, allowNegative = false } = options;

  const negative = allowNegative && raw.trimStart().startsWith('-');
  const digitsAndSeparators = raw.replace(/[^\d.,]/g, '');

  if (integer) return `${negative ? '-' : ''}${digitsAndSeparators.replace(/[.,]/g, '')}`;

  const firstSeparator = digitsAndSeparators.search(/[.,]/);
  if (firstSeparator === -1) return `${negative ? '-' : ''}${digitsAndSeparators}`;

  const head = digitsAndSeparators.slice(0, firstSeparator);
  const separator = digitsAndSeparators[firstSeparator];
  const tail = digitsAndSeparators.slice(firstSeparator + 1).replace(/[.,]/g, '');

  return `${negative ? '-' : ''}${head}${separator}${tail}`;
}

/** Reads the field: an empty or half-typed value counts as zero. */
export function parseNumericInput(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
