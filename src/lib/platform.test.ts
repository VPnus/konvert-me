import { describe, expect, it } from 'vitest';

import { detectPlatform } from '@/lib/platform';

const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

describe('platform detection for the Safari storage warning', () => {
  it('recognises Safari on macOS', () => {
    const platform = detectPlatform(SAFARI_MAC, false);
    expect(platform.isSafari).toBe(true);
    expect(platform.needsInstallHint).toBe(true);
  });

  it('recognises Safari on iPhone', () => {
    const platform = detectPlatform(SAFARI_IPHONE, false);
    expect(platform.isIos).toBe(true);
    expect(platform.needsInstallHint).toBe(true);
  });

  it('does not bother Chrome users', () => {
    const platform = detectPlatform(CHROME, false);
    expect(platform.isSafari).toBe(false);
    expect(platform.needsInstallHint).toBe(false);
  });

  it('stays quiet once the app is installed', () => {
    expect(detectPlatform(SAFARI_IPHONE, true).needsInstallHint).toBe(false);
  });
});
