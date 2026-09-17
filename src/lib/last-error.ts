/**
 * The last error the app ran into, kept in memory only: a message about a problem may carry it, so
 * the author sees what broke without asking. Nothing is stored and nothing leaves by itself.
 */

const MAX_LENGTH = 300;

let last: string | null = null;

/** The first line of an error, not its stack: enough to find the place, short enough to read. */
export function rememberError(error: unknown): void {
  const text =
    error instanceof Error ? error.message : typeof error === 'string' ? error : error ? String(error) : '';
  const line = text.split('\n')[0]?.trim() ?? '';
  if (!line) return;
  last = line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH - 1)}…` : line;
}

export function lastErrorMessage(): string | null {
  return last;
}

/** For the tests: the app starts with no error remembered. */
export function forgetLastError(): void {
  last = null;
}

/** Errors no screen caught: a failed script or a promise nobody waited for. Returns the unsubscribe. */
export function listenForErrors(target: Window = window): () => void {
  const onError = (event: ErrorEvent) => rememberError(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => rememberError(event.reason);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
