import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';

import { formatMinor } from '@/core/money';
import { Button } from '@/components/ui/button';
import { loadDeductions, type DeductionYearView } from '@/features/deductions/deductions-data';
import { DocumentsCard } from '@/features/deductions/documents-card';
import { YearPanel } from '@/features/deductions/year-panel';
import { useDataVersion } from '@/hooks/use-data-version';
import { fill, strings } from '@/i18n';

const t = strings.deductions;

/** Under the year: what it gives back or owes, or where it stands if neither yet. */
function yearCaption(view: DeductionYearView): string {
  const balance = view.summary?.balanceMinor ?? 0;
  if (balance > 0) return formatMinor(balance, { fractionDigits: 0 });
  if (balance < 0) return fill(t.captionToPay, { amount: formatMinor(-balance, { fractionDigits: 0 }) });
  if (view.stage === 'current') return t.captionCurrent;
  if (view.stage === 'expired') return t.captionExpired;
  return t.captionNothing;
}

export default function DeductionsPage() {
  const dataVersion = useDataVersion();
  const data = useLiveQuery(() => loadDeductions(), [dataVersion]);
  const [chosen, setChosen] = useState<number | null>(null);

  // The year to open by default is the latest one a return can be filed for right now.
  const year =
    chosen ?? data?.years.find((view) => view.stage === 'open')?.year ?? data?.years[0]?.year ?? null;
  const view = data?.years.find((item) => item.year === year);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{strings.pages.deductions.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {!data || !view ? (
        <p className="text-sm text-muted-foreground">{strings.common.loading}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t.yearsLabel}>
            {data.years.map((item) => (
              <Button
                key={item.year}
                role="tab"
                aria-selected={item.year === view.year}
                variant={item.year === view.year ? 'default' : 'outline'}
                className="h-auto flex-col items-start gap-0 px-3 py-1.5"
                data-testid={`deduction-year-${item.year}`}
                onClick={() => setChosen(item.year)}
              >
                <span className="text-sm font-semibold">{item.year}</span>
                <span className="text-xs font-normal opacity-80">{yearCaption(item)}</span>
              </Button>
            ))}
          </div>

          {/* A year's answers start from what that year saved, not from the year looked at before. */}
          <YearPanel key={view.year} view={view} />
          <DocumentsCard
            year={view.year}
            documents={view.documents}
            totalSizeBytes={data.documentsSizeBytes}
          />
        </>
      )}
    </section>
  );
}
