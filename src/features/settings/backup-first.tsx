import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { downloadBackup, lastBackupLabel } from '@/features/settings/backup-actions';
import { useSettings } from '@/hooks/use-settings';
import { strings } from '@/i18n';

/**
 * Inside a dialog that is about to delete or replace data: a backup first, one press away.
 * Without a password — a moment before losing everything is not the time to invent one.
 */
export function BackupFirst() {
  const settings = useSettings();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setState('busy');
    setError(null);
    try {
      await downloadBackup();
      setState('done');
    } catch (cause) {
      setState('idle');
      setError(cause instanceof Error ? cause.message : strings.common.error);
    }
  };

  return (
    <div
      className="flex flex-col items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
      data-testid="backup-first"
    >
      <p>{strings.settings.backupFirst.replace('{date}', lastBackupLabel(settings.lastBackupAt))}</p>
      {state === 'done' ? (
        <p role="status" className="text-success" data-testid="backup-first-done">
          {strings.settings.backupFirstDone}
        </p>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={state === 'busy'}
          data-testid="backup-first-download"
          onClick={() => void save()}
        >
          {strings.settings.backupFirstAction}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
