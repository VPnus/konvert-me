import type { ZodType } from 'zod';

import { ValidationError } from '@/db/errors';

/** Runs a Zod schema and turns its issues into one error the interface can show. */
export function parseOrThrow<T>(schema: ZodType<T>, value: unknown, subject: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  throw new ValidationError(`${subject}: ${issues.map((issue) => issue.message).join('; ')}`, issues);
}
