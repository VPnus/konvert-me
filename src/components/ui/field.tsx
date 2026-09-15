import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly className?: string;
  readonly children: (id: string) => ReactNode;
}

/** A labelled control: the label is always tied to its input, hints stay readable. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
