import { X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NoticeProps {
  readonly testId: string;
  readonly icon: LucideIcon;
  /** A risk to the data is a warning; the rest remind of something to do. */
  readonly tone: 'warning' | 'reminder';
  readonly children: ReactNode;
  /** Where the notice leads. */
  readonly action: { readonly to: string; readonly label: string };
  /** The label and the test id of the dismissal; a notice without it goes away once its cause does. */
  readonly dismiss?: { readonly label: string; readonly testId: string };
  readonly onDismiss?: () => void;
  /** What the notice is about, for a notice that says one of several things. */
  readonly kind?: string;
}

/**
 * A notice above the page. On a phone it keeps to a few lines of small text, the link at the end of
 * the text and the dismissal a cross, so that two or three of them still leave the first screen to
 * the page. From a tablet on, the link and the dismissal are buttons beside the text.
 */
export function Notice({
  testId,
  icon: Icon,
  tone,
  children,
  action,
  dismiss,
  onDismiss,
  kind,
}: NoticeProps) {
  return (
    <div
      role="status"
      data-testid={testId}
      data-kind={kind}
      className={cn(
        'mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-snug sm:mb-4 sm:items-center sm:gap-3 sm:px-4 sm:py-3 sm:text-sm',
        tone === 'warning' ? 'border-warning/40 bg-warning/10' : 'border-border bg-muted/40',
      )}
    >
      <Icon
        className={cn('mt-px size-4 shrink-0 sm:mt-0', tone === 'warning' && 'text-warning')}
        aria-hidden
      />

      <div className="min-w-0 flex-1 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <span className="sm:min-w-0 sm:flex-1 sm:basis-64">{children}</span>{' '}
        <Link
          to={action.to}
          className={cn(
            buttonVariants({ size: 'sm', variant: 'outline' }),
            'max-sm:inline max-sm:h-auto max-sm:rounded-sm max-sm:border-0 max-sm:p-0 max-sm:text-xs max-sm:underline max-sm:underline-offset-2',
          )}
        >
          {action.label}
        </Link>
      </div>

      {dismiss && onDismiss ? (
        <Button
          size="sm"
          variant="ghost"
          className="-my-1 -mr-1.5 size-7 shrink-0 p-0 sm:m-0 sm:h-9 sm:w-auto sm:px-3"
          data-testid={dismiss.testId}
          onClick={onDismiss}
        >
          <X className="size-4 sm:hidden" aria-hidden />
          <span className="sr-only sm:not-sr-only">{dismiss.label}</span>
        </Button>
      ) : null}
    </div>
  );
}
