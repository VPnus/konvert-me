/** Puts values into a text of ru.ts: 'до {limit}' → 'до 150 000 ₽'. */
export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}
