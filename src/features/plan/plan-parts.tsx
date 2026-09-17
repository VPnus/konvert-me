import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { savePlanNote, type PlanNoteName } from '@/db/repositories/financial-plan';
import { t } from '@/features/plan/plan-format';
import { cn } from '@/lib/utils';

export function Row({
  label,
  value,
  testId,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  testId?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn('shrink-0 text-right tabular-nums', strong && 'text-base font-semibold')}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}

export function PlanCard({
  title,
  children,
  link,
  testId,
}: {
  title: string;
  children: ReactNode;
  link?: { to: string; label: string };
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {link ? (
          <Link
            to={link.to}
            className={cn(
              buttonVariants({ size: 'sm', variant: 'ghost' }),
              // a long label wraps instead of pushing out of a narrow card
              'h-auto min-h-9 py-1.5 text-right whitespace-normal',
            )}
          >
            {link.label}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
}

export function Muted({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className="text-sm text-muted-foreground" data-testid={testId}>
      {children}
    </p>
  );
}

/**
 * The notes of a step. Saved when the field is left, not on every key: the plan keeps one
 * row, and a note is not worth a write per letter.
 */
export function NoteCard({ name, value }: { name: PlanNoteName; value: string }) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  const [stored, setStored] = useState(value);

  // A note that comes from elsewhere — another tab, a restored backup — replaces the field;
  // the one this field has just saved comes back as it is and changes nothing.
  if (value !== stored) {
    setStored(value);
    if (value !== text) {
      setText(value);
      setSaved(false);
    }
  }

  const save = async () => {
    if (text === value) return;
    await savePlanNote(name, text);
    setSaved(true);
  };

  return (
    <PlanCard title={t.note}>
      <textarea
        value={text}
        rows={4}
        maxLength={2000}
        aria-label={t.note}
        placeholder={t.notePlaceholder}
        data-testid={`plan-note-${name}`}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
        onChange={(event) => {
          setText(event.target.value);
          setSaved(false);
        }}
        onBlur={() => void save()}
      />
      {saved ? <Muted testId={`plan-note-${name}-saved`}>{t.noteSaved}</Muted> : null}
    </PlanCard>
  );
}
