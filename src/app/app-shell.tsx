import * as Dialog from '@radix-ui/react-dialog';
import { MoreHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { ThemeToggle } from '@/components/theme/theme-toggle';
import { NAV_ITEMS, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from '@/app/navigation';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/utils';

const linkBase =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';

function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <img src="/favicon.svg" alt="" aria-hidden className="size-9 rounded-lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{ru.app.name}</p>
          <p className="truncate text-xs text-muted-foreground">{ru.app.offlineNote}</p>
        </div>
      </div>

      <nav aria-label={ru.nav.mainMenu} className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(linkBase, isActive && 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary')
            }
          >
            <item.icon className="size-5 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 px-3 py-4">
        <p className="px-2 text-[11px] leading-snug text-muted-foreground">{ru.app.disclaimer}</p>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function MoreSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        data-testid="nav-more"
      >
        <MoreHorizontal className="size-5" aria-hidden />
        <span>{ru.nav.more}</span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">{ru.nav.moreTitle}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {ru.nav.moreDescription}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label={ru.nav.close} className="rounded-md p-1 hover:bg-accent">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          <nav aria-label={ru.nav.moreTitle} className="flex flex-col gap-1">
            {SECONDARY_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => cn(linkBase, isActive && 'bg-primary/15 text-primary')}
              >
                <item.icon className="size-5 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function BottomBar() {
  return (
    <nav
      aria-label={ru.nav.mainMenu}
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-border bg-card px-2 pt-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {PRIMARY_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          <item.icon className="size-5" aria-hidden />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
      <MoreSheet />
    </nav>
  );
}

export function AppShell() {
  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/favicon.svg" alt="" aria-hidden className="size-7 rounded-md" />
            <span className="truncate text-sm font-semibold">{ru.app.name}</span>
          </div>
          <ThemeToggle />
        </header>

        <main className="min-w-0 flex-1 px-4 pt-4 pb-24 md:px-8 md:py-8">
          <Outlet />
        </main>

        <footer className="hidden px-8 pb-6 text-[11px] text-muted-foreground md:block">
          {ru.app.disclaimer}
        </footer>
      </div>

      <BottomBar />
    </div>
  );
}
