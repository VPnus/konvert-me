/**
 * Bytes of a statement file into text. Russian banks still hand out Windows-1251,
 * so the encoding is worked out rather than assumed: valid UTF-8 is taken as UTF-8,
 * anything else is decoded as 1251 — the only other encoding these files come in.
 */

const UTF8_BOM = [0xef, 0xbb, 0xbf];

function looksUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function decodeStatement(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  const hasBom = UTF8_BOM.every((byte, index) => bytes[index] === byte);
  const body = hasBom ? bytes.subarray(UTF8_BOM.length) : bytes;

  if (hasBom || looksUtf8(body)) return new TextDecoder('utf-8').decode(body);
  return new TextDecoder('windows-1251').decode(body);
}
