import { CalendarClock } from 'lucide-react';

import { formatForecast } from '@/core/money';
import type { UpcomingEvent } from '@/core/upcoming';
import { daysLabel } from '@/features/balance/days-label';
import { WidgetEmpty, WidgetFrame } from '@/features/overview/widgets/widget-shell';
import type { WidgetProps } from '@/features/overview/widgets/types';
import { ru } from '@/i18n/ru';

function EventRow({ event }: { event: UpcomingEvent }) {
  return (
    <li className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{event.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {ru.upcoming.kinds[event.kind]}
          {event.amountMinor ? ` · ${formatForecast(event.amountMinor)}` : ''}
        </p>
        {event.minimumMinor ? (
          <p className="text-[11px] text-muted-foreground">
            {ru.upcoming.minimum.replace('{amount}', formatForecast(event.minimumMinor))}
          </p>
        ) : null}
      </div>
      <span
        className={`shrink-0 text-sm font-semibold ${event.inDays <= 3 ? 'text-warning' : ''}`}
        data-testid={`upcoming-${event.name}`}
      >
        {daysLabel(event.inDays)}
      </span>
    </li>
  );
}

/** The dates that are about to matter: payments, deposits, policies, grace periods. */
export function UpcomingWidget({ data }: WidgetProps) {
  if (data.upcoming.length === 0) {
    return (
      <WidgetFrame title={ru.upcoming.title}>
        <WidgetEmpty text={ru.upcoming.empty} actionLabel={ru.accounts.title} to="/balance" />
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={ru.upcoming.title}>
      <ul data-testid="upcoming-list">
        {data.upcoming.slice(0, 6).map((event) => (
          <EventRow key={`${event.kind}:${event.id}:${event.date}`} event={event} />
        ))}
      </ul>
      <p className="pt-2 text-[11px] text-muted-foreground">
        <CalendarClock className="mr-1 inline size-3" aria-hidden />
        {ru.upcoming.description}
      </p>
    </WidgetFrame>
  );
}
