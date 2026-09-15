/** Errors of the storage layer, in plain Russian: they are shown to the user as is. */
export class RepositoryError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'RepositoryError';
    this.field = field;
  }
}

export class ValidationError extends RepositoryError {
  readonly issues: readonly { path: string; message: string }[];

  constructor(message: string, issues: readonly { path: string; message: string }[]) {
    super(message, issues[0]?.path);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}
