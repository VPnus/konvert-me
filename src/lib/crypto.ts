/**
 * Optional password protection of a backup file: PBKDF2-SHA256 derives the key,
 * AES-GCM encrypts the payload. Everything runs locally in WebCrypto.
 */

export const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

/** Bytes are turned into characters a slice at a time: one at a time takes a second on 10 MB. */
const BASE64_SLICE = 0x8000;

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += BASE64_SLICE) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_SLICE));
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedPayload {
  readonly salt: string;
  readonly iv: string;
  readonly iterations: number;
  readonly data: string;
}

export async function encryptText(text: string, password: string): Promise<EncryptedPayload> {
  if (!password) throw new CryptoError('Пароль не может быть пустым');

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(text),
  );

  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    iterations: PBKDF2_ITERATIONS,
    data: toBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptText(payload: EncryptedPayload, password: string): Promise<string> {
  if (!password) throw new CryptoError('Введите пароль от файла');

  const key = await deriveKey(password, fromBase64(payload.salt), payload.iterations);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(payload.iv) as BufferSource },
      key,
      fromBase64(payload.data) as BufferSource,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new CryptoError('Не удалось расшифровать файл: неверный пароль или файл повреждён');
  }
}
