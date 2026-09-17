import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import releaseNotes from '@/app/release-notes.json';
import { Button } from '@/components/ui/button';
import { fill, strings } from '@/i18n';
import { pendingNotes, readSeenVersion, writeSeenVersion } from '@/lib/release';

/** Once after an update: what the new version brought. A first visit only remembers the version. */
export function UpdatedNotice() {
  const [notes, setNotes] = useState<string[]>(() => pendingNotes(__APP_VERSION__, releaseNotes));

  useEffect(() => {
    if (notes.length === 0 && readSeenVersion() !== __APP_VERSION__) writeSeenVersion(__APP_VERSION__);
  }, [notes.length]);

  if (notes.length === 0) return null;

  return (
    <div
      role="status"
      data-testid="updated-notice"
      className="mb-2 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-snug sm:mb-4 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm"
    >
      <Sparkles className="mt-px size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{fill(strings.pwa.updated, { version: __APP_VERSION__ })}</p>
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          data-testid="updated-notice-dismiss"
          onClick={() => {
            writeSeenVersion(__APP_VERSION__);
            setNotes([]);
          }}
        >
          {strings.pwa.updatedDismiss}
        </Button>
      </div>
    </div>
  );
}
