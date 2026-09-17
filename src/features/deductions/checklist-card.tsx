import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { setChecklistItem } from '@/db/repositories/deductions';
import type { ChecklistGroup } from '@/features/deductions/checklist';
import type { DeductionYearView } from '@/features/deductions/deductions-data';
import { fill, strings } from '@/i18n';
import { cn } from '@/lib/utils';

const t = strings.deductions.checklist;

interface ChecklistCardProps {
  readonly view: DeductionYearView;
  /** Built from the answers as they are now, saved or not. */
  readonly groups: readonly ChecklistGroup[];
}

/**
 * The papers the answers call for, ticked off as they are gathered. A tick shows at once and is
 * kept with the year; the card is remounted when the stored year changes, so it never drifts.
 */
export function ChecklistCard({ view, groups }: ChecklistCardProps) {
  const [gathered, setGathered] = useState(() => new Set(view.saved?.checklist ?? []));
  const [error, setError] = useState<string | null>(null);
  const canTick = view.saved !== undefined;

  const keys = groups.flatMap((group) => group.items.map((item) => `${group.id}.${item}`));
  const done = keys.filter((key) => gathered.has(key)).length;

  const tick = async (key: string, checked: boolean) => {
    setError(null);
    setGathered((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    try {
      await setChecklistItem(view.year, key, checked);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    }
  };

  return (
    <Card data-testid="checklist-card">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-base">{t.title}</CardTitle>
          {groups.length > 0 ? (
            <span className="text-sm tabular-nums text-muted-foreground" data-testid="checklist-progress">
              {fill(t.progress, { done, total: keys.length })}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{t.hint}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-3">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="checklist-empty">
            {t.empty}
          </p>
        ) : (
          <>
            {canTick ? null : (
              <p className="text-sm" data-testid="checklist-save-first">
                {t.saveFirst}
              </p>
            )}

            {groups.map((group) => {
              const files = view.documents.filter((paper) => paper.category === group.category).length;
              return (
                <section key={group.id} className="flex flex-col gap-2" data-testid={`checklist-${group.id}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{t.groups[group.id]}</p>
                    {files > 0 ? (
                      <span className="text-xs text-muted-foreground">{fill(t.files, { count: files })}</span>
                    ) : null}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {group.items.map((item) => {
                      const key = `${group.id}.${item}`;
                      const checked = gathered.has(key);
                      return (
                        <li key={key}>
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canTick}
                              className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                              data-testid={`check-${group.id}-${item}`}
                              onChange={(event) => void tick(key, event.target.checked)}
                            />
                            <span className={cn(checked && 'text-muted-foreground line-through')}>
                              {t.items[item]}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {group.certificate ? (
                    <p className="text-xs text-muted-foreground">{t.certificateNote}</p>
                  ) : null}
                </section>
              );
            })}

            <p className="text-xs text-muted-foreground">{t.timing}</p>
          </>
        )}

        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="checklist-error">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
