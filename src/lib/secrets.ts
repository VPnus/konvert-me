/**
 * Helpers for the one kind of secret the app stores: an API key the user typed for a
 * news source. Keys are never shown in full and never end up in an error message.
 */

const VISIBLE_TAIL = 4;

export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= VISIBLE_TAIL) return '•'.repeat(secret.length);
  return `${'•'.repeat(Math.min(8, secret.length - VISIBLE_TAIL))}${secret.slice(-VISIBLE_TAIL)}`;
}

/** Hides the values of query parameters whose name looks like a key. */
export function maskUrl(rawUrl: string, extraParams: readonly string[] = []): string {
  const suspicious = ['key', 'apikey', 'api_key', 'token', 'access_token', 'secret', 'auth', 'password'];

  try {
    const url = new URL(rawUrl);
    for (const [name, value] of [...url.searchParams.entries()]) {
      const looksSecret =
        extraParams.includes(name) || suspicious.includes(name.toLowerCase().replace(/[-\s]/g, '_'));
      if (looksSecret && value) url.searchParams.set(name, maskSecret(value));
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

/** Removes secret values from any text before it is stored or shown. */
export function stripSecrets(text: string, secrets: readonly string[]): string {
  return secrets.reduce(
    (result, secret) => (secret ? result.split(secret).join(maskSecret(secret)) : result),
    text,
  );
}
