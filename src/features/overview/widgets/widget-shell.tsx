import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function WidgetFrame({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full flex-col gap-3 p-4', className)}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">{children}</div>
    </div>
  );
}

/** Every widget must say what to do when it has no data to show. */
export function WidgetEmpty({ text, actionLabel, to }: { text: string; actionLabel?: string; to?: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">{text}</p>
      {actionLabel && to ? (
        <Link to={to} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'primary',
}: {
  value: number;
  tone?: 'primary' | 'warning' | 'destructive';
}) {
  const percent = Math.max(0, Math.min(1, value)) * 100;
  const color = tone === 'destructive' ? 'bg-destructive' : tone === 'warning' ? 'bg-warning' : 'bg-primary';

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function BigNumber({ value, tone }: { value: string; tone?: 'default' | 'negative' }) {
  return (
    <p className={cn('text-2xl font-semibold tabular-nums', tone === 'negative' && 'text-destructive')}>
      {value}
    </p>
  );
}
