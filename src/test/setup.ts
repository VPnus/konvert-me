import { webcrypto } from 'node:crypto';

import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom ships without WebCrypto; the backup encryption and the ids need it.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
