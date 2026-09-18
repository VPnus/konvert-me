import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { BackupReminder } from '@/components/common/backup-reminder';
import { DataRiskBanner } from '@/components/common/data-risk-banner';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { UpdatedNotice } from '@/components/pwa/updated-notice';
import { CatLogo } from '@/components/brand/cat-logo';
import { LanguageToggle } from '@/components/i18n/language-toggle';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { navItemsFor, type NavItem } from '@/app/navigation';
import { CardReminderBanner } from '@/features/balance/card-reminder-banner';
import { deductionsAvailable } from '@/features/deductions/country';
import { DeductionReminderBanner } from '@/features/deductions/deduction-reminder';
import { ReportProblemButton } from '@/features/feedback/report-problem';
import { PlanReviewReminderBanner } from '@/features/plan/review-reminder';
import { PilotReminderBanner } from '@/features/settings/pilot-reminder';
import { useHand } from '@/hooks/use-hand';
import { strings } from '@/i18n';
import { currentCountry } from '@/i18n/country';
import type { Hand } from '@/lib/hand';
import { listenForErrors } from '@/lib/last-error';
import { cn } from '@/lib/utils';

const tabBase =
  'flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:gap-2 sm:px-2.5';
const tabActive = 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary';

/**
 * From a tablet on, the tabs live in one bar above the page; on a laptop every tab keeps its name,
 * below that only the open one does.
 */
function TabBar({ items }: { items: readonly NavItem[] }) {
  return (
    <nav aria-label={strings.nav.mainMenu} className="flex items-center gap-1" data-testid="tab-bar">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={item.label}
          className={({ isActive }) => cn(tabBase, isActive ? tabActive : 'text-muted-foreground')}
        >
          {({ isActive }) => (
            <>
              <item.icon className="size-5 shrink-0" aria-hidden />
              <span className={cn('truncate', isActive ? 'inline' : 'hidden lg:inline')}>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Where the column of tabs stands on a phone, and the room the page leaves it on that side. */
const RAIL_SIDE: Record<Hand, { readonly rail: string; readonly page: string }> = {
  right: { rail: 'right-0 border-l', page: 'max-md:pr-[3.75rem]' },
  left: { rail: 'left-0 border-r', page: 'max-md:pl-[3.75rem]' },
};

/**
 * On a phone the tabs stand in a column along the edge of the hand that holds it, at the bottom of
 * the screen where the thumb reaches; the settings move them to the left for the left hand.
 */
function TabRail({ hand, items }: { hand: Hand; items: readonly NavItem[] }) {
  return (
    <nav
      aria-label={strings.nav.mainMenu}
      data-testid="tab-rail"
      data-hand={hand}
      className={cn(
        'fixed inset-y-0 z-20 flex w-12 flex-col items-center justify-end gap-1 border-border bg-card pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden',
        RAIL_SIDE[hand].rail,
      )}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={item.label}
          aria-label={item.label}
          className={({ isActive }) =>
            cn(
              'flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive ? tabActive : 'text-muted-foreground',
            )
          }
        >
          <item.icon className="size-5" aria-hidden />
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const hand = useHand();
  // The session draws the shell anew when the country changes, so it is read as the page is drawn.
  const items = navItemsFor(currentCountry());
  // A message about a problem may carry the last error, the ones no screen caught included.
  useEffect(() => listenForErrors(), []);

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-2 md:justify-start md:gap-4 md:px-8 md:py-3">
          <NavLink to="/overview" className="flex min-w-0 items-center gap-2">
            <CatLogo className="size-10 shrink-0 md:size-11" />
            <span className="truncate text-base font-semibold md:text-lg">{strings.app.name}</span>
          </NavLink>

          <div className="hidden min-w-0 flex-1 md:block">
            <TabBar items={items} />
          </div>

          <div className="flex shrink-0 items-center">
            <LanguageToggle />
            <ReportProblemButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <TabRail hand={hand} items={items} />

      <main
        className={cn(
          'mx-auto min-w-0 w-full max-w-6xl flex-1 px-4 pt-4 pb-8 md:px-8 md:py-8',
          RAIL_SIDE[hand].page,
        )}
      >
        <ErrorBoundary>
          <UpdatedNotice />
          <DataRiskBanner />
          <CardReminderBanner />
          <BackupReminder />
          {deductionsAvailable() ? <DeductionReminderBanner /> : null}
          <PlanReviewReminderBanner />
          <PilotReminderBanner />
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer
        className={cn(
          'mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 pb-6 text-[11px] text-muted-foreground sm:flex-row sm:justify-between sm:gap-4 md:px-8',
          RAIL_SIDE[hand].page,
        )}
      >
        <span>{strings.app.disclaimer}</span>
        <Link
          to="/privacy"
          className="shrink-0 underline underline-offset-2 hover:text-foreground"
          data-testid="app-privacy-link"
        >
          {strings.site.privacyLink}
        </Link>
      </footer>
    </div>
  );
}
