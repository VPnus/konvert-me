import site from '@/app/site.json';

/**
 * Where the site lives and how it talks to the people of the pilot. The values sit in site.json,
 * because the build (vite.config.ts) and the publishing script (scripts/deploy.mjs) read them too.
 */
export interface SiteConfig {
  /**
   * The address of the site. Every user's data stays in the browser under this address, so once
   * people use it, it must not change: at a new address they would find the app empty.
   */
  readonly origin: string;
  /** The public repository the built site is pushed to; the host publishes its branch. */
  readonly repository: string;
  readonly branch: string;
  /** The questionnaire of the pilot. Without it the stats go to whoever invited the user. */
  readonly feedbackFormUrl: string | null;
  /** An address for questions about the data, shown in the privacy policy. */
  readonly contactEmail: string | null;
  /** While the pilot runs, the landing invites to it and the app reminds to share the stats. */
  readonly pilotActive: boolean;
  /** Every page address of the app: the host keeps a copy of the page at each of them. */
  readonly routes: readonly string[];
}

export const SITE: SiteConfig = site;
