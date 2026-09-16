import { NavLink, Outlet } from 'react-router-dom';

import { BackupReminder } from '@/components/common/backup-reminder';
import { DataRiskBanner } from '@/components/common/data-risk-banner';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { CatLogo } from '@/components/brand/cat-logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { NAV_ITEMS } from '@/app/navigation';
import { DeductionReminderBanner } from '@/features/deductions/deduction-reminder';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/utils';

const tabBase =
  'flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:gap-2 sm:px-2.5';

/**
 * The tabs live in one bar above the page. On a narrow screen only the open tab keeps
 * its name, so all seven icons fit a 375 px line without a bar at the bottom of the
 * screen eating another row.
 */
function TabBar() {
  return (
    <nav
      aria-label={ru.nav.mainMenu}
      className="flex items-center justify-between gap-0.5 sm:justify-start sm:gap-1"
      data-testid="tab-bar"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={item.label}
          className={({ isActive }) =>
            cn(
              tabBase,
              isActive
                ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                : 'text-muted-foreground',
            )
          }
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

export function AppShell() {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-2 md:flex-row md:items-center md:gap-4 md:px-8 md:py-3">
          <div className="flex items-center justify-between gap-2 md:justify-start">
            <NavLink to="/overview" className="flex min-w-0 items-center gap-2">
              <CatLogo className="size-10 shrink-0 md:size-11" />
              <span className="truncate text-base font-semibold md:text-lg">{ru.app.name}</span>
            </NavLink>
            <div className="md:hidden">
              <ThemeToggle />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <TabBar />
          </div>

          <div className="hidden shrink-0 md:block">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto min-w-0 w-full max-w-6xl flex-1 px-4 pt-4 pb-8 md:px-8 md:py-8">
        <ErrorBoundary>
          <DataRiskBanner />
          <BackupReminder />
          <DeductionReminderBanner />
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-[11px] text-muted-foreground md:px-8">
        {ru.app.disclaimer}
      </footer>
    </div>
  );
}
