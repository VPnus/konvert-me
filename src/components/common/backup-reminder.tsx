import { AlertTriangle } from 'lucide-react';

import { Notice } from '@/components/common/notice';
import { isBackupDue } from '@/db/repositories/settings';
import { useSettingsState } from '@/hooks/use-settings';
import { strings } from '@/i18n';

/** Once every thirty days: the data lives on this device only. */
export function BackupReminder() {
  const { settings, loading } = useSettingsState();
  if (loading || !isBackupDue(settings)) return null;

  return (
    <Notice
      testId="backup-reminder"
      icon={AlertTriangle}
      tone="warning"
      action={{ to: '/settings', label: strings.settings.backupReminderAction }}
    >
      {settings.lastBackupAt === null
        ? strings.settings.backupReminderNever
        : strings.settings.backupReminder}
    </Notice>
  );
}
