import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { db, handleVersionChange } from '@/db/db';
import { strings } from '@/i18n';

/**
 * An old tab blocks the schema upgrade of a new one. Dexie tells us about it, we close
 * the connection and ask for a reload instead of leaving a silently broken tab.
 */
export function DatabaseBlockedDialog() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => handleVersionChange(db, () => setBlocked(true)), []);

  if (!blocked) return null;

  return (
    <div
      role="alertdialog"
      aria-labelledby="db-blocked-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 id="db-blocked-title" className="text-base font-semibold">
          {strings.database.blockedTitle}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{strings.database.blockedText}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {strings.database.blockedAction}
        </Button>
      </div>
    </div>
  );
}
