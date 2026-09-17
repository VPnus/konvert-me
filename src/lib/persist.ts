/**
 * Asks the browser to keep the data: without persistent storage the browser may
 * evict IndexedDB when the disk gets tight.
 */

import { strings } from '@/i18n';

export interface StorageStatus {
  readonly supported: boolean;
  readonly persisted: boolean;
  readonly usageBytes?: number;
  readonly quotaBytes?: number;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return { supported: false, persisted: false };
  }

  const persisted = await navigator.storage.persisted();
  let usageBytes: number | undefined;
  let quotaBytes: number | undefined;

  if (navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    usageBytes = estimate.usage;
    quotaBytes = estimate.quota;
  }

  return { supported: true, persisted, usageBytes, quotaBytes };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export function formatBytes(bytes: number): string {
  const { b, kb, mb, gb } = strings.settings.bytes;
  if (bytes < 1024) return `${bytes} ${b}`;
  const units = [kb, mb, gb];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
