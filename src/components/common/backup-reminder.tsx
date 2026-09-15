import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { buttonVariants } from '@/components/ui/button';
import { isBackupDue } from '@/db/repositories/settings';
import { useSettings } from '@/hooks/use-settings';
import { ru } from '@/i18n/ru';

/** Once every thirty days: the data lives on this device only. */
export function BackupReminder() {
  const settings = useSettings();
  if (!isBackupDue(settings)) return null;

  return (
    <div
      role="status"
      data-testid="backup-reminder"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
    >
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
      <span className="min-w-0 flex-1">
        {settings.lastBackupAt === null ? ru.settings.backupReminderNever : ru.settings.backupReminder}
      </span>
      <Link to="/settings" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
        {ru.settings.backupReminderAction}
      </Link>
    </div>
  );
}
