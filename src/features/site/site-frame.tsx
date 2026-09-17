import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { CatLogo } from '@/components/brand/cat-logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { fill, strings } from '@/i18n';

interface SiteFrameProps {
  /** The one button of the header: into the app, or to start it. A long label has a short one for a phone. */
  readonly action: {
    readonly to: string;
    readonly label: string;
    readonly shortLabel?: string;
    readonly testId: string;
  };
  readonly children: ReactNode;
}

/**
 * The pages of the site around the app, the landing and the privacy policy: the same logo and theme
 * as the app, but no tabs, since there is nothing of the user's to show yet.
 */
export function SiteFrame({ action, children }: SiteFrameProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 md:px-8 md:py-3">
          <Link to="/" aria-label={strings.site.home} className="flex min-w-0 items-center gap-2">
            <CatLogo className="size-10 shrink-0 md:size-11" />
            <span className="truncate text-base font-semibold md:text-lg">{strings.app.name}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link to={action.to} className={buttonVariants({ size: 'sm' })} data-testid={action.testId}>
              {action.shortLabel ? (
                <>
                  <span className="sm:hidden">{action.shortLabel}</span>
                  <span className="hidden sm:inline">{action.label}</span>
                </>
              ) : (
                action.label
              )}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>{strings.app.disclaimer}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              to="/privacy"
              className="underline underline-offset-2 hover:text-foreground"
              data-testid="site-privacy-link"
            >
              {strings.site.privacyLink}
            </Link>
            <span>{fill(strings.site.version, { version: __APP_VERSION__ })}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
