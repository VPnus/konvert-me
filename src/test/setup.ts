import { webcrypto } from 'node:crypto';

import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom ships without WebCrypto; the backup encryption and the ids need it.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// The dictionary follows the language of the browser: jsdom says English, the tests speak Russian
// unless a test sets another language itself.
Object.defineProperty(navigator, 'languages', { value: ['ru-RU'], configurable: true });
Object.defineProperty(navigator, 'language', { value: 'ru-RU', configurable: true });
