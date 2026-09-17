import { describe, expect, it } from 'vitest';

import { NAV_ITEMS } from '@/app/navigation';
import { SITE } from '@/app/site';

describe('the settings of the site', () => {
  it('list every address of the app, so the host keeps the page at each', () => {
    const addresses = ['/welcome', '/privacy', ...NAV_ITEMS.map((item) => item.to)];

    expect([...SITE.routes].sort()).toEqual(addresses.sort());
  });

  it('put the site at the root of an https address: the data of the users is bound to it', () => {
    const origin = new URL(SITE.origin);

    expect(origin.protocol).toBe('https:');
    expect(origin.pathname).toBe('/');
    expect(SITE.origin).toBe(origin.origin);
  });

  it('publish into the repository named like its owner, the one that gets the root of the domain', () => {
    const owner = new URL(SITE.origin).hostname.split('.')[0];

    expect(SITE.repository).toMatch(new RegExp(`/${owner}/${owner}(\\.git)?$`, 'i'));
    expect(SITE.branch).not.toBe('');
  });

  it('link only to a questionnaire over https and to a real mail address', () => {
    if (SITE.feedbackFormUrl !== null) expect(new URL(SITE.feedbackFormUrl).protocol).toBe('https:');
    if (SITE.contactEmail !== null) expect(SITE.contactEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
